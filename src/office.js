// Back office for House Lot & Land: houselotandland.org/office (page) and /api/office/* (data).
// Only people Cloudflare Access lets in can reach it: the Worker re-checks the Access token on every request.
// Needs vars ACCESS_TEAM_DOMAIN (e.g. "houselotandland.cloudflareaccess.com") and ACCESS_AUD (the Access app's
// audience tag) in wrangler.jsonc; optional OFFICE_EMAILS (comma list) narrows it further. Until both are set
// the back office stays locked. For local testing only, OFFICE_DEV=1 in .dev.vars skips the check.
//
// Data: the "hub" tables (src/hub.sql). Matching keys come from js/hub-keys.js so nothing is duplicated:
// one property per address, one contact per phone/email, one deal per property per track.

import { propertyKey, phoneKey, emailKey, fmtPhone, splitAddr, normState, zipState, TRACKS, CLOSED_STAGES } from "../js/hub-keys.js";
import { CURB, CURB_QUOTE } from "../js/services-catalog.js";
import { recordPayment, isTestOrder } from "./services.js";
import { isShabbatDate } from "../js/shabbat.js";

const JSONH = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: JSONH });
const now = () => new Date().toISOString();
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const ID_ALPHA = "abcdefghijkmnpqrstuvwxyz23456789";
export const newId = (p) => p + "_" + Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => ID_ALPHA[x % ID_ALPHA.length]).join("");
const clean = (v, max = 500) => (v == null ? null : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) || null);
const num = (v) => (v === "" || v == null || !isFinite(Number(v)) ? null : Number(v));
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// ---------------- Cloudflare Access ----------------
let certs = null, certsAt = 0;
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
export async function officeUser(request, env) {
  if (env.OFFICE_DEV === "1") return { email: "dev@localhost" };
  const team = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  if (!team || !aud) return { setup: true };
  const cookie = (request.headers.get("cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const token = request.headers.get("cf-access-jwt-assertion") || (cookie && cookie[1]);
  if (!token) return null;
  try {
    const [h, p, s] = token.split(".");
    const head = JSON.parse(new TextDecoder().decode(b64u(h))), body = JSON.parse(new TextDecoder().decode(b64u(p)));
    if (!certs || Date.now() - certsAt > 3600e3) { certs = (await (await fetch(`https://${team}/cdn-cgi/access/certs`)).json()).keys || []; certsAt = Date.now(); }
    const jwk = certs.find((k) => k.kid === head.kid);
    if (!jwk || head.alg !== "RS256") return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(s), new TextEncoder().encode(`${h}.${p}`));
    const auds = Array.isArray(body.aud) ? body.aud : [body.aud];
    if (!ok || !auds.includes(aud) || body.iss !== `https://${team}` || !(body.exp * 1000 > Date.now())) return null;
    const email = String(body.email || "").toLowerCase();
    const allow = String(env.OFFICE_EMAILS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
    if (allow.length && !allow.includes(email)) return null;
    return { email };
  } catch { return null; }
}
const LOCKED = (title, msg) => new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>${title}</title>
<body style="font:16px/1.6 system-ui,sans-serif;background:#f1f5f9;color:#1e293b;margin:0"><main style="max-width:560px;margin:12vh auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 10px 30px -12px #0f172a33">
<h1 style="margin:0 0 8px;font:700 1.4rem Georgia,serif">${title}</h1><p>${msg}</p></main>`, { status: 403, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

/** /office and /office/* : the back-office page and its files, after the Access check. */
export async function handleOfficePage(request, env, url) {
  const u = await officeUser(request, env);
  if (u && u.setup) return LOCKED("Back office locked", "The back office opens once Cloudflare Access is set up for houselotandland.org/office. Nothing here is public.");
  if (!u) return LOCKED("Not signed in", "Sign in through Cloudflare Access to open the back office.");
  if (url.pathname === "/office") return Response.redirect(url.origin + "/office/", 302);
  const res = await env.ASSETS.fetch(new Request(new URL(url.pathname, url.origin), request));
  const h = new Headers(res.headers); h.set("cache-control", "no-store"); h.set("x-robots-tag", "noindex");
  return new Response(res.body, { status: res.status, headers: h });
}

// ---------------- matching / upserts (also used by the worker apply form and imports) ----------------
export async function upsertProperty(db, p, t = now()) {
  // A whole address typed or imported into one field ("123 Main St, Dallas, TX 75201") is split first, so it keys like the rest.
  if (p.address && String(p.address).includes(",") && !p.city) { const a = splitAddr(p.address); p = { ...p, address: a.address, city: a.city, zip: p.zip || a.zip, state: p.state || a.state }; }
  // State: as given, else from the ZIP code, else Texas (home market).
  p = { ...p, state: normState(p.state) || zipState(p.zip) || "TX" };
  const key = propertyKey(p);
  if (!key) throw new Error("A property needs a street address, or a name and city.");
  const ex = await db.prepare("SELECT * FROM properties WHERE addr_key = ?").bind(key).first();
  const f = { name: clean(p.name, 160), address: clean(p.address, 200), city: clean(p.city, 80), zip: clean(p.zip, 10), county: clean(p.county, 40), state: p.state,
    prop_type: clean(p.prop_type, 40), units: num(p.units), beds: num(p.beds), baths: num(p.baths), sqft: num(p.sqft), acres: num(p.acres), lat: num(p.lat), lng: num(p.lng) };
  if (ex) {
    const set = [], vals = [];
    for (const [k, v] of Object.entries(f)) if (k !== "state" && v != null && (ex[k] == null || ex[k] === "")) { set.push(`${k} = ?`); vals.push(v); }
    if (f.state !== "TX" && (!ex.state || ex.state === "TX")) { set.push("state = ?"); vals.push(f.state); } // the column defaults to TX, so a real out-of-state value wins
    if (p.data) { set.push("data = ?"); vals.push(JSON.stringify({ ...(parse(ex.data) || {}), ...p.data })); }
    if (set.length) await db.prepare(`UPDATE properties SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, ex.id).run();
    return { id: ex.id, merged: true };
  }
  const id = newId("p");
  await db.prepare(`INSERT INTO properties (id, addr_key, name, address, city, zip, state, county, prop_type, units, beds, baths, sqft, acres, lat, lng, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, key, f.name, f.address, f.city, f.zip, f.state, f.county, f.prop_type, f.units, f.beds, f.baths, f.sqft, f.acres, f.lat, f.lng,
    p.data ? JSON.stringify(p.data) : null, t, t).run();
  return { id, merged: false };
}
export async function upsertContact(db, c, t = now()) {
  const pk = phoneKey(c.phone), ek = emailKey(c.email), name = clean(c.name, 160);
  if (!pk && !ek && !name) return null;
  let ex = pk ? await db.prepare("SELECT * FROM contacts WHERE phone_key = ? LIMIT 1").bind(pk).first() : null;
  if (!ex && ek) ex = await db.prepare("SELECT * FROM contacts WHERE email = ? LIMIT 1").bind(ek).first();
  const f = { name, phone_key: pk || null, phone: pk ? fmtPhone(c.phone) : null, email: ek || null, mailing: clean(c.mailing, 300), lang: c.lang === "es" ? "es" : null, company: clean(c.company, 160) };
  if (ex) {
    const set = [], vals = [];
    for (const [k, v] of Object.entries(f)) if (v != null && (ex[k] == null || ex[k] === "")) { set.push(`${k} = ?`); vals.push(v); }
    if (c.consent === true && !ex.consent && !ex.opt_out) { set.push("consent = 1", "consent_json = ?"); vals.push(JSON.stringify(c.consent_json || { at: t })); }
    if (c.opt_out === true) set.push("opt_out = 1");
    if (c.litigator === true) set.push("litigator = 1");
    if (set.length) await db.prepare(`UPDATE contacts SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, ex.id).run();
    return { id: ex.id, merged: true };
  }
  const id = newId("c");
  await db.prepare(`INSERT INTO contacts (id, name, phone_key, phone, email, mailing, lang, consent, consent_json, opt_out, litigator, company, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, f.name, f.phone_key, f.phone, f.email, f.mailing, f.lang || "en", c.consent === true ? 1 : 0,
    c.consent === true ? JSON.stringify(c.consent_json || { at: t }) : null, c.opt_out === true ? 1 : 0, c.litigator === true ? 1 : 0, f.company, clean(c.notes, 2000), t, t).run();
  return { id, merged: false };
}
export async function linkContact(db, propertyId, contactId, role = "owner", t = now()) {
  if (!propertyId || !contactId) return;
  await db.prepare("INSERT OR IGNORE INTO property_contacts (property_id, contact_id, role, created_at) VALUES (?, ?, ?, ?)").bind(propertyId, contactId, clean(role, 40) || "owner", t).run();
}
export async function upsertDeal(db, d, t = now()) {
  if (!TRACKS[d.track]) throw new Error("Unknown track.");
  const stage = TRACKS[d.track].stages.includes(d.stage) ? d.stage : TRACKS[d.track].stages[0];
  const ex = await db.prepare("SELECT * FROM deals WHERE property_id = ? AND track = ?").bind(d.property_id, d.track).first();
  if (ex) {
    const set = [], vals = [];
    for (const k of ["contact_id", "ref", "next_touch", "source", "source_app", "source_id"]) if (d[k] && !ex[k]) { set.push(`${k} = ?`); vals.push(clean(d[k], 200)); }
    for (const k of ["asking", "value"]) if (num(d[k]) != null && ex[k] == null) { set.push(`${k} = ?`); vals.push(num(d[k])); }
    if (set.length) await db.prepare(`UPDATE deals SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, ex.id).run();
    return { id: ex.id, merged: true };
  }
  const id = newId("d");
  await db.prepare(`INSERT INTO deals (id, property_id, contact_id, track, stage, ref, next_touch, source, source_app, source_id, asking, value, data, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, d.property_id, d.contact_id || null, d.track, stage, clean(d.ref, 20), clean(d.next_touch, 10), clean(d.source, 120),
    clean(d.source_app, 20), clean(d.source_id, 120), num(d.asking), num(d.value), d.data ? JSON.stringify(d.data) : null, clean(d.notes, 8000), t, t).run();
  return { id, merged: false };
}
export async function logActivity(db, a, t = now()) {
  await db.prepare("INSERT INTO activities (id, at, property_id, contact_id, deal_id, kind, summary, by, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(newId("a"), a.at || t, a.property_id || null, a.contact_id || null, a.deal_id || null, clean(a.kind, 30) || "note", clean(a.summary, 2000), clean(a.by, 120), clean(a.source, 40)).run();
}

// ---------------- API ----------------
const DEAL_SELECT = `SELECT d.*, p.address, p.name AS pname, p.city, p.zip, p.state, p.county, p.prop_type, p.units, p.beds, p.baths,
  c.name AS cname, c.phone AS cphone, c.email AS cemail, c.opt_out, c.litigator, c.consent,
  (SELECT GROUP_CONCAT(track) FROM deals d2 WHERE d2.property_id = d.property_id) AS tracks
  FROM deals d JOIN properties p ON p.id = d.property_id LEFT JOIN contacts c ON c.id = d.contact_id`;
const W_FIELDS = ["name", "phone", "email", "city", "zip", "lang", "kind", "rate_note", "status", "agreement_at", "insurance_exp", "w9", "notes", "experience"];
const W_STATUS = ["applied", "approved", "active", "inactive", "declined"];
const W9 = ["not requested", "requested", "received"];

export async function handleOfficeApi(request, env, url) {
  const u = await officeUser(request, env);
  if (!u || u.setup) return json({ ok: false, message: u && u.setup ? "Back office isn't set up yet." : "Not signed in." }, 401);
  const db = env.DB, path = url.pathname.replace(/^\/api\/office\/?/, ""), m = request.method, t = now();
  let b = {};
  if (m !== "GET") { try { b = await request.json(); } catch { return json({ ok: false, message: "Bad request." }, 400); } }
  const seg = path.split("/");
  try {
    if (m === "GET" && path === "summary") {
      const deals = (await db.prepare("SELECT track, stage, COUNT(*) AS n FROM deals GROUP BY track, stage").all()).results;
      const due = (await db.prepare(`${DEAL_SELECT} WHERE d.next_touch IS NOT NULL AND d.next_touch <= ? ORDER BY d.next_touch LIMIT 200`).bind(today()).all()).results
        .filter((r) => !CLOSED_STAGES.has(r.stage));
      const workers = (await db.prepare("SELECT status, COUNT(*) AS n FROM workers GROUP BY status").all()).results;
      const recent = (await db.prepare(`SELECT a.*, p.address, p.name AS pname FROM activities a LEFT JOIN properties p ON p.id = a.property_id ORDER BY a.at DESC LIMIT 15`).all()).results;
      const counts = (await db.prepare("SELECT (SELECT COUNT(*) FROM properties) AS properties, (SELECT COUNT(*) FROM contacts) AS contacts, (SELECT COUNT(*) FROM deals) AS deals").first());
      const openSvc = (await db.prepare("SELECT COUNT(*) AS n FROM service_requests WHERE status IN ('requested','quoted','paid','scheduled','quote_requested','awaiting_payment')").first()).n;
      await repairOneLineAddresses(db, t); // fixes one-line addresses from older imports the first time the overview opens
      const quoteNeeded = (await db.prepare("SELECT COUNT(*) AS n FROM service_requests WHERE service = 'curb' AND status IN ('requested','test') AND amount IS NULL AND paid_at IS NULL").first()).n;
      const newLoans = (await db.prepare("SELECT COUNT(*) AS n FROM loan_apps WHERE status IN ('new','reviewing')").first().catch(() => ({ n: 0 }))).n;
      return json({ ok: true, user: u.email, deals, due, workers, recent, counts, openSvc, quoteNeeded, newLoans, tracks: TRACKS, sales: await salesSummary(db) });
    }
    if (m === "GET" && path === "deals") {
      const w = [], v = [];
      if (TRACKS[url.searchParams.get("track")]) { w.push("d.track = ?"); v.push(url.searchParams.get("track")); }
      if (url.searchParams.get("stage")) { w.push("d.stage = ?"); v.push(url.searchParams.get("stage")); }
      if (url.searchParams.get("open") === "1") w.push(`d.stage NOT IN (${[...CLOSED_STAGES].map(() => "?").join(",")})`), v.push(...CLOSED_STAGES);
      const q = clean(url.searchParams.get("q"), 80);
      if (q) { w.push("(p.address LIKE ? OR p.name LIKE ? OR p.city LIKE ? OR c.name LIKE ? OR c.phone_key LIKE ? OR d.ref LIKE ?)"); const like = `%${q}%`; v.push(like, like, like, like, `%${q.replace(/\D/g, "") || "~"}%`, like); }
      const rows = (await db.prepare(`${DEAL_SELECT} ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY COALESCE(d.next_touch, '9999'), d.updated_at DESC LIMIT 5000`).bind(...v).all()).results;
      return json({ ok: true, rows });
    }
    if (m === "GET" && path === "search") {
      const q = clean(url.searchParams.get("q"), 80) || "", like = `%${q}%`, digits = q.replace(/\D/g, "");
      const props = (await db.prepare(`SELECT p.*, (SELECT GROUP_CONCAT(track || ':' || stage, ' · ') FROM deals d WHERE d.property_id = p.id) AS tracks FROM properties p
        WHERE p.address LIKE ? OR p.name LIKE ? OR p.city LIKE ? OR p.zip = ? OR p.state = ? ORDER BY p.updated_at DESC LIMIT 50`).bind(like, like, like, q, q.toUpperCase()).all()).results;
      const contacts = (await db.prepare(`SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ? ${digits.length >= 4 ? "OR phone_key LIKE ?" : ""} ORDER BY updated_at DESC LIMIT 50`)
        .bind(...[like, like, ...(digits.length >= 4 ? [`%${digits}%`] : [])]).all()).results;
      return json({ ok: true, props, contacts });
    }
    if (m === "GET" && seg[0] === "property" && seg[1]) {
      const p = await db.prepare("SELECT * FROM properties WHERE id = ?").bind(seg[1]).first();
      if (!p) return json({ ok: false, message: "Not found." }, 404);
      const deals = (await db.prepare(`${DEAL_SELECT} WHERE d.property_id = ? ORDER BY d.created_at`).bind(p.id).all()).results;
      const contacts = (await db.prepare("SELECT c.*, pc.role FROM property_contacts pc JOIN contacts c ON c.id = pc.contact_id WHERE pc.property_id = ?").bind(p.id).all()).results;
      const acts = (await db.prepare("SELECT * FROM activities WHERE property_id = ? ORDER BY at DESC LIMIT 200").bind(p.id).all()).results;
      return json({ ok: true, property: { ...p, data: parse(p.data) }, deals: deals.map((d) => ({ ...d, data: parse(d.data) })), contacts, activities: acts });
    }
    if (m === "GET" && seg[0] === "contact" && seg[1]) {
      const c = await db.prepare("SELECT * FROM contacts WHERE id = ?").bind(seg[1]).first();
      if (!c) return json({ ok: false, message: "Not found." }, 404);
      const props = (await db.prepare(`SELECT p.*, pc.role, (SELECT GROUP_CONCAT(track || ':' || stage, ' · ') FROM deals d WHERE d.property_id = p.id) AS tracks
        FROM property_contacts pc JOIN properties p ON p.id = pc.property_id WHERE pc.contact_id = ?`).bind(c.id).all()).results;
      return json({ ok: true, contact: c, props });
    }
    // Create (or match) a property with an owner and a first track.
    if (m === "POST" && path === "property") {
      const p = await upsertProperty(db, b.property || {}, t);
      const c = b.contact ? await upsertContact(db, b.contact, t) : null;
      if (c) await linkContact(db, p.id, c.id, b.contact.role || "owner", t);
      let d = null;
      if (b.track) d = await upsertDeal(db, { property_id: p.id, contact_id: c && c.id, track: b.track, stage: b.stage, next_touch: b.next_touch || today(), source: b.source || "Back office", source_app: "office", notes: b.notes }, t);
      await logActivity(db, { property_id: p.id, deal_id: d && d.id, contact_id: c && c.id, kind: "created", summary: `${p.merged ? "Matched existing property" : "Property added"}${d ? ` · ${TRACKS[b.track].label}${d.merged ? " (already on this track)" : ""}` : ""}`, by: u.email, source: "office" }, t);
      return json({ ok: true, property_id: p.id, merged: p.merged, deal_id: d && d.id, deal_merged: d && d.merged, contact_merged: c && c.merged });
    }
    if (m === "PATCH" && seg[0] === "property" && seg[1]) {
      const allowed = ["name", "address", "city", "zip", "state", "county", "prop_type", "units", "beds", "baths", "sqft", "acres"];
      if ("state" in b) { b.state = normState(b.state); if (!b.state) return json({ ok: false, message: "Pick a U.S. state." }, 400); }
      const set = [], vals = [];
      for (const k of allowed) if (k in b) { set.push(`${k} = ?`); vals.push(["units", "beds", "baths", "sqft", "acres"].includes(k) ? num(b[k]) : clean(b[k], 200)); }
      if ("address" in b || "zip" in b || "city" in b || "name" in b || "state" in b) {
        const cur = await db.prepare("SELECT * FROM properties WHERE id = ?").bind(seg[1]).first();
        const key = propertyKey({ ...cur, ...b });
        const clash = key && await db.prepare("SELECT id FROM properties WHERE addr_key = ? AND id != ?").bind(key, seg[1]).first();
        if (clash) return json({ ok: false, message: "Another property already has this address. Open it instead.", existing: clash.id }, 409);
        if (key) { set.push("addr_key = ?"); vals.push(key); }
      }
      if (!set.length) return json({ ok: true });
      await db.prepare(`UPDATE properties SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, seg[1]).run();
      return json({ ok: true });
    }
    if (m === "PATCH" && seg[0] === "contact" && seg[1]) {
      const set = [], vals = [];
      for (const k of ["name", "mailing", "company", "notes"]) if (k in b) { set.push(`${k} = ?`); vals.push(clean(b[k], 2000)); }
      if ("phone" in b) { const pk = phoneKey(b.phone); set.push("phone_key = ?", "phone = ?"); vals.push(pk || null, pk ? fmtPhone(b.phone) : clean(b.phone, 40)); }
      if ("email" in b) { set.push("email = ?"); vals.push(emailKey(b.email) || null); }
      if ("lang" in b) { set.push("lang = ?"); vals.push(b.lang === "es" ? "es" : "en"); }
      if ("opt_out" in b) { set.push("opt_out = ?"); vals.push(b.opt_out ? 1 : 0); }
      if ("litigator" in b) { set.push("litigator = ?"); vals.push(b.litigator ? 1 : 0); }
      // Text/call consent recorded by hand (how the person agreed, when, and who recorded it). Never on an opted-out contact.
      if (b.consent === true || b.consent === false) {
        const cur = await db.prepare("SELECT opt_out FROM contacts WHERE id = ?").bind(seg[1]).first();
        if (b.consent && cur && cur.opt_out) return json({ ok: false, message: "This contact opted out. Remove do-not-contact first, only if they asked you to." }, 400);
        const how = clean(b.consent_source, 80);
        if (b.consent && !how) return json({ ok: false, message: "Say how they agreed to texts." }, 400);
        set.push("consent = ?", "consent_json = ?"); vals.push(b.consent ? 1 : 0, b.consent ? JSON.stringify({ source: how, at: t, by: u.email, note: clean(b.consent_note, 500) || "" }) : null);
      }
      if (!set.length) return json({ ok: true });
      await db.prepare(`UPDATE contacts SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, seg[1]).run();
      if ("opt_out" in b) await logActivity(db, { contact_id: seg[1], kind: "consent", summary: b.opt_out ? "Marked do-not-contact" : "Do-not-contact removed", by: u.email, source: "office" }, t);
      if (b.consent === true || b.consent === false) await logActivity(db, { property_id: clean(b.property_id, 40), contact_id: seg[1], kind: "consent",
        summary: b.consent ? `Text consent recorded: ${clean(b.consent_source, 80)}${b.consent_note ? " (" + clean(b.consent_note, 200) + ")" : ""}` : "Text consent removed", by: u.email, source: "office" }, t);
      return json({ ok: true });
    }
    if (m === "POST" && path === "contact") {
      const c = await upsertContact(db, b, t);
      if (!c) return json({ ok: false, message: "Add a name, phone or email." }, 400);
      if (b.property_id) await linkContact(db, b.property_id, c.id, b.role || "owner", t);
      return json({ ok: true, contact_id: c.id, merged: c.merged });
    }
    if (m === "POST" && path === "deal") {
      const d = await upsertDeal(db, { ...b, next_touch: b.next_touch || today(), source: b.source || "Back office", source_app: b.source_app || "office" }, t);
      if (!d.merged) await logActivity(db, { property_id: b.property_id, deal_id: d.id, kind: "stage", summary: `Added to ${TRACKS[b.track].label}`, by: u.email, source: "office" }, t);
      return json({ ok: true, deal_id: d.id, merged: d.merged });
    }
    if (m === "PATCH" && seg[0] === "deal" && seg[1]) {
      const cur = await db.prepare("SELECT * FROM deals WHERE id = ?").bind(seg[1]).first();
      if (!cur) return json({ ok: false, message: "Not found." }, 404);
      const set = [], vals = [];
      if (b.stage && b.stage !== cur.stage) {
        if (!TRACKS[cur.track].stages.includes(b.stage)) return json({ ok: false, message: "That stage isn't on this track." }, 400);
        set.push("stage = ?"); vals.push(b.stage);
      }
      for (const k of ["next_touch", "notes", "ref"]) if (k in b) { set.push(`${k} = ?`); vals.push(clean(b[k], 8000)); }
      for (const k of ["asking", "value"]) if (k in b) { set.push(`${k} = ?`); vals.push(num(b[k])); }
      if ("contact_id" in b) { set.push("contact_id = ?"); vals.push(clean(b.contact_id, 40)); }
      if (!set.length) return json({ ok: true });
      await db.prepare(`UPDATE deals SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, cur.id).run();
      if (b.stage && b.stage !== cur.stage) await logActivity(db, { property_id: cur.property_id, deal_id: cur.id, kind: "stage", summary: `${TRACKS[cur.track].label}: ${cur.stage} → ${b.stage}`, by: u.email, source: "office" }, t);
      return json({ ok: true });
    }
    if (m === "POST" && path === "activity") {
      if (!clean(b.summary)) return json({ ok: false, message: "Write a note first." }, 400);
      await logActivity(db, { ...b, kind: ["call", "text", "email", "mail", "visit", "note"].includes(b.kind) ? b.kind : "note", by: u.email, source: "office" }, t);
      if (b.deal_id && b.next_touch) await db.prepare("UPDATE deals SET next_touch = ?, updated_at = ? WHERE id = ?").bind(clean(b.next_touch, 10), t, b.deal_id).run();
      return json({ ok: true });
    }
    // ---- workers ----
    if (m === "GET" && path === "workers") {
      const st = url.searchParams.get("status");
      const rows = (await db.prepare(`SELECT w.*, (SELECT COUNT(*) FROM worker_jobs j WHERE j.worker_id = w.id) AS jobs,
        (SELECT COALESCE(SUM(pay),0) FROM worker_jobs j WHERE j.worker_id = w.id AND j.paid_at >= ?) AS paid_ytd,
        (SELECT COALESCE(SUM(pay),0) FROM worker_jobs j WHERE j.worker_id = w.id AND j.paid_at IS NULL AND j.status = 'done') AS owed
        FROM workers w ${W_STATUS.includes(st) ? "WHERE w.status = ?" : ""} ORDER BY CASE w.status WHEN 'applied' THEN 0 WHEN 'approved' THEN 1 WHEN 'active' THEN 2 ELSE 3 END, w.created_at DESC`)
        .bind(...[today().slice(0, 4) + "-01-01", ...(W_STATUS.includes(st) ? [st] : [])]).all()).results;
      return json({ ok: true, rows: rows.map((r) => ({ ...r, trades: parse(r.trades) || [], equipment: parse(r.equipment) || [], availability: parse(r.availability) || [] })) });
    }
    if (m === "GET" && seg[0] === "worker" && seg[1]) {
      const w = await db.prepare("SELECT * FROM workers WHERE id = ?").bind(seg[1]).first();
      if (!w) return json({ ok: false, message: "Not found." }, 404);
      const jobs = (await db.prepare(`SELECT j.*, s.ref AS sref, s.label AS slabel, s.property_address FROM worker_jobs j LEFT JOIN service_requests s ON s.id = j.service_request_id
        WHERE j.worker_id = ? ORDER BY COALESCE(j.work_date, j.created_at) DESC LIMIT 200`).bind(w.id).all()).results;
      return json({ ok: true, worker: { ...w, trades: parse(w.trades) || [], equipment: parse(w.equipment) || [], availability: parse(w.availability) || [] }, jobs });
    }
    if (m === "POST" && path === "worker") {
      if (!clean(b.name)) return json({ ok: false, message: "Add a name." }, 400);
      const pk = phoneKey(b.phone);
      if (pk && await db.prepare("SELECT id FROM workers WHERE phone_key = ?").bind(pk).first()) return json({ ok: false, message: "A worker with this phone is already on the list." }, 409);
      const id = newId("w");
      await db.prepare(`INSERT INTO workers (id, ref, name, phone, phone_key, email, city, zip, kind, trades, equipment, availability, rate_note, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, "WK-" + id.slice(2, 7).toUpperCase(), clean(b.name, 120), pk ? fmtPhone(b.phone) : null, pk || null, emailKey(b.email) || null,
        clean(b.city, 80), clean(b.zip, 10), b.kind === "crew" ? "crew" : "contractor", JSON.stringify(b.trades || []), JSON.stringify(b.equipment || []), JSON.stringify(b.availability || []),
        clean(b.rate_note, 200), W_STATUS.includes(b.status) ? b.status : "approved", clean(b.notes, 4000), t, t).run();
      return json({ ok: true, id });
    }
    if (m === "PATCH" && seg[0] === "worker" && seg[1]) {
      const set = [], vals = [];
      for (const k of W_FIELDS) if (k in b) {
        let v = clean(b[k], 4000);
        if (k === "status" && !W_STATUS.includes(v)) continue;
        if (k === "w9" && !W9.includes(v)) continue;
        if (k === "w9") { set.push("w9_at = CASE WHEN COALESCE(w9,'') != ? THEN ? ELSE w9_at END"); vals.push(v, t); }
        if (k === "phone") { set.push("phone_key = ?"); vals.push(phoneKey(v) || null); v = phoneKey(v) ? fmtPhone(v) : v; }
        set.push(`${k} = ?`); vals.push(v);
      }
      for (const k of ["trades", "equipment", "availability"]) if (Array.isArray(b[k])) { set.push(`${k} = ?`); vals.push(JSON.stringify(b[k].map((x) => clean(x, 60)).filter(Boolean))); }
      if (!set.length) return json({ ok: true });
      await db.prepare(`UPDATE workers SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, seg[1]).run();
      return json({ ok: true });
    }
    if (m === "POST" && path === "job") {
      if (!b.worker_id || !(await db.prepare("SELECT id FROM workers WHERE id = ?").bind(b.worker_id).first())) return json({ ok: false, message: "Pick a worker." }, 400);
      const id = newId("j");
      await db.prepare(`INSERT INTO worker_jobs (id, worker_id, service_request_id, deal_id, title, work_date, hours, pay, pay_method, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, b.worker_id, clean(b.service_request_id, 60), clean(b.deal_id, 60), clean(b.title, 200), clean(b.work_date, 10), num(b.hours), num(b.pay),
        clean(b.pay_method, 40), "scheduled", clean(b.notes, 2000), t, t).run();
      if (b.service_request_id) {
        const w = await db.prepare("SELECT name FROM workers WHERE id = ?").bind(b.worker_id).first();
        await db.prepare("UPDATE service_requests SET crew = TRIM(COALESCE(crew,'') || CASE WHEN COALESCE(crew,'') = '' THEN '' ELSE ', ' END || ?), updated_at = ? WHERE id = ?").bind(w.name, t, b.service_request_id).run();
      }
      return json({ ok: true, id });
    }
    if (m === "PATCH" && seg[0] === "job" && seg[1]) {
      const set = [], vals = [];
      for (const k of ["title", "work_date", "pay_method", "notes", "paid_at"]) if (k in b) { set.push(`${k} = ?`); vals.push(clean(b[k], 2000)); }
      for (const k of ["hours", "pay"]) if (k in b) { set.push(`${k} = ?`); vals.push(num(b[k])); }
      if ("status" in b && ["scheduled", "done", "no-show", "cancelled"].includes(b.status)) { set.push("status = ?"); vals.push(b.status); }
      if (!set.length) return json({ ok: true });
      await db.prepare(`UPDATE worker_jobs SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, seg[1]).run();
      return json({ ok: true });
    }
    // ---- quotes: price Curb Appeal jobs (lots over 2 acres, or a lot-size correction) and send the customer a pay link
    if (m === "GET" && path === "quotes") {
      const rows = (await db.prepare(`SELECT id, ref, token, created_at, status, item, label, name, email, phone, consent, property_address, amount, answers, extra FROM service_requests
        WHERE service = 'curb' AND status IN ('requested','quoted','test') AND paid_at IS NULL ORDER BY created_at DESC LIMIT 200`).all()).results;
      return json({ ok: true, rows: rows.map((r) => ({ ...r, answers: parse(r.answers) || {}, extra: parse(r.extra) || {} })) });
    }
    if (m === "GET" && seg[0] === "quote" && seg[1] && !seg[2]) {
      const r = await db.prepare("SELECT * FROM service_requests WHERE id = ? AND service = 'curb'").bind(seg[1]).first();
      if (!r) return json({ ok: false, message: "Not found." }, 404);
      return json({ ok: true, request: { ...r, answers: parse(r.answers) || {}, extra: parse(r.extra) || {}, ip_hash: undefined, user_agent: undefined }, origin: url.origin });
    }
    if (m === "POST" && seg[0] === "quote" && seg[1] && !seg[2]) {
      const r = await db.prepare("SELECT * FROM service_requests WHERE id = ? AND service = 'curb'").bind(seg[1]).first();
      if (!r) return json({ ok: false, message: "Not found." }, 404);
      if (r.paid_at || !["requested", "quoted", "test"].includes(r.status)) return json({ ok: false, message: "This booking is already paid or closed; it can't be re-quoted here." }, 409);
      const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 25).map((l) => ({ label: clean(l.label, 160), amount: num(l.amount) })).filter((l) => l.label && l.amount != null);
      if (!lines.length) return json({ ok: false, message: "Add at least one line." }, 400);
      const total = Math.round(lines.reduce((t, l) => t + l.amount, 0) * 100) / 100;
      if (!(total > 0) || total > 100000) return json({ ok: false, message: "The total must be between $1 and $100,000." }, 400);
      const days = Math.min(60, Math.max(1, Math.round(num(b.valid_days) || CURB_QUOTE.validDays)));
      const exp = new Date(today() + "T12:00:00Z"); exp.setUTCDate(exp.getUTCDate() + days);
      const pkg = CURB[b.package] ? b.package : r.item;
      const extra = parse(r.extra) || {};
      if (r.status === "test") extra.test = true; // test bookings stay tests: no charge when approved
      const prev = extra.quoteDoc;
      extra.quoteDoc = { lines, total, note: clean(b.note, 1500), acres: num(b.acres), overgrown: !!b.overgrown, addOns: Array.isArray(b.addOns) ? b.addOns.slice(0, 10) : [],
        laborGuide: num(b.labor_guide), expires: exp.toISOString().slice(0, 10), created_at: t, by: u.email, version: prev ? (prev.version || 1) + 1 : 1 };
      extra.quoteHistory = [...(extra.quoteHistory || []), ...(prev ? [{ total: prev.total, created_at: prev.created_at, sent_at: prev.sent_at || null }] : [])].slice(-10);
      await db.prepare(`UPDATE service_requests SET status = 'quoted', item = ?, label = ?, amount = ?, quote_amount = ?, extra = ?, stripe_session = NULL, updated_at = ? WHERE id = ?`)
        .bind(pkg, `Curb Appeal ${CURB[pkg].name} package (quote)${extra.test ? " TEST" : ""}`, total, total, JSON.stringify(extra), t, r.id).run();
      return json({ ok: true, total, expires: extra.quoteDoc.expires, orderUrl: `${url.origin}/order/${r.token}` });
    }
    if (m === "POST" && seg[0] === "quote" && seg[1] && seg[2] === "sent") {
      const r = await db.prepare("SELECT extra FROM service_requests WHERE id = ? AND status = 'quoted'").bind(seg[1]).first();
      if (!r) return json({ ok: false, message: "Save the quote first." }, 400);
      const extra = parse(r.extra) || {};
      if (extra.quoteDoc) { extra.quoteDoc.sent_at = t; extra.quoteDoc.sent_via = clean(b.via, 20) || "email"; }
      await db.prepare("UPDATE service_requests SET extra = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(extra), t, seg[1]).run();
      return json({ ok: true });
    }
    // ---- bulk import: Google Maps saved lists (shared link, pasted lines or Takeout file), street addresses for pins
    if (m === "POST" && path === "import/gmaps-link") return json(await gmapsList(clean(b.url, 2000)));
    if (m === "GET" && path === "geocode") return json(await geocode(url.searchParams));
    // Counties: up to 25 lookups per call ({key, lat, lng, address, city, zip}) -> {key: county}
    if (m === "POST" && path === "counties") {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 25), out = {};
      await pool(items, 6, async (it) => { out[it.key] = await countyFor(it); });
      return json({ ok: true, counties: out });
    }
    // Fill missing counties on properties already on file, 40 at a time (the Import tab calls this until none are left)
    if (m === "POST" && path === "import/fill-counties") {
      const rows = (await db.prepare(`SELECT id, address, city, zip, state, lat, lng FROM properties WHERE (county IS NULL OR county = '')
        AND (lat IS NOT NULL OR (address IS NOT NULL AND address != '')) AND (data IS NULL OR data NOT LIKE '%"county_lookup":"none"%') LIMIT 40`).all()).results;
      let filled = 0;
      await pool(rows, 6, async (r) => {
        const c = await countyFor(r);
        if (c) { await db.prepare("UPDATE properties SET county = ?, updated_at = ? WHERE id = ?").bind(c, t, r.id).run(); filled++; }
        else await db.prepare(`UPDATE properties SET data = json_set(COALESCE(data, '{}'), '$.county_lookup', 'none') WHERE id = ?`).bind(r.id).run();
      });
      const left = (await db.prepare(`SELECT COUNT(*) AS n FROM properties WHERE (county IS NULL OR county = '') AND (lat IS NOT NULL OR (address IS NOT NULL AND address != ''))
        AND (data IS NULL OR data NOT LIKE '%"county_lookup":"none"%')`).first()).n;
      return json({ ok: true, checked: rows.length, filled, left });
    }
    if (m === "POST" && path === "import/check") {
      await repairOneLineAddresses(db, t);
      const keys = (Array.isArray(b.keys) ? b.keys : []).filter((k) => typeof k === "string" && k).slice(0, 2000);
      const found = {};
      for (let i = 0; i < keys.length; i += 90) {
        const part = keys.slice(i, i + 90);
        const rows = (await db.prepare(`SELECT p.id, p.addr_key, p.prop_type, (SELECT group_concat(DISTINCT d.track) FROM deals d WHERE d.property_id = p.id) AS tracks
          FROM properties p WHERE p.addr_key IN (${part.map(() => "?").join(",")})`).bind(...part).all()).results;
        for (const r of rows) found[r.addr_key] = { id: r.id, type: r.prop_type || "", tracks: r.tracks ? r.tracks.split(",") : [] };
      }
      return json({ ok: true, found });
    }
    // Properties on file with no track and/or no property type (to sort, select and assign in the Import tab)
    if (m === "GET" && path === "import/unassigned") {
      await repairOneLineAddresses(db, t);
      const rows = (await db.prepare(`SELECT p.id, p.name, p.address, p.city, p.zip, p.state, p.county, p.prop_type, p.lat, p.lng, p.data, p.created_at,
          (SELECT group_concat(DISTINCT d.track) FROM deals d WHERE d.property_id = p.id) AS tracks
        FROM properties p ORDER BY p.created_at DESC LIMIT 5000`).all()).results
        .filter((r) => !r.tracks || !r.prop_type)
        .map((r) => { const d = parse(r.data) || {}; return { id: r.id, name: r.name || "", address: r.address || "", city: r.city || "", zip: r.zip || "", state: r.state || "", county: r.county || "",
          type: r.prop_type || "", tracks: r.tracks ? r.tracks.split(",") : [], lat: r.lat, lng: r.lng, note: (d.import && d.import.note) || "", list: (d.import && d.import.list) || "", created_at: r.created_at }; });
      return json({ ok: true, rows });
    }
    // Put properties already on file onto a track and/or set their type (bulk, from the Import tab)
    if (m === "POST" && path === "import/assign") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x) => typeof x === "string").slice(0, 100);
      const track = TRACKS[b.track] ? b.track : null, ptype = clean(b.prop_type, 40), source = clean(b.source, 120) || "Back office";
      if (!track && !ptype) return json({ ok: false, message: "Pick a track or a type to apply." }, 400);
      let typed = 0, tracked = 0;
      for (const id of ids) {
        const p = await db.prepare("SELECT id FROM properties WHERE id = ?").bind(id).first(); if (!p) continue;
        if (ptype) { await db.prepare("UPDATE properties SET prop_type = ?, updated_at = ? WHERE id = ?").bind(ptype, t, id).run(); typed++; }
        let d = null;
        if (track) { d = await upsertDeal(db, { property_id: id, track, next_touch: today(), source, source_app: "office" }, t); tracked++; }
        await logActivity(db, { property_id: id, deal_id: d && d.id, kind: "update", summary: [track && `Added to ${TRACKS[track].label}`, ptype && `Type set to ${ptype}`].filter(Boolean).join(" · "), by: u.email, source: "office" }, t);
      }
      return json({ ok: true, typed, tracked });
    }
    if (m === "POST" && path === "import/properties") {
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 50);
      const track = TRACKS[b.track] ? b.track : null, source = clean(b.source, 120) || "Google Maps list";
      let added = 0, merged = 0, skipped = 0; const errors = [];
      for (const r of rows) {
        try {
          const p = await upsertProperty(db, { address: r.address, name: r.name, city: r.city, zip: r.zip, state: r.state, county: r.county, prop_type: b.prop_type || null, lat: r.lat, lng: r.lng,
            data: { import: { source, list: clean(b.list_name, 160), note: clean(r.note, 500), gmaps: clean(r.link, 500), at: t } } }, t);
          p.merged ? merged++ : added++;
          let d = null;
          if (track) d = await upsertDeal(db, { property_id: p.id, track, next_touch: today(), source, source_app: "gmaps", notes: clean(r.note, 1000) }, t);
          await logActivity(db, { property_id: p.id, deal_id: d && d.id, kind: "import", summary: `${p.merged ? "Matched on import" : "Imported"} from ${source}${d ? ` · ${TRACKS[track].label}` : ""}`, by: u.email, source: "office" }, t);
        } catch (e) { skipped++; errors.push(`${r.address || r.name || "row"}: ${e.message}`); }
      }
      if (b.log_import) await db.prepare("INSERT INTO hub_imports (id, at, source, file, rows, added, merged, skipped, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(newId("i"), t, "gmaps", clean(b.list_name, 160), num(b.log_import.rows), num(b.log_import.added), num(b.log_import.merged), num(b.log_import.skipped), source).run();
      return json({ ok: true, added, merged, skipped, errors: errors.slice(0, 20) });
    }
    // ---- jobs: service orders (field work and sales), scheduling, crew, payments
    if (m === "GET" && path === "jobs") {
      const rows = (await db.prepare(`SELECT s.id, s.ref, s.token, s.created_at, s.service, s.item, s.label, s.status, s.name, s.phone, s.email, s.property_address, s.amount, s.amount_paid, s.paid_at,
          s.mode, s.appointment_at, s.crew, s.answers, s.extra, s.labor_cost,
          (SELECT COALESCE(SUM(amount),0) FROM service_payments p WHERE p.request_id = s.id) AS paid_total,
          (SELECT COALESCE(SUM(pay),0) FROM worker_jobs j WHERE j.service_request_id = s.id AND j.status != 'cancelled') AS crew_pay
        FROM service_requests s ORDER BY COALESCE(s.appointment_at, s.created_at) DESC LIMIT 500`).all()).results;
      return json({ ok: true, rows: rows.map((r) => ({ ...r, answers: parse(r.answers) || {}, extra: parse(r.extra) || {}, test: isTestOrder(r) })) });
    }
    if (m === "GET" && seg[0] === "job-detail" && seg[1]) {
      const r = await db.prepare("SELECT * FROM service_requests WHERE id = ?").bind(seg[1]).first();
      if (!r) return json({ ok: false, message: "Not found." }, 404);
      const jobs = (await db.prepare("SELECT j.*, w.name AS wname, w.phone AS wphone FROM worker_jobs j LEFT JOIN workers w ON w.id = j.worker_id WHERE j.service_request_id = ? ORDER BY j.work_date").bind(r.id).all()).results;
      const pays = (await db.prepare("SELECT * FROM service_payments WHERE request_id = ? ORDER BY at").bind(r.id).all()).results;
      const crew = (await db.prepare("SELECT id, name, phone, trades FROM workers WHERE status IN ('approved','active') ORDER BY name").all()).results;
      return json({ ok: true, request: { ...r, answers: parse(r.answers) || {}, extra: parse(r.extra) || {}, ip_hash: undefined, user_agent: undefined, test: isTestOrder(r) }, jobs, payments: pays, crew, origin: url.origin });
    }
    if (m === "PATCH" && seg[0] === "service" && seg[1]) {
      const r = await db.prepare("SELECT id, service, status FROM service_requests WHERE id = ?").bind(seg[1]).first();
      if (!r) return json({ ok: false, message: "Not found." }, 404);
      const set = [], vals = [];
      const OK = ["requested", "quoted", "awaiting_payment", "paid", "scheduled", "in_progress", "completed", "cancelled", "active", "past_due", "delivered", "quote_requested", "won", "lost", "waitlist"];
      if ("status" in b) { if (!OK.includes(b.status)) return json({ ok: false, message: "Unknown status." }, 400); set.push("status = ?"); vals.push(b.status); }
      if ("appointment_at" in b) {
        const v = clean(b.appointment_at, 40);
        if (v) {
          const d = new Date(v); if (isNaN(d)) return json({ ok: false, message: "Bad date." }, 400);
          if (isShabbatDate(d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }))) return json({ ok: false, message: "No Saturday work (Shabbat). Pick another day." }, 400);
          set.push("appointment_at = ?"); vals.push(d.toISOString());
          if (!("status" in b) && ["requested", "paid", "quoted"].includes(r.status)) { set.push("status = ?"); vals.push("scheduled"); }
        } else { set.push("appointment_at = ?"); vals.push(null); }
      }
      if ("desk_notes" in b) { set.push("desk_notes = ?"); vals.push(clean(b.desk_notes, 4000)); }
      if ("labor_cost" in b) { set.push("labor_cost = ?"); vals.push(num(b.labor_cost)); }
      if (!set.length) return json({ ok: true });
      await db.prepare(`UPDATE service_requests SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, r.id).run();
      return json({ ok: true });
    }
    if (m === "POST" && path === "payment") {
      const r = await db.prepare("SELECT * FROM service_requests WHERE id = ?").bind(b.request_id || "").first();
      if (!r) return json({ ok: false, message: "Pick an order." }, 400);
      const amt = num(b.amount); if (!amt || Math.abs(amt) > 100000) return json({ ok: false, message: "Enter the amount (negative for a refund)." }, 400);
      const at = b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? new Date(b.date + "T18:00:00Z").toISOString() : t;
      await recordPayment(env, { request_id: r.id, at, amount: amt, kind: amt < 0 ? "refund" : "manual", method: clean(b.method, 30) || "cash", note: clean(b.note, 300), test: isTestOrder(r), by: u.email });
      const tot = (await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM service_payments WHERE request_id = ?").bind(r.id).first()).s;
      const toPaid = amt > 0 && ["requested", "quoted", "awaiting_payment"].includes(r.status) && r.mode !== "subscription";
      await db.prepare(`UPDATE service_requests SET amount_paid = ?, paid_at = COALESCE(paid_at, ?), status = CASE WHEN ? THEN 'paid' ELSE status END, updated_at = ? WHERE id = ?`)
        .bind(tot, amt > 0 ? at : null, toPaid ? 1 : 0, t, r.id).run();
      return json({ ok: true, paid_total: tot });
    }
    // ---- office settings (W-9 request link)
    if (m === "GET" && path === "settings") {
      const rows = (await db.prepare("SELECT key, value FROM settings WHERE key IN ('w9_link', 'mail_address')").all()).results;
      return json({ ok: true, ...Object.fromEntries(rows.map((r) => [r.key, r.value])), texting: !!(env.BRIDGE_URL && env.BRIDGE_TOKEN) });
    }
    // ---- texts through the private gateway (msg.houselotandland.org → Harvey's Android; queued, he releases them)
    if (m === "POST" && path === "text") return json(await gatewayText(env, db, b, u, t));
    if (m === "PUT" && path === "settings") {
      if ("w9_link" in b) {
        const v = clean(b.w9_link, 500) || "";
        if (v && !/^https:\/\/[^\s]+$/.test(v)) return json({ ok: false, message: "Paste the full secure link (starting with https://)." }, 400);
        await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('w9_link', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(v, t).run();
      }
      if ("mail_address" in b) { // printed at the bottom of owner emails (CAN-SPAM)
        const v = clean(b.mail_address, 200) || "";
        await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('mail_address', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(v, t).run();
      }
      return json({ ok: true });
    }
    if (m === "GET" && path === "open-services") {
      const rows = (await db.prepare(`SELECT id, ref, service, label, status, name, property_address, appointment_at, crew, answers FROM service_requests
        WHERE service IN ('curb','watch') AND status NOT IN ('test','cancelled','completed') ORDER BY created_at DESC LIMIT 100`).all()).results;
      return json({ ok: true, rows: rows.map((r) => ({ ...r, answers: parse(r.answers) || {} })) });
    }
    return json({ ok: false, message: "Not found." }, 404);
  } catch (e) {
    return json({ ok: false, message: e && e.message && e.message.length < 200 ? e.message : "Something went wrong." }, 400);
  }
}

// ---------------- Google Maps saved lists ----------------
// Shared list links (maps.app.goo.gl/… or google.com/maps/placelists/list/…) are read through the same unofficial
// endpoint the Maps page uses. Google can change or block it without notice; the back office falls back to
// pasted lines or a Google Takeout file.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
async function gmapsList(link) {
  const fail = (message) => ({ ok: false, message });
  if (!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+\/maps)\//i.test(link || "")) return fail("Paste the list's share link (maps.app.goo.gl/… or google.com/maps/…).");
  let at = link, cookies = [];
  for (let i = 0; i < 6; i++) {
    const m = at.match(/!2s(-?[\w-]{8,})!/) || at.match(/\/placelists\/list\/(-?[\w-]{8,})/);
    if (m && /google\./.test(at)) break;
    const res = await fetch(at, { redirect: "manual", headers: { "user-agent": i ? UA : "Mozilla/5.0" } });
    const sc = res.headers.get("set-cookie"); if (sc) cookies.push(...sc.split(/,(?=\s*\w+=)/).map((c) => c.split(";")[0].trim()));
    const loc = res.headers.get("location");
    if (!loc) break;
    at = new URL(loc, at).toString();
  }
  const dec = decodeURIComponent(at);
  const idm = dec.match(/!2s(-?[\w-]{8,})!/) || dec.match(/\/placelists\/list\/(-?[\w-]{8,})/) || dec.match(/!1s(-?[\w-]{16,})!/);
  if (!idm) return fail("That link didn't lead to a saved list. In Google Maps open the list, tap Share, and copy the link.");
  const id = idm[1], tok = (dec.match(/[?&]token=([\w-]+)/) || [])[1];
  const page = `https://www.google.com/maps/placelists/list/${id}${tok ? "?token=" + tok : ""}`;
  const sess = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replace(/[+/=]/g, "");
  const variants = [
    `!1m4!1s${id}!2e1!3m1!1e1!2e2!3e2!4i500!6m3!1s${sess}!15i204459!28e2!13s${encodeURIComponent(page)}!16b1`,
    `!1m4!1s${id}!2e1!3m1!1e1!2e2!3e2!4i500!16b1`,
    `!2e2!3e2!4i500!6m3!1s${sess}!15i204459!28e2!13s${encodeURIComponent(page)}!16b1`,
  ];
  let data = null, lastStatus = 0;
  for (const pb of variants) {
    const res = await fetch(`https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=us&pb=${pb}`, { headers: { "user-agent": UA, ...(cookies.length ? { cookie: cookies.join("; ") } : {}) } });
    lastStatus = res.status;
    if (!res.ok) continue;
    try { data = JSON.parse((await res.text()).replace(/^\)\]\}'\s*/, "")); } catch { data = null; }
    if (data && Array.isArray(data[0]) && Array.isArray(data[0][8])) break;
    data = null;
  }
  if (!data) return fail(`Google didn't return the list (status ${lastStatus || "none"}). Make sure the list is shared ("Anyone with the link"), or use "Paste" or "Takeout file" below.`);
  const places = parseGmapsItems(data[0][8]);
  return { ok: true, list_name: typeof data[0][4] === "string" ? data[0][4] : "Google Maps list", rows: places };
}
export function parseGmapsItems(items) {
  const out = [];
  for (const it of items || []) {
    if (!Array.isArray(it)) continue;
    const info = Array.isArray(it[1]) ? it[1] : [];
    const name = typeof it[2] === "string" ? it[2] : "";
    let address = typeof info[4] === "string" ? info[4] : "";
    if (!address) { const st = info.find((x) => typeof x === "string" && /\d/.test(x) && x.includes(",")); if (st) address = st; }
    let lat = null, lng = null;
    const ll = Array.isArray(info[5]) ? info[5].filter((x) => typeof x === "number") : [];
    if (ll.length >= 2) { lat = ll[ll.length - 2]; lng = ll[ll.length - 1]; }
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) { lat = null; lng = null; }
    const note = typeof it[3] === "string" ? it[3] : "";
    if (!name && !address && lat == null) continue;
    out.push({ name, address, lat, lng, note, link: lat != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : "" });
  }
  return out;
}

// Street address for a pin (reverse) or details for a typed address (forward), via OpenStreetMap Nominatim.
// Their policy: at most 1 request a second and a real contact, so the back office sends them one at a time.
async function geocode(sp) {
  const lat = num(sp.get("lat")), lng = num(sp.get("lng")), q = clean(sp.get("q"), 300);
  const base = "https://nominatim.openstreetmap.org/";
  const u = lat != null && lng != null ? `${base}reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}` : q ? `${base}search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&q=${encodeURIComponent(q)}` : null;
  if (!u) return { ok: false, message: "Nothing to look up." };
  const res = await fetch(u, { headers: { "user-agent": "HouseLotLand-BackOffice/1.0 (houselotandland+website@gmail.com)", "accept-language": "en" } });
  if (!res.ok) return { ok: false, message: `Address lookup failed (${res.status}).` };
  let j = await res.json(); if (Array.isArray(j)) j = j[0];
  if (!j || !j.address) return { ok: false, message: "No address found." };
  const a = j.address;
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  return { ok: true, address: street, exact: !!a.house_number, city: a.city || a.town || a.village || a.hamlet || a.suburb || "", zip: (a.postcode || "").slice(0, 5),
    county: (a.county || "").replace(/ County$/, ""), state: normState(a.state) || zipState(a.postcode) || "", lat: num(j.lat), lng: num(j.lon), display: j.display_name || "" };
}

// ---------------- services & sales numbers for the overview ----------------
async function salesSummary(db) {
  const nowD = new Date(), ymd = nowD.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const monthStart = ymd.slice(0, 8) + "01", yearStart = ymd.slice(0, 5) + "01-01";
  const d30 = new Date(nowD.getTime() - 30 * 864e5).toISOString();
  const sum = async (where, ...v) => (await db.prepare(`SELECT COALESCE(SUM(amount),0) AS s, COUNT(*) AS n FROM service_payments WHERE ${where}`).bind(...v).first());
  const month = await sum("test = 0 AND at >= ?", monthStart), last30 = await sum("test = 0 AND at >= ?", d30), year = await sum("test = 0 AND at >= ?", yearStart);
  const invoices30 = await sum("test = 0 AND kind = 'invoice' AND at >= ?", d30), testAll = await sum("test = 1");
  const reqs = (await db.prepare(`SELECT id, ref, service, item, label, status, name, amount, mode, appointment_at, paid_at, extra, answers, property_address FROM service_requests WHERE status NOT IN ('cancelled')`).all()).results
    .map((r) => ({ ...r, test: isTestOrder(r), extra: undefined, answers: (() => { try { return JSON.parse(r.answers || "{}"); } catch { return {}; } })() }));
  const real = reqs.filter((r) => !r.test);
  const subs = real.filter((r) => r.mode === "subscription" && ["active", "past_due"].includes(r.status));
  const field = (r) => ["curb", "watch"].includes(r.service);
  const openJobs = real.filter((r) => field(r) && ["requested", "quoted", "paid", "scheduled", "in_progress"].includes(r.status));
  const byService = {};
  for (const r of real) { const k = r.service; (byService[k] ||= {}); byService[k][r.status] = (byService[k][r.status] || 0) + 1; }
  const upcoming = reqs.filter((r) => r.appointment_at && r.appointment_at >= new Date(nowD.getTime() - 12 * 36e5).toISOString() && !["completed", "cancelled"].includes(r.status))
    .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at)).slice(0, 8);
  const needsSched = openJobs.filter((r) => !r.appointment_at && ["requested", "paid"].includes(r.status) && r.amount != null).slice(0, 8);
  const recentPays = (await db.prepare(`SELECT p.*, s.ref, s.label, s.name FROM service_payments p LEFT JOIN service_requests s ON s.id = p.request_id ORDER BY p.at DESC LIMIT 10`).all()).results;
  const crewOwed = (await db.prepare("SELECT COALESCE(SUM(pay),0) AS s, COUNT(*) AS n FROM worker_jobs WHERE status = 'done' AND paid_at IS NULL").first());
  const unpaid = real.filter((r) => ["awaiting_payment", "quoted"].includes(r.status) || (r.service === "curb" && r.status === "requested" && !r.paid_at && r.amount != null));
  return {
    month: month.s, monthN: month.n, last30: last30.s, year: year.s, invoices30: invoices30.s, invoices30N: invoices30.n, testTotal: testAll.s, testN: testAll.n,
    subs: subs.length, mrr: subs.reduce((t, r) => t + (r.amount || 0), 0), pastDue: subs.filter((r) => r.status === "past_due").length,
    openJobs: openJobs.length, unpaid: unpaid.length, unpaidAmt: unpaid.reduce((t, r) => t + (r.amount || 0), 0), crewOwed: crewOwed.s, crewOwedN: crewOwed.n,
    byService, upcoming, needsSched, recentPays,
  };
}

// ---------------- texting gateway ----------------
// The gateway (House Lot & Land Messaging Bridge) only sends approved templates and enforces opt-outs and quiet hours.
// send_now: Harvey's click is the release; the Mac mini sends it from the Android right away (no one touches the phone). Needs var BRIDGE_URL and secret BRIDGE_TOKEN
// (set by Harvey in Cloudflare; same value as PHONE_BRIDGE_TOKEN in the bridge's .env). Endpoint: POST /api/phone-bridge/send-template.
const TEXT_TEMPLATES = { w9_request: { kind: "worker" }, heir_wholesale: { kind: "contact" }, heir_subto: { kind: "contact" }, heir_creative: { kind: "contact" } };
async function gatewayText(env, db, b, u, t) {
  if (!env.BRIDGE_URL || !env.BRIDGE_TOKEN) return { ok: false, message: "The texting gateway isn't connected to the site yet." };
  const tpl = TEXT_TEMPLATES[b.template]; if (!tpl) return { ok: false, message: "Unknown text." };
  let to, lang, vars, ref, consent;
  if (tpl.kind === "worker") {
    const w = await db.prepare("SELECT * FROM workers WHERE id = ?").bind(b.id || "").first();
    if (!w) return { ok: false, message: "Worker not found." };
    if (!w.consent) return { ok: false, message: "No text consent on file for this worker. Email them instead." };
    const link = (await db.prepare("SELECT value FROM settings WHERE key = 'w9_link'").first() || {}).value;
    if (b.template === "w9_request" && !link) return { ok: false, message: "Save your secure W-9 link first." };
    to = w.phone_key ? "+1" + w.phone_key : null; lang = w.lang === "es" ? "es" : "en"; ref = w.ref || w.id;
    vars = { first_name: String(w.name || "").trim().split(/\s+/)[0] || "", link };
    consent = { source: "work-with-us application", at: w.created_at, text: w.consent_text || "" };
  }
  if (tpl.kind === "contact") { // owner/family texts from the property drawer: consent on file required, never to opt-outs or TCPA litigators
    const c = await db.prepare("SELECT * FROM contacts WHERE id = ?").bind(b.id || "").first();
    const p = await db.prepare("SELECT * FROM properties WHERE id = ?").bind(b.property_id || "").first();
    if (!c || !p) return { ok: false, message: "Contact or property not found." };
    if (c.opt_out) return { ok: false, message: "This contact asked not to be contacted." };
    if (c.litigator) return { ok: false, message: "This contact is flagged as a TCPA litigator: mail only." };
    if (!c.consent) return { ok: false, message: "No text consent on file for this contact. Email or mail them instead." };
    const d = await db.prepare("SELECT ref FROM deals WHERE property_id = ? AND ref IS NOT NULL AND ref != '' LIMIT 1").bind(p.id).first();
    to = c.phone_key ? "+1" + c.phone_key : null; lang = b.lang === "es" || (!b.lang && c.lang === "es") ? "es" : "en"; ref = (d && d.ref) || p.id;
    vars = { first_name: clean(b.first_name, 40) || String(c.name || "").trim().split(/\s+/)[0] || (lang === "es" ? "a la familia" : "there"), address: p.address || p.name || (lang === "es" ? "su propiedad" : "your property"), ref };
    let cj = {}; try { cj = JSON.parse(c.consent_json || "{}") || {}; } catch {}
    consent = { source: cj.source || "contact consent on file", at: cj.at || c.updated_at, text: cj.text || "" };
  }
  if (!to) return { ok: false, message: "No valid phone number on file." };
  const id = newId("tx"), day = t.slice(0, 10);
  let status = "queued", bridgeId = null, error = null, sendAfter = null;
  try {
    const res = await fetch(env.BRIDGE_URL.replace(/\/$/, "") + "/api/phone-bridge/send-template", { method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + env.BRIDGE_TOKEN },
      body: JSON.stringify({ to, template_id: b.template, lang, variables: vars, ref, consent, idempotency_key: `${b.template}:${ref}:${day}`, send_now: true }) });
    const j = await res.json().catch(() => ({}));
    const why = { outside_send_window: "Outside texting hours (9 AM to 8 PM, Sundays from noon).", shabbat: "Closed for Shabbat.", opted_out: "This number opted out of texts.",
      daily_limit: "Today's text limit is reached.", rate_limit: "Too many texts in the last minute; try again shortly.", invalid_number: "That phone number isn't valid.",
      template_not_found: "The gateway doesn't have this message template." };
    if (res.status === 401 || res.status === 503) { status = "failed"; error = "The gateway refused the site's key. Check BRIDGE_TOKEN in Cloudflare."; }
    else if (j.refused_reason === "send_failed") { status = "failed"; error = j.message || "The phone didn't send it."; bridgeId = j.message_id || null; }
    else if (!res.ok || j.ok === false || j.status === "refused") { status = "refused"; error = why[j.refused_reason] || j.message || j.error || `Gateway error ${res.status}`; }
    else { bridgeId = j.message_id || j.id || null; status = j.duplicate ? "duplicate" : j.status === "sent" ? "sent" : "queued"; sendAfter = j.send_after || null; }
  } catch (e) { status = "failed"; error = "Couldn't reach the gateway (is the Mac on?)"; }
  await db.prepare("INSERT INTO outbound_texts (id, at, to_phone, kind, ref_id, template, lang, status, bridge_id, error, by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, t, to, tpl.kind, b.id, b.template, lang, status, bridgeId, error, u.email).run();
  if (!["sent", "queued", "duplicate"].includes(status)) return { ok: false, message: error };
  if (tpl.kind === "contact") await logActivity(db, { property_id: b.property_id, contact_id: b.id, kind: "text", summary: `Text (${b.template.replace("heir_", "owner passed away, ")}${lang === "es" ? ", Spanish" : ""}) to ${to}: ${status}`, by: u.email, source: "office" }, t);
  if (b.template === "w9_request") await db.prepare("UPDATE workers SET w9 = 'requested', w9_at = ?, updated_at = ? WHERE id = ? AND COALESCE(w9,'') != 'received'").bind(t, t, b.id).run();
  const at = sendAfter ? new Date(sendAfter).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "";
  return { ok: true, message: status === "sent" ? "Text sent from the business phone." : status === "duplicate" ? "Already texted today; not sent again."
    : at ? `Outside texting hours: it sends automatically ${at}.` : "The phone didn't send it yet; the gateway retries automatically." };
}

// Imports before Nov 10, 2026 saved Google Maps addresses whole ("123 Main St, Dallas, TX 75201") with no city or ZIP.
// Split them and re-key them so they match the same house entered any other way. Skips a row whose new key belongs
// to another property (a likely duplicate, left for Harvey). Idempotent and cheap once nothing is left to fix.
async function repairOneLineAddresses(db, t) {
  const rows = (await db.prepare("SELECT id, name, address, zip FROM properties WHERE address LIKE '%,%' AND (city IS NULL OR city = '') LIMIT 500").all()).results;
  if (!rows.length) return 0;
  const stmts = [];
  for (const r of rows) {
    const a = splitAddr(r.address); if (!a.address || (!a.city && !a.zip)) continue;
    const name = r.name && r.name.trim().toLowerCase() === a.address.toLowerCase() ? null : r.name;
    const key = propertyKey({ address: a.address, city: a.city, zip: r.zip || a.zip, state: a.state, name: name || "" });
    const clash = await db.prepare("SELECT id FROM properties WHERE addr_key = ? AND id != ?").bind(key, r.id).first();
    if (!key || clash) continue;
    stmts.push(db.prepare("UPDATE properties SET address = ?, city = ?, zip = COALESCE(NULLIF(zip,''), ?), state = COALESCE(NULLIF(?, ''), state), name = ?, addr_key = ?, updated_at = ? WHERE id = ?")
      .bind(a.address, a.city || null, a.zip || null, a.state, name, key, t, r.id));
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return stmts.length;
}

// ---------------- counties (U.S. Census Bureau geocoder: free, no key) ----------------
// From a map pin when there is one (exact), else from the street address. Returns the county name without "County", or "".
async function countyFor(r) {
  const base = "https://geocoding.geo.census.gov/geocoder/geographies/";
  const tail = "&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json";
  const pick = (g) => { const c = g && (g.Counties || g["Counties"]); return c && c[0] ? String(c[0].BASENAME || c[0].NAME || "").replace(/ County$/, "") : ""; };
  const get = async (u) => { try { const res = await fetch(u, { signal: AbortSignal.timeout(9000), headers: { "user-agent": "HouseLotLand-BackOffice/1.0" } }); return res.ok ? await res.json() : null; } catch { return null; } };
  const lat = num(r.lat), lng = num(r.lng);
  if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    const j = await get(`${base}coordinates?x=${lng}&y=${lat}${tail}`);
    const c = j && j.result && pick(j.result.geographies); if (c) return c;
  }
  const one = [r.address, r.city, normState(r.state) || zipState(r.zip), r.zip].filter(Boolean).join(", ");
  if (r.address && /\d/.test(r.address)) {
    const j = await get(`${base}onelineaddress?address=${encodeURIComponent(one)}${tail}`);
    const m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
    const c = m && pick(m.geographies); if (c) return c;
  }
  return "";
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); })); }
