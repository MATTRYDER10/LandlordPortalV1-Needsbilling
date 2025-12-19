-- Migration 123: Add chase exhausted reason code
-- Adds a reason code for when a reference chase has been exhausted (no response after 3 cycles)

INSERT INTO action_reason_codes (code, display_label, default_agent_message, section_types, display_order) VALUES
('CHASE_EXHAUSTED', 'Reference Not Responding', 'We have been unable to reach the reference after multiple attempts. Please provide alternative contact details or a different reference.', ARRAY['INCOME', 'RESIDENTIAL'], 30)
ON CONFLICT (code) DO NOTHING;
