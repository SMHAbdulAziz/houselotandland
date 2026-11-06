-- D1 tables for the service orders (src/services.js). Applied to hll-leads through the Cloudflare connector.
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,              -- SV-XXXXX, shown to the customer
  token TEXT NOT NULL UNIQUE,            -- private order link /order/<token>
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  service TEXT NOT NULL,                 -- homestead | curb | contracts | watch
  item TEXT, label TEXT,                 -- package / document type / plan / frequency
  status TEXT NOT NULL,                  -- waitlist, awaiting_payment, paid, active, past_due, delivered, requested, scheduled, in_progress, completed, quote_requested, quoted, won, lost, cancelled, test
  name TEXT, email TEXT, phone TEXT, company TEXT, property_address TEXT,
  answers TEXT,                          -- questionnaire answers (JSON)
  extra TEXT,                            -- add-ons, Property Watch estimate (JSON)
  amount REAL, mode TEXT, amount_paid REAL,
  stripe_session TEXT, stripe_customer TEXT, stripe_subscription TEXT, paid_at TEXT, delivered_at TEXT,
  appointment_at TEXT, crew TEXT, labor_cost REAL, labor_paid_at TEXT, quote_amount REAL, desk_notes TEXT,
  consent INTEGER NOT NULL DEFAULT 0, consent_text TEXT,
  notified_at TEXT,                      -- hourly task sent the confirmation + alert
  ip_hash TEXT, user_agent TEXT
);
CREATE INDEX IF NOT EXISTS service_requests_status ON service_requests(service, status, created_at);
CREATE INDEX IF NOT EXISTS service_requests_ip ON service_requests(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS service_requests_sub ON service_requests(stripe_subscription);
CREATE TABLE IF NOT EXISTS service_docs (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL, doc_type TEXT NOT NULL, title TEXT, answers TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS service_docs_req ON service_docs(request_id, created_at);
