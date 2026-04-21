CREATE TABLE chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL CHECK (user_type IN ('agent', 'tenant', 'guarantor', 'staff')),
  user_identifier text,
  company_id uuid REFERENCES companies(id),
  reference_id uuid,
  offer_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting_for_human', 'human_joined', 'closed', 'message_left')),
  escalation_reason text,
  human_staff_token text UNIQUE,
  human_staff_id uuid,
  human_joined_at timestamptz,
  conversation_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'human')),
  content text NOT NULL,
  tool_calls jsonb,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_conversations_status ON chat_conversations(status) WHERE status IN ('active', 'waiting_for_human');
CREATE INDEX idx_chat_conversations_staff_token ON chat_conversations(human_staff_token) WHERE human_staff_token IS NOT NULL;
CREATE INDEX idx_chat_conversations_company ON chat_conversations(company_id) WHERE company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_chat_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chat_conversation_updated
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_conversation_timestamp();
