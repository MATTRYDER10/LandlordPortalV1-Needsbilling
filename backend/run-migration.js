// Run database migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/add_missing_comparison_fields.sql'),
      'utf8'
    );

    console.log('Running migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('Added fields:');
    console.log('  - previous_monthly_rent_encrypted');
    console.log('  - previous_tenancy_start_date');
    console.log('  - previous_tenancy_end_date');
    console.log('  - previous_agency_name_encrypted');
    console.log('  - employment_end_date');
    console.log('  - employment_salary_frequency');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

runMigration();
