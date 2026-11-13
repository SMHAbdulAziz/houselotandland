-- Master list ("hub") for House Lot & Land: one row per property and per contact, one deal per property per track.
-- Keys come from js/hub-keys.js. Apply one statement at a time (the Cloudflare connector runs one per call).

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY, addr_key TEXT NOT NULL UNIQUE, name TEXT, address TEXT, city TEXT, state TEXT DEFAULT 'TX', zip TEXT, county TEXT,
  prop_type TEXT, units INTEGER, beds REAL, baths REAL, sqft INTEGER, acres REAL, lat REAL, lng REAL,
  data TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY, name TEXT, phone_key TEXT, phone TEXT, email TEXT, phones TEXT, emails TEXT, mailing TEXT, lang TEXT DEFAULT 'en',
  consent INTEGER DEFAULT 0, consent_json TEXT, opt_out INTEGER DEFAULT 0, litigator INTEGER DEFAULT 0, company TEXT, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contacts_phone ON contacts (phone_key);
CREATE INDEX IF NOT EXISTS contacts_email ON contacts (email);
CREATE TABLE IF NOT EXISTS property_contacts (
  property_id TEXT NOT NULL, contact_id TEXT NOT NULL, role TEXT DEFAULT 'owner', created_at TEXT NOT NULL,
  PRIMARY KEY (property_id, contact_id)
);
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY, property_id TEXT NOT NULL, contact_id TEXT, track TEXT NOT NULL, stage TEXT NOT NULL, ref TEXT,
  next_touch TEXT, source TEXT, source_app TEXT, source_id TEXT, asking REAL, value REAL, data TEXT, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (property_id, track)
);
CREATE INDEX IF NOT EXISTS deals_track ON deals (track, stage);
CREATE INDEX IF NOT EXISTS deals_touch ON deals (next_touch);
CREATE INDEX IF NOT EXISTS deals_source ON deals (source_app, source_id);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY, at TEXT NOT NULL, property_id TEXT, contact_id TEXT, deal_id TEXT, kind TEXT NOT NULL, summary TEXT, by TEXT, source TEXT
);
CREATE INDEX IF NOT EXISTS activities_property ON activities (property_id, at);
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY, ref TEXT, name TEXT NOT NULL, phone TEXT, phone_key TEXT, email TEXT, city TEXT, zip TEXT, lang TEXT DEFAULT 'en',
  kind TEXT DEFAULT 'contractor', trades TEXT, equipment TEXT, availability TEXT, experience TEXT, rate_note TEXT,
  status TEXT NOT NULL DEFAULT 'applied', agreement_at TEXT, insurance_exp TEXT, w9 TEXT DEFAULT 'not requested', w9_at TEXT,
  consent INTEGER DEFAULT 0, consent_text TEXT, notes TEXT, notified_at TEXT, ip_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workers_status ON workers (status);
CREATE TABLE IF NOT EXISTS worker_jobs (
  id TEXT PRIMARY KEY, worker_id TEXT NOT NULL, service_request_id TEXT, deal_id TEXT, title TEXT, work_date TEXT, hours REAL,
  pay REAL, paid_at TEXT, pay_method TEXT, status TEXT DEFAULT 'scheduled', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS worker_jobs_worker ON worker_jobs (worker_id, work_date);
CREATE TABLE IF NOT EXISTS hub_imports (
  id TEXT PRIMARY KEY, at TEXT NOT NULL, source TEXT, file TEXT, rows INTEGER, added INTEGER, merged INTEGER, skipped INTEGER, notes TEXT
);

-- Deals removed from the master list (back office or a dashboard). Dashboards read this to drop their copy.
CREATE TABLE IF NOT EXISTS deleted_deals (
  deal_id TEXT PRIMARY KEY, property_id TEXT, track TEXT, source_app TEXT, source_id TEXT, label TEXT, at TEXT NOT NULL, by TEXT
);
CREATE INDEX IF NOT EXISTS deleted_deals_track ON deleted_deals (track, at);
