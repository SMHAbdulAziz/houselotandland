-- Bird-Dog Program (bird-dog.html, bird-dog-portal.html, src/birddog.js): people who refer verified motivated sellers
-- and earn a flat $500 when the deal funds. Apply one statement at a time (the Cloudflare connector runs one per call).

CREATE TABLE IF NOT EXISTS birddogs (
  id TEXT PRIMARY KEY, ref TEXT, token TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT, phone_key TEXT, email TEXT, city TEXT, zip TEXT,
  lang TEXT DEFAULT 'en', status TEXT NOT NULL DEFAULT 'active', licensed INTEGER DEFAULT 0, broker TEXT,
  terms_version TEXT, terms_at TEXT, w9 TEXT DEFAULT 'not requested', w9_at TEXT, pay_method TEXT,
  consent INTEGER DEFAULT 0, consent_text TEXT, notes TEXT, ip_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS birddogs_phone ON birddogs (phone_key);
CREATE TABLE IF NOT EXISTS birddog_leads (
  id TEXT PRIMARY KEY, ref TEXT, birddog_id TEXT NOT NULL, addr_key TEXT NOT NULL, address TEXT, city TEXT, state TEXT, zip TEXT, prop_type TEXT,
  owner_name TEXT, owner_phone TEXT, owner_email TEXT, relation TEXT, motivation TEXT, situation TEXT, asking REAL, spoke_on TEXT, owner_ok INTEGER,
  photos INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'submitted', reason TEXT, track TEXT, property_id TEXT, deal_id TEXT,
  payout REAL DEFAULT 500, verified_at TEXT, funded_at TEXT, paid_at TEXT, pay_method TEXT, pay_note TEXT, office_notes TEXT,
  ip_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS birddog_leads_claim ON birddog_leads (addr_key) WHERE status != 'rejected';
CREATE INDEX IF NOT EXISTS birddog_leads_dog ON birddog_leads (birddog_id, created_at);
CREATE INDEX IF NOT EXISTS birddog_leads_status ON birddog_leads (status);
CREATE TABLE IF NOT EXISTS birddog_photos (
  id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, n INTEGER, mime TEXT, data TEXT NOT NULL, bytes INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS birddog_photos_lead ON birddog_photos (lead_id, n);
