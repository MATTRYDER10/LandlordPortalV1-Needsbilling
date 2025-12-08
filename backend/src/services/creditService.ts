import { supabase } from '../config/supabase';

/**
 * Credit Service
 *
 * Manages the credit system for PropertyGoose references.
 * Handles credit balance, additions, deductions, and transactions.
 */

export interface CreditBalance {
  company_id: string;
  credits: number;
  can_create_reference: boolean;
}

export interface CreditTransaction {
  id: string;
  company_id: string;
  type: string;
  credits_change: number;
  credits_balance_after: number;
  amount_gbp?: number;
  description: string;
  created_at: string;
}

// ============================================================================
// CREDIT BALANCE QUERIES
// ============================================================================

/**
 * Get current credit balance for a company
 */
export async function getCreditBalance(companyId: string): Promise<CreditBalance> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, reference_credits')
    .eq('id', companyId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch credit balance: ${error.message}`);
  }

  return {
    company_id: data.id,
    credits: data.reference_credits || 0,
    can_create_reference: (data.reference_credits || 0) > 0,
  };
}

/**
 * Check if company has enough credits to create a reference
 */
export async function hasCredits(companyId: string, required: number = 1): Promise<boolean> {
  const balance = await getCreditBalance(companyId);
  return balance.credits >= required;
}

// ============================================================================
// CREDIT ADDITIONS
// ============================================================================

/**
 * Add credits to a company's balance
 * Used for subscription renewals and credit pack purchases
 */
export async function addCredits(
  companyId: string,
  credits: number,
  type: 'subscription_credit' | 'pack_purchase' | 'auto_recharge' | 'manual_adjustment' | 'refund' | 'signup_bonus',
  description: string,
  userId?: string,
  metadata?: {
    amount_gbp?: number;
    stripe_payment_intent_id?: string;
    stripe_charge_id?: string;
  }
): Promise<CreditTransaction> {
  // Start a transaction to ensure atomicity
  const { data: company, error: fetchError } = await supabase
    .from('companies')
    .select('reference_credits')
    .eq('id', companyId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch company: ${fetchError.message}`);
  }

  const currentCredits = company.reference_credits || 0;
  const newBalance = currentCredits + credits;

  // Update company credits
  const { error: updateError } = await supabase
    .from('companies')
    .update({ reference_credits: newBalance })
    .eq('id', companyId);

  if (updateError) {
    throw new Error(`Failed to update credit balance: ${updateError.message}`);
  }

  // Log the transaction
  const { data: transaction, error: transactionError } = await supabase
    .from('credit_transactions')
    .insert({
      company_id: companyId,
      type,
      credits_change: credits,
      credits_balance_after: newBalance,
      amount_gbp: metadata?.amount_gbp,
      stripe_payment_intent_id: metadata?.stripe_payment_intent_id,
      stripe_charge_id: metadata?.stripe_charge_id,
      description,
      created_by: userId,
    })
    .select()
    .single();

  if (transactionError) {
    throw new Error(`Failed to log credit transaction: ${transactionError.message}`);
  }

  return transaction;
}

// ============================================================================
// CREDIT DEDUCTIONS
// ============================================================================

/**
 * Deduct credits from a company's balance
 * Used when creating a reference or other operations (e.g., AML checks)
 */
export async function deductCredits(
  companyId: string,
  credits: number,
  referenceId: string | null,
  description: string,
  userId?: string
): Promise<CreditTransaction> {
  // Fetch current balance
  const { data: company, error: fetchError } = await supabase
    .from('companies')
    .select('reference_credits')
    .eq('id', companyId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch company: ${fetchError.message}`);
  }

  const currentCredits = company.reference_credits || 0;

  // Check if enough credits
  if (currentCredits < credits) {
    throw new Error(`Insufficient credits. Required: ${credits}, Available: ${currentCredits}`);
  }

  const newBalance = currentCredits - credits;

  // Update company credits
  const { error: updateError } = await supabase
    .from('companies')
    .update({ reference_credits: newBalance })
    .eq('id', companyId);

  if (updateError) {
    throw new Error(`Failed to deduct credits: ${updateError.message}`);
  }

  // Log the transaction
  const { data: transaction, error: transactionError } = await supabase
    .from('credit_transactions')
    .insert({
      company_id: companyId,
      type: 'credit_used',
      credits_change: -credits,
      credits_balance_after: newBalance,
      reference_id: referenceId,
      description,
      created_by: userId,
    })
    .select()
    .single();

  if (transactionError) {
    throw new Error(`Failed to log credit deduction: ${transactionError.message}`);
  }

  // Check if auto-recharge should trigger
  await checkAutoRecharge(companyId, newBalance);

  return transaction;
}

/**
 * Refund credits back to a company (e.g., if reference creation failed)
 */
export async function refundCredits(
  companyId: string,
  credits: number,
  referenceId: string,
  description: string,
  userId?: string
): Promise<CreditTransaction> {
  return await addCredits(
    companyId,
    credits,
    'refund',
    description,
    userId,
    { amount_gbp: 0 }
  );
}

// ============================================================================
// AUTO-RECHARGE
// ============================================================================

/**
 * Check if auto-recharge should be triggered
 * Called after every credit deduction
 */
async function checkAutoRecharge(companyId: string, currentBalance: number): Promise<void> {
  // Fetch company auto-recharge settings
  const { data: company, error } = await supabase
    .from('companies')
    .select('auto_recharge_enabled, auto_recharge_threshold, auto_recharge_pack_size, stripe_customer_id')
    .eq('id', companyId)
    .single();

  if (error || !company) {
    return; // Silently fail - auto-recharge is optional
  }

  const {
    auto_recharge_enabled,
    auto_recharge_threshold,
    auto_recharge_pack_size,
    stripe_customer_id
  } = company;

  // Check if auto-recharge conditions are met
  if (
    auto_recharge_enabled &&
    currentBalance <= (auto_recharge_threshold || 5) &&
    stripe_customer_id
  ) {
    try {
      // Import billing service to avoid circular dependency
      const { purchaseCreditPackAutoRecharge } = await import('./billingService');
      await purchaseCreditPackAutoRecharge(companyId, auto_recharge_pack_size || 25);
    } catch (error: any) {
      console.error(`Auto-recharge failed for company ${companyId}:`, error.message);
      // TODO: Send email notification about failed auto-recharge
    }
  }
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

/**
 * Get transaction history for a company
 */
export async function getTransactionHistory(
  companyId: string,
  limit: number = 50,
  offset: number = 0,
  type?: string
): Promise<{ transactions: CreditTransaction[]; total: number }> {
  let query = supabase
    .from('credit_transactions')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch transaction history: ${error.message}`);
  }

  return {
    transactions: data || [],
    total: count || 0,
  };
}

/**
 * Get a single transaction by ID
 */
export async function getTransaction(transactionId: string): Promise<CreditTransaction> {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch transaction: ${error.message}`);
  }

  return data;
}

// ============================================================================
// STATISTICS & REPORTING
// ============================================================================

/**
 * Get credit usage statistics for a company
 */
export async function getCreditStats(
  companyId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  total_purchased: number;
  total_used: number;
  current_balance: number;
  total_spent_gbp: number;
}> {
  let query = supabase
    .from('credit_transactions')
    .select('type, credits_change, amount_gbp')
    .eq('company_id', companyId);

  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch credit stats: ${error.message}`);
  }

  const stats = {
    total_purchased: 0,
    total_used: 0,
    current_balance: 0,
    total_spent_gbp: 0,
  };

  data?.forEach((transaction) => {
    if (transaction.credits_change > 0) {
      stats.total_purchased += transaction.credits_change;
      if (transaction.amount_gbp) {
        stats.total_spent_gbp += transaction.amount_gbp;
      }
    } else {
      stats.total_used += Math.abs(transaction.credits_change);
    }
  });

  // Get current balance
  const balance = await getCreditBalance(companyId);
  stats.current_balance = balance.credits;

  return stats;
}

/**
 * Get monthly credit usage for reporting
 */
export async function getMonthlyUsage(
  companyId: string,
  months: number = 6
): Promise<Array<{ month: string; purchased: number; used: number }>> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('type, credits_change, created_at')
    .eq('company_id', companyId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch monthly usage: ${error.message}`);
  }

  // Group by month
  const monthlyData: Record<string, { purchased: number; used: number }> = {};

  data?.forEach((transaction) => {
    const month = new Date(transaction.created_at).toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyData[month]) {
      monthlyData[month] = { purchased: 0, used: 0 };
    }

    if (transaction.credits_change > 0) {
      monthlyData[month].purchased += transaction.credits_change;
    } else {
      monthlyData[month].used += Math.abs(transaction.credits_change);
    }
  });

  // Convert to array
  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    ...data,
  }));
}
