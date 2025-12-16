-- Migration 121: Add re-referencing reason codes
-- Adds specific reason codes for ACTION_REQUIRED that enable re-referencing workflow

INSERT INTO action_reason_codes (code, display_label, default_agent_message, section_types, display_order) VALUES
('NEW_ID_REQUIRED', 'New ID Document Required', 'Please upload a new, valid ID document.', ARRAY['IDENTITY_SELFIE'], 20),
('PAYSLIPS_REQUIRED', 'Payslips Required', 'Please upload recent payslips to verify your income.', ARRAY['INCOME'], 21),
('PROOF_OF_ADDRESS', 'Proof of Address Required', 'Please upload a document showing your current address.', ARRAY['RESIDENTIAL'], 22),
('BANK_STATEMENT', 'Bank Statement Required', 'Please upload a recent bank statement.', ARRAY['INCOME'], 23),
('TENANCY_AGREEMENT', 'Tenancy Agreement Required', 'Please upload your current tenancy agreement.', ARRAY['RESIDENTIAL'], 24),
('NEW_EMPLOYER_REF', 'New Employer Reference Required', 'Please provide updated employer details for a new reference.', ARRAY['INCOME'], 25),
('NEW_LANDLORD_REF', 'New Landlord Reference Required', 'Please provide updated landlord details for a new reference.', ARRAY['RESIDENTIAL'], 26),
('NEW_ACCOUNTANT_REF', 'New Accountant Reference Required', 'Please provide updated accountant details for a new reference.', ARRAY['INCOME'], 27)
ON CONFLICT (code) DO NOTHING;
