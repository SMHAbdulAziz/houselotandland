-- D1 table for private money loan applications (POST /api/loan). Applied to hll-leads through the Cloudflare connector.
CREATE TABLE IF NOT EXISTS loan_apps (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,            -- PM-XXXXX, shown to the applicant
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',  -- new, reviewing, docs, submitted, approved, funded, declined, withdrawn, test
  loan_type TEXT,
  property_address TEXT,
  property_state TEXT,
  borrower_name TEXT,
  borrower_email TEXT,
  borrower_phone TEXT,
  arv REAL, purchase_price REAL, rehab REAL,
  loan_amount REAL, net_profit REAL, eligible INTEGER,
  data TEXT NOT NULL,                  -- everything the applicant entered (JSON)
  analysis TEXT,                       -- analyzeFlip() result (JSON); the desk re-runs it when Harvey changes the broker fee
  broker_fee_pct REAL,
  checklist TEXT,                      -- desk: {"<document name>": "YYYY-MM-DD collected"} (JSON)
  desk_notes TEXT,
  lender TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  consent_text TEXT,
  notified_at TEXT,                    -- hourly task sent the applicant confirmation + Harvey alert
  ip_hash TEXT, user_agent TEXT, country TEXT
);
CREATE INDEX IF NOT EXISTS loan_apps_status ON loan_apps(status, created_at);
CREATE INDEX IF NOT EXISTS loan_apps_ip ON loan_apps(ip_hash, created_at);
