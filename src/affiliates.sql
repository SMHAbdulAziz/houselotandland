-- Affiliates (private referral partners, not marketed): added by Harvey in the back office (Affiliates tab).
-- Separate from workers/crews. Paid a flat $2,500 per deal we close from their referral (referrals.payout).
-- A referral is created when the homepage cash-offer form names a referrer (an affiliate, or "Other" + a name),
-- or by hand in the back office. Apply one statement at a time (the Cloudflare connector runs one per call).

CREATE TABLE IF NOT EXISTS affiliates (
  id TEXT PRIMARY KEY, ref TEXT, name TEXT NOT NULL, phone TEXT, phone_key TEXT, email TEXT, city TEXT, company TEXT,
  status TEXT NOT NULL DEFAULT 'active', on_site INTEGER NOT NULL DEFAULT 1, licensed INTEGER DEFAULT 0, broker TEXT,
  w9 TEXT DEFAULT 'not requested', w9_at TEXT, pay_method TEXT, agreement_at TEXT, lang TEXT DEFAULT 'en',
  consent INTEGER DEFAULT 0, consent_text TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS affiliates_status ON affiliates (status, name);
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY, ref TEXT, lead_id TEXT, lead_ref TEXT, affiliate_id TEXT, other_name TEXT,
  seller_name TEXT, seller_phone TEXT, property_address TEXT, addr_key TEXT,
  status TEXT NOT NULL DEFAULT 'open', payout REAL, closed_on TEXT, paid_on TEXT, pay_method TEXT, pay_note TEXT,
  void_reason TEXT, notes TEXT, source TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS referrals_aff ON referrals (affiliate_id, created_at);
CREATE INDEX IF NOT EXISTS referrals_status ON referrals (status);
CREATE INDEX IF NOT EXISTS referrals_key ON referrals (addr_key);
-- leads columns (added Nov 13, 2026): referrer_type ('affiliate' | 'other'), referrer_id, referrer_name
ALTER TABLE leads ADD COLUMN referrer_type TEXT;
ALTER TABLE leads ADD COLUMN referrer_id TEXT;
ALTER TABLE leads ADD COLUMN referrer_name TEXT;
