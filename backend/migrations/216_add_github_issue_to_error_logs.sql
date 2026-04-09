-- Add GitHub issue tracking columns to error_logs
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS github_issue_number INTEGER;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS github_issue_url TEXT;

CREATE INDEX IF NOT EXISTS idx_error_logs_github_issue
  ON error_logs(github_issue_number) WHERE github_issue_number IS NOT NULL;
