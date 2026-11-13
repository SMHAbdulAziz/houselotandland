// Affiliates: Harvey's private referral partners (not marketed; added only in the back office). Separate from workers/crews.
// Each affiliate is paid a flat $2,500 (AFF_PAYOUT) per deal House Lot & Land closes from their referral.
//
// Public:  GET /api/affiliates  -> active affiliates marked "show on site" (id + name) for the "Who referred you?" dropdown
//          at the end of the homepage cash-offer form. "Other" + a typed name records a non-affiliate referrer (no payout).
//          referrerFromLead() validates that choice inside POST /api/lead (src/worker.js) and recordReferral() saves it.
// Office:  /api/office/aff/*  (officeAffiliateApi, called from src/office.js after the Access check). Tables: src/affiliates.sql.

import { propertyKey, splitAddr, phoneKey, emailKey, fmtPhone, TRACKS } from "../js/hub-keys.js";
import { newId } from "./office.js";

export const AFF_PAYOUT = 2500;
const AFF_STATUS = ["active", "inactive"];
const REF_STATUS = ["open", "closed", "paid", "void"];
const W9 = ["not requested", "requested", "received"];
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => ALPHA[x % ALPHA.length]).join("");
const clean = (v, max = 500) => (v == null ? "" : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max));
const num = (v) => (v === "" || v == null || !isFinite(Number(String(v).replace(/[$,]/g, ""))) ? null : Number(String(v).replace(/[$,]/g, "")));
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : today());
export function addrKey(address) {
  const a = splitAddr(address || "");
  try { return propertyKey({ address: a.address, city: a.city, zip: a.zip, state: a.state }) || null; } catch { return null; }
}

// ---------------- public ----------------
export async function handleAffiliatesPublic(request, env) {
  if (request.method !== "GET") return new Response(JSON.stringify({ ok: false }), { status: 405, headers: { "content-type": "application/json" } });
  const rows = (await env.DB.prepare("SELECT id, name FROM affiliates WHERE status = 'active' AND on_site = 1 ORDER BY name COLLATE NOCASE").all().catch(() => ({ results: [] }))).results;
  return new Response(JSON.stringify({ ok: true, affiliates: rows }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" } });
}

/** Reads the referrer choice from a lead form body. Returns { type, id, name } or null (none), or { error }. */
export async function referrerFromLead(db, body, es) {
  const v = clean(body.referrer, 60);
  if (!v || v === "none") return null;
  if (v === "other") {
    const name = clean(body.referrer_other, 120);
    if (name.length < 2) return { error: es ? "Escriba el nombre de quien le refirió." : "Please type the name of the person who referred you." };
    return { type: "other", id: null, name };
  }
  const a = await db.prepare("SELECT id, name FROM affiliates WHERE id = ? AND status = 'active'").bind(v).first();
  if (!a) return { error: es ? "Elija de nuevo quién le refirió." : "Please choose who referred you again." };
  return { type: "affiliate", id: a.id, name: a.name };
}
export async function recordReferral(db, r, lead, t = new Date().toISOString()) {
  await db.prepare(`INSERT INTO referrals (id, ref, lead_id, lead_ref, affiliate_id, other_name, seller_name, seller_phone, property_address, addr_key, status, payout, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, 'website', ?, ?)`).bind(newId("rf"), "RF-" + code(5), lead.id, lead.ref, r.id, r.type === "other" ? r.name : null,
    clean(lead.name, 160), clean(lead.phone, 40), clean(lead.property_address, 300), addrKey(lead.property_address), r.type === "affiliate" ? AFF_PAYOUT : 0, t, t).run();
}

// ---------------- back office: /api/office/aff/* ----------------
const REF_SELECT = `SELECT r.*, a.name AS aff_name, a.ref AS aff_ref, a.w9 AS aff_w9, a.licensed AS aff_licensed, a.broker AS aff_broker,
  l.created_at AS lead_at, l.email AS lead_email, l.timeline AS lead_timeline, l.property_type AS lead_type,
  (SELECT p.id FROM properties p WHERE p.addr_key = r.addr_key) AS property_id
  FROM referrals r LEFT JOIN affiliates a ON a.id = r.affiliate_id LEFT JOIN leads l ON l.id = r.lead_id`;
const A_FIELDS = ["name", "email", "city", "company", "pay_method", "notes", "broker", "status", "w9", "agreement_at", "lang"];

export async function officeAffiliateApi(db, m, seg, b, u, t, url, json) {
  const [, what, id, action] = seg; // seg[0] === "aff"
  if (m === "GET" && what === "summary") {
    const affs = (await db.prepare(`SELECT a.*, (SELECT COUNT(*) FROM referrals r WHERE r.affiliate_id = a.id AND r.status != 'void') AS refs,
      (SELECT COUNT(*) FROM referrals r WHERE r.affiliate_id = a.id AND r.status IN ('closed','paid')) AS closed,
      (SELECT COALESCE(SUM(payout),0) FROM referrals r WHERE r.affiliate_id = a.id AND r.status = 'closed') AS owed,
      (SELECT COALESCE(SUM(payout),0) FROM referrals r WHERE r.affiliate_id = a.id AND r.status = 'paid' AND r.paid_on >= ?) AS paid_ytd
      FROM affiliates a ORDER BY CASE a.status WHEN 'active' THEN 0 ELSE 1 END, a.name COLLATE NOCASE`).bind(today().slice(0, 4) + "-01-01").all()).results;
    const st = url.searchParams.get("status") || "";
    const where = REF_STATUS.includes(st) ? "WHERE r.status = ?" : st === "other" ? "WHERE r.affiliate_id IS NULL" : "";
    const refs = (await db.prepare(`${REF_SELECT} ${where} ORDER BY CASE r.status WHEN 'closed' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, r.created_at DESC LIMIT 500`)
      .bind(...(REF_STATUS.includes(st) ? [st] : [])).all()).results;
    for (const r of refs) if (r.property_id) r.deals = (await db.prepare("SELECT track, stage FROM deals WHERE property_id = ?").bind(r.property_id).all()).results;
    return json({ ok: true, affiliates: affs, referrals: refs, payout: AFF_PAYOUT });
  }
  if (m === "POST" && what === "affiliate" && !id) {
    const name = clean(b.name, 120);
    if (name.split(/\s+/).length < 2) return json({ ok: false, message: "Enter the affiliate's first and last name." }, 400);
    const pk = phoneKey(b.phone);
    if (pk && await db.prepare("SELECT id FROM affiliates WHERE phone_key = ?").bind(pk).first()) return json({ ok: false, message: "An affiliate with this phone is already on the list." }, 409);
    const nid = newId("af");
    await db.prepare(`INSERT INTO affiliates (id, ref, name, phone, phone_key, email, city, company, status, on_site, licensed, broker, pay_method, agreement_at, lang, consent, consent_text, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(nid, "AF-" + code(5), name, pk ? fmtPhone(b.phone) : null, pk || null, emailKey(b.email) || null,
      clean(b.city, 80) || null, clean(b.company, 160) || null, b.on_site === false ? 0 : 1, b.licensed ? 1 : 0, clean(b.broker, 160) || null, clean(b.pay_method, 120) || null,
      clean(b.agreement_at, 10) || null, b.lang === "es" ? "es" : "en", b.consent ? 1 : 0, b.consent ? `Recorded by ${u.email} in the back office: ${clean(b.consent_note, 300) || "affiliate agreed to calls/texts"}` : null,
      clean(b.notes, 4000) || null, t, t).run();
    return json({ ok: true, id: nid });
  }
  if (m === "GET" && what === "affiliate" && id) {
    const a = await db.prepare("SELECT * FROM affiliates WHERE id = ?").bind(id).first();
    if (!a) return json({ ok: false, message: "Not found." }, 404);
    const refs = (await db.prepare(`${REF_SELECT} WHERE r.affiliate_id = ? ORDER BY r.created_at DESC`).bind(id).all()).results;
    return json({ ok: true, affiliate: a, referrals: refs });
  }
  if (m === "PATCH" && what === "affiliate" && id) {
    const set = [], vals = [];
    for (const k of A_FIELDS) if (k in b) {
      const v = clean(b[k], 4000) || null;
      if (k === "status" && !AFF_STATUS.includes(v)) continue;
      if (k === "lang" && !["en", "es"].includes(v)) continue;
      if (k === "w9") { if (!W9.includes(v)) continue; set.push("w9_at = CASE WHEN COALESCE(w9,'') != ? THEN ? ELSE w9_at END"); vals.push(v, t); }
      if (k === "name" && (!v || v.split(/\s+/).length < 2)) return json({ ok: false, message: "Enter a first and last name." }, 400);
      set.push(`${k} = ?`); vals.push(k === "email" ? emailKey(v) || null : v);
    }
    if ("phone" in b) { set.push("phone = ?", "phone_key = ?"); vals.push(phoneKey(b.phone) ? fmtPhone(b.phone) : clean(b.phone, 40) || null, phoneKey(b.phone) || null); }
    for (const k of ["on_site", "licensed"]) if (k in b) { set.push(`${k} = ?`); vals.push(b[k] === true || b[k] === "on" || b[k] === "1" ? 1 : 0); }
    if (b.consent === true) { set.push("consent = 1", "consent_text = ?"); vals.push(`Recorded by ${u.email} on ${today()}: ${clean(b.consent_note, 300) || "affiliate agreed to calls/texts"}`); }
    if (b.consent === false) set.push("consent = 0");
    if (set.length) await db.prepare(`UPDATE affiliates SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, id).run();
    return json({ ok: true });
  }
  if (m === "POST" && what === "referral" && !id) { // added by hand (a referral called in, texted, etc.)
    const aff = b.affiliate_id ? await db.prepare("SELECT id FROM affiliates WHERE id = ?").bind(b.affiliate_id).first() : null;
    const other = clean(b.other_name, 120);
    if (!aff && !other) return json({ ok: false, message: "Pick an affiliate, or type the referrer's name under Other." }, 400);
    const addr = clean(b.property_address, 300);
    if (!addr) return json({ ok: false, message: "Enter the property address." }, 400);
    const nid = newId("rf");
    await db.prepare(`INSERT INTO referrals (id, ref, affiliate_id, other_name, seller_name, seller_phone, property_address, addr_key, status, payout, notes, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, 'office', ?, ?)`).bind(nid, "RF-" + code(5), aff ? aff.id : null, aff ? null : other, clean(b.seller_name, 160) || null,
      clean(b.seller_phone, 40) || null, addr, addrKey(addr), aff ? AFF_PAYOUT : 0, clean(b.notes, 4000) || null, t, t).run();
    return json({ ok: true, id: nid });
  }
  if (m === "GET" && what === "referral" && id) {
    const r = await db.prepare(`${REF_SELECT} WHERE r.id = ?`).bind(id).first();
    if (!r) return json({ ok: false, message: "Not found." }, 404);
    const lead = r.lead_id ? await db.prepare("SELECT ref, created_at, name, phone, email, property_address, property_type, property_condition, timeline, details, status FROM leads WHERE id = ?").bind(r.lead_id).first() : null;
    const deals = r.property_id ? (await db.prepare("SELECT id, track, stage, ref FROM deals WHERE property_id = ?").bind(r.property_id).all()).results : [];
    const affiliates = (await db.prepare("SELECT id, name, status FROM affiliates ORDER BY name COLLATE NOCASE").all()).results;
    return json({ ok: true, referral: r, lead, deals, affiliates, tracks: TRACKS });
  }
  if (m === "POST" && what === "referral" && id && action) {
    const r = await db.prepare("SELECT * FROM referrals WHERE id = ?").bind(id).first();
    if (!r) return json({ ok: false, message: "Not found." }, 404);
    const upd = (sql, ...v) => db.prepare(`UPDATE referrals SET ${sql}, updated_at = ? WHERE id = ?`).bind(...v, t, id).run();
    if (action === "assign") {
      if (r.status === "paid") return json({ ok: false, message: "Already paid; the referrer can't change now." }, 400);
      const aff = b.affiliate_id ? await db.prepare("SELECT id FROM affiliates WHERE id = ?").bind(b.affiliate_id).first() : null;
      const other = clean(b.other_name, 120);
      if (!aff && !other) return json({ ok: false, message: "Pick an affiliate, or type a name under Other." }, 400);
      await upd("affiliate_id = ?, other_name = ?, payout = ?", aff ? aff.id : null, aff ? null : other, aff ? AFF_PAYOUT : 0);
      return json({ ok: true });
    }
    if (action === "closed") {
      if (r.status !== "open") return json({ ok: false, message: "Only open referrals can be marked closed." }, 400);
      await upd("status = 'closed', closed_on = ?", ymd(b.date));
      return json({ ok: true });
    }
    if (action === "paid") {
      if (r.status !== "closed") return json({ ok: false, message: "Mark the deal closed first." }, 400);
      if (!r.affiliate_id) return json({ ok: false, message: "Non-affiliate referrers aren't paid. Assign an affiliate first if this person should be paid." }, 400);
      const amt = num(b.amount); if (amt != null && amt >= 0) await upd("payout = ?", amt);
      await upd("status = 'paid', paid_on = ?, pay_method = ?, pay_note = ?", ymd(b.date), clean(b.method, 40) || "other", clean(b.note, 500) || null);
      return json({ ok: true });
    }
    if (action === "void") {
      if (r.status === "paid") return json({ ok: false, message: "Already paid." }, 400);
      const why = clean(b.reason, 300); if (!why) return json({ ok: false, message: "Give a reason." }, 400);
      await upd("status = 'void', void_reason = ?", why);
      return json({ ok: true });
    }
    if (action === "reopen") {
      if (!["void", "closed"].includes(r.status)) return json({ ok: false, message: "Nothing to reopen." }, 400);
      await upd("status = 'open', void_reason = NULL, closed_on = NULL");
      return json({ ok: true });
    }
    if (action === "notes") { await upd("notes = ?", clean(b.note, 4000) || null); return json({ ok: true }); }
    if (action === "payout") { const v = num(b.amount); if (v == null || v < 0) return json({ ok: false, message: "Enter an amount." }, 400); await upd("payout = ?", v); return json({ ok: true }); }
  }
  return json({ ok: false, message: "Not found." }, 404);
}
