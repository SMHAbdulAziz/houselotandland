// Automatic searches: which scheduled searches run, which pulls each may make, and per-run limits.
// Harvey sets this on the back office Settings tab (owner only). The scheduled tasks read GET /api/automation first
// and skip anything turned off. Stored as JSON in settings.automation. BatchData pulls also need batchdata_allowed.
export const SEARCHES = {
  subto: { name: "Sub-To Lead Search", when: "Mondays, 6:44 AM", dashboard: "Sub-To Pipeline",
    pulls: {
      web: { label: "Web and public-record search (listings, trustee-sale notices, probate citations)", cost: "free" },
      batchdata_search: { label: "BatchData property search (expired, pre-foreclosure, inherited lists)", cost: "batchdata" },
      batchdata_enrich: { label: "BatchData skip trace and property lookup on each new lead (owner phone/email, loan, value)", cost: "batchdata" },
    },
    limits: { max_records: { label: "BatchData search results per run", def: 40, max: 200 }, max_enrich: { label: "Leads enriched per run", def: 30, max: 100 } } },
  creative: { name: "Creative Finance Lead Search", when: "Wednesdays, 5:13 AM", dashboard: "Creative Finance Tracker",
    pulls: {
      web: { label: "Web search for listings that offer seller financing", cost: "free" },
      batchdata_search: { label: "BatchData search for free-and-clear owners", cost: "batchdata" },
      batchdata_enrich: { label: "BatchData skip traces on the strongest owners", cost: "batchdata" },
    },
    limits: { max_records: { label: "BatchData search results per run", def: 30, max: 200 }, max_enrich: { label: "Skip traces per run", def: 10, max: 100 } } },
  struckoff: { name: "Struck-off tax property scan", when: "Tuesdays, 6:31 AM", dashboard: "Deal Desk (parcels under the OTC buy-box price go to the OTC Tax Parcel Finder)",
    pulls: { web: { label: "County struck-off and tax resale lists", cost: "free" } }, limits: {} },
  otc: { name: "OTC tax parcel scan", when: "Thursdays, 6:17 AM", dashboard: "OTC Tax Parcel Finder",
    pulls: {
      web: { label: "County over-the-counter tax deed, tax lien and Texas struck-off lists", cost: "free" },
      flood: { label: "FEMA flood-zone check on each new parcel", cost: "free" },
      batchdata_enrich: { label: "BatchData lien and comps check on the best new parcels (about 2 pulls each)", cost: "batchdata", def: false },
    },
    limits: { max_enrich: { label: "Parcels checked with BatchData per run", def: 5, max: 50 } } },
  bids: { name: "Texas power-washing bid scan", when: "Daily except Saturday, 5:31 AM", dashboard: "Power-Washing Bid Leads",
    pulls: { web: { label: "Government bid sites and award notices", cost: "free" } }, limits: {} },
};

export function defaults() {
  const s = {};
  for (const [k, d] of Object.entries(SEARCHES))
    s[k] = { on: d.defOn !== false, pulls: Object.fromEntries(Object.entries(d.pulls).map(([p, pd]) => [p, pd.def !== false])), limits: Object.fromEntries(Object.entries(d.limits).map(([l, v]) => [l, v.def])) };
  return { batchdata_allowed: true, searches: s };
}

/** Clean a config from the page: only known keys, numbers clamped. */
export function sanitize(input, base) {
  const out = defaults(), cur = base || out;
  out.batchdata_allowed = typeof input?.batchdata_allowed === "boolean" ? input.batchdata_allowed : cur.batchdata_allowed;
  for (const [k, d] of Object.entries(SEARCHES)) {
    const i = input?.searches?.[k] || {}, c = cur.searches?.[k] || out.searches[k];
    out.searches[k].on = typeof i.on === "boolean" ? i.on : !!c.on;
    for (const p of Object.keys(d.pulls)) out.searches[k].pulls[p] = typeof i.pulls?.[p] === "boolean" ? i.pulls[p] : c.pulls?.[p] !== false;
    for (const [l, v] of Object.entries(d.limits)) {
      const n = Math.round(Number(i.limits?.[l] ?? c.limits?.[l] ?? v.def));
      out.searches[k].limits[l] = Number.isFinite(n) ? Math.max(0, Math.min(v.max, n)) : v.def;
    }
  }
  return out;
}

/** Stored config, or one built from the older single switch (settings.auto_lead_search). */
export async function loadAutomation(db) {
  const rows = (await db.prepare("SELECT key, value, updated_at FROM settings WHERE key IN ('automation', 'auto_lead_search')").all()).results;
  const get = (k) => rows.find((r) => r.key === k);
  const a = get("automation");
  if (a) { try { return { cfg: sanitize(JSON.parse(a.value)), updated_at: a.updated_at }; } catch {} }
  const cfg = defaults(), old = get("auto_lead_search");
  if (old && old.value !== "true") { cfg.batchdata_allowed = false; cfg.searches.subto.on = false; cfg.searches.creative.on = false; }
  return { cfg, updated_at: old ? old.updated_at : null };
}

export async function saveAutomation(db, cfg, t) {
  await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('automation', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(JSON.stringify(cfg), t).run();
}

/** What the scheduled tasks read: each search's on/off and the pulls it may make (BatchData pulls off when BatchData is paused). */
export function publicView(cfg, updated_at) {
  const searches = {};
  for (const [k, d] of Object.entries(SEARCHES)) {
    const s = cfg.searches[k], pulls = {};
    for (const [p, pd] of Object.entries(d.pulls)) pulls[p] = !!(s.on && s.pulls[p] && (pd.cost !== "batchdata" || cfg.batchdata_allowed));
    searches[k] = { name: d.name, run: !!s.on && Object.values(pulls).some(Boolean), status: s.on ? "ON" : "OFF", pulls, limits: s.limits };
  }
  return { updated_at, batchdata_allowed: cfg.batchdata_allowed, searches,
    auto_lead_search: searches.subto.run || searches.creative.run }; // older task prompts read this
}
