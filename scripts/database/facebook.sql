-- Additive migration; does not change existing dashboard or backend tables.
CREATE TABLE IF NOT EXISTS dashboard_facebook_connections (
  owner_key TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  credentials TEXT NOT NULL,
  facebook_user_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  page_id TEXT,
  page_name TEXT,
  page_token TEXT,
  form_id TEXT,
  form_name TEXT,
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dashboard_facebook_oauth_attempts (
  id UUID PRIMARY KEY,
  owner_key TEXT NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  browser_hash TEXT NOT NULL,
  credentials TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dashboard_facebook_oauth_expiry
  ON dashboard_facebook_oauth_attempts (expires_at);
CREATE TABLE IF NOT EXISTS dashboard_facebook_leads (
  owner_key TEXT NOT NULL REFERENCES dashboard_facebook_connections(owner_key) ON DELETE CASCADE,
  lead_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  created_time TIMESTAMPTZ NOT NULL,
  fields JSONB NOT NULL,
  PRIMARY KEY (owner_key, lead_id)
);
CREATE INDEX IF NOT EXISTS dashboard_facebook_leads_form
  ON dashboard_facebook_leads (owner_key, page_id, form_id, created_time DESC);
