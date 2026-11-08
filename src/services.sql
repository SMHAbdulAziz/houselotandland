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
-- Every payment received for a service order: Stripe checkouts, subscription invoices (renewals) and manual
-- payments Harvey records in the back office (cash, Zelle, check). Revenue reports read this table; test = 1 is excluded.
CREATE TABLE IF NOT EXISTS service_payments (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL, at TEXT NOT NULL, amount REAL NOT NULL,
  kind TEXT NOT NULL,                    -- checkout | invoice | manual | refund
  method TEXT, stripe_id TEXT UNIQUE, note TEXT, test INTEGER NOT NULL DEFAULT 0, by TEXT
);
CREATE INDEX IF NOT EXISTS service_payments_at ON service_payments(at);
CREATE INDEX IF NOT EXISTS service_payments_req ON service_payments(request_id);
-- Texts the back office queued through the House Lot & Land messaging gateway (Android, queue-only: Harvey releases each one).
CREATE TABLE IF NOT EXISTS outbound_texts (
  id TEXT PRIMARY KEY, at TEXT NOT NULL, to_phone TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT, template TEXT NOT NULL, lang TEXT,
  status TEXT NOT NULL, bridge_id TEXT, error TEXT, by TEXT
);
CREATE INDEX IF NOT EXISTS outbound_texts_ref ON outbound_texts(kind, ref_id, at);
