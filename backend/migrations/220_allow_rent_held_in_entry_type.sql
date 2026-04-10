ALTER TABLE client_account_entries
  DROP CONSTRAINT IF EXISTS client_account_entries_entry_type_check;

ALTER TABLE client_account_entries
  ADD CONSTRAINT client_account_entries_entry_type_check
  CHECK (entry_type IN (
    'rent_in',
    'initial_monies_rent_in',
    'rent_held_in',
    'deposit_in',
    'deposit_out',
    'holding_deposit_in',
    'invoice_fee_in',
    'payout_out',
    'contractor_payout_out',
    'manual_credit',
    'manual_debit',
    'opening_balance'
  ));
