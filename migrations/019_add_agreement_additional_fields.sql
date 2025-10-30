-- Add additional fields to agreements table for rent due day, deposit scheme type, and permitted occupiers

ALTER TABLE agreements
ADD COLUMN rent_due_day VARCHAR(20),
ADD COLUMN deposit_scheme_type VARCHAR(50),
ADD COLUMN permitted_occupiers TEXT;

-- Add comment to explain these fields
COMMENT ON COLUMN agreements.rent_due_day IS 'Day of month when rent is due (e.g., 1st, 15th, Last)';
COMMENT ON COLUMN agreements.deposit_scheme_type IS 'Type of deposit scheme (Custodial or Insured)';
COMMENT ON COLUMN agreements.permitted_occupiers IS 'Names of permitted occupiers who may live at property but are not tenants';
