// Bird-Dog Program: people who refer verified motivated sellers and earn a flat $500 per funded deal.
// Public:  POST /api/birddog/join  (bird-dog.html)        -> new bird-dog + private portal key
//          GET  /api/birddog/me    (bird-dog-portal.html) -> their profile and leads   (header x-bd-key)
//          POST /api/birddog/lead  (bird-dog-portal.html) -> submit a lead with photos (header x-bd-key)
// Office:  /api/office/bd/*  (officeBirddogApi, called from src/office.js after the Access check)
// Tables in src/birddog.sql. Texas properties only (for now). New-business POSTs are closed on Shabbat (src/worker.js).
// A lead qualifies only if: the bird-dog spoke with the owner (or heir/executor/spouse) in the last 30 days, the owner agreed
// we may contact them, a motivation reason is given, at least one photo is attached, and the property is new to us
// (not in the master list and not claimed by another bird-dog first; a partial unique index enforces first claim).

import { propertyKey, phoneKey, emailKey, fmtPhone, zip5, zipState, TRACKS } from "../js/hub-keys.js";
import { newId, upsertProperty, upsertContact, linkContact, upsertDeal, logActivity } from "./office.js";

export const BD_TERMS_VERSION = "2026-11-13";
export const BD_PAYOUT = 500;
export const MOTIVATIONS = ["Behind on payments / foreclosure", "Tax lien or back taxes", "Inherited / probate", "Vacant or abandoned", "Needs major repairs",
  "Divorce", "Relocating / job change", "Tired landlord / bad tenants", "Code violations", "Health or age (downsizing)", "Other"];
export const RELATIONS = ["owner", "heir", "executor", "spouse", "other"];
export const PROP_TYPES = ["Single-family", "Duplex to fourplex", "Mobile home on land", "Land", "Apartment complex", "RV park", "Mobile home park", "Commercial", "Other"];
const MAX_PHOTOS = 4, MAX_PHOTO_B64 = 950_000, LEADS_PER_DAY = 10;
const BD_STATUS = ["active", "paused", "removed"];
const W9 = ["not requested", "requested", "received"];

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => ALPHA[x % ALPHA.length]).join("");
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");
const clean = (v, max = 500) => (v == null ? "" : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max));
const num = (v) => (v === "" || v == null || !isFinite(Number(String(v).replace(/[$,]/g, ""))) ? null : Number(String(v).replace(/[$,]/g, "")));
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
async function sha256(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(""); }
function H(request) {
  const origin = request.headers.get("origin") || "";
  const ok = /^https:\/\/(www\.)?houselotandland\.org$/.test(origin) || /\.workers\.dev$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "Access-Control-Allow-Origin": ok ? origin : "https://houselotandland.org", Vary: "Origin" };
}

// Public lead status as the bird-dog sees it.
function publicLead(l) {
  return { ref: l.ref, address: l.address, city: l.city, zip: l.zip, status: l.status, reason: l.status === "rejected" ? l.reason || "" : "",
    submitted: l.created_at, verified: l.verified_at, funded: l.funded_at, paid: l.paid_at, payout: l.payout };
}
async function dogFromKey(request, env) {
  const k = clean(request.headers.get("x-bd-key"), 64);
  if (!/^[a-z0-9]{24}$/.test(k)) return null;
  return env.DB.prepare("SELECT * FROM birddogs WHERE token = ?").bind(k).first();
}

export async function handleBirddogApi(request, env, url) {
  const headers = H(request);
  const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-BD-Key" } });
  const path = url.pathname.replace(/^\/api\/birddog\/?/, "");
  try {
    if (path === "join" && request.method === "POST") return out(...(await join(request, env)));
    if (path === "me" && request.method === "GET") {
      const d = await dogFromKey(request, env);
      if (!d || d.status === "removed") return out({ success: false, message: "This link isn't active. Call or text 214-702-1519." }, 404);
      const leads = (await env.DB.prepare("SELECT * FROM birddog_leads WHERE birddog_id = ? ORDER BY created_at DESC LIMIT 200").bind(d.id).all()).results;
      const sum = (st) => leads.filter((l) => st.includes(l.status)).reduce((a, l) => a + (l.payout || 0), 0);
      return out({ success: true, me: { ref: d.ref, name: d.name, lang: d.lang, status: d.status, w9: d.w9, licensed: !!d.licensed },
        leads: leads.map(publicLead), totals: { submitted: leads.length, verified: leads.filter((l) => ["verified", "closed", "paid"].includes(l.status)).length, owed: sum(["closed"]), paid: sum(["paid"]) },
        lists: { motivations: MOTIVATIONS, relations: RELATIONS, types: PROP_TYPES } });
    }
    if (path === "lead" && request.method === "POST") return out(...(await submitLead(request, env)));
    return out({ success: false, message: "Not found" }, 404);
  } catch (e) {
    return out({ success: false, message: "Something went wrong. Please call or text 214-702-1519." }, 500);
  }
}

async function join(request, env) {
  let b; try { b = await request.json(); } catch { return [{ success: false, message: "Could not read the form." }, 400]; }
  if (clean(b.hll_hp)) return [{ success: true, ref: "BD-OK" }];
  const es = b.lang === "es", E = (en, sp) => (es ? sp : en);
  const name = clean(b.name, 120), pk = phoneKey(b.phone), email = emailKey(b.email);
  if (name.split(/\s+/).length < 2) return [{ success: false, message: E("Please enter your full name.", "Escriba su nombre completo.") }, 400];
  if (!pk) return [{ success: false, message: E("Please enter a 10-digit phone number.", "Escriba un número de teléfono de 10 dígitos.") }, 400];
  if (!email) return [{ success: false, message: E("Please enter your email so we can send your private link.", "Escriba su correo para enviarle su enlace privado.") }, 400];
  if (b.adult !== true) return [{ success: false, message: E("You must be 18 or older.", "Debe tener 18 años o más.") }, 400];
  if (b.terms !== true) return [{ success: false, message: E("Please agree to the Bird-Dog Program Terms.", "Acepte los Términos del Programa.") }, 400];
  const licensed = b.licensed === true, broker = clean(b.broker, 160);
  if (licensed && !broker) return [{ success: false, message: E("Licensed agents: enter your sponsoring broker so the fee can be paid to them.", "Agentes con licencia: escriba su corredor patrocinador.") }, 400];

  const ipHash = await sha256((request.headers.get("cf-connecting-ip") || "") + "|hll-bd");
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM birddogs WHERE ip_hash = ? AND created_at > ?").bind(ipHash, new Date(Date.now() - 30 * 60e3).toISOString()).first();
  if (recent && recent.n >= 3) return [{ success: false, message: E("We already have your sign-up.", "Ya recibimos su registro.") }, 429];

  const ex = await env.DB.prepare("SELECT id, ref FROM birddogs WHERE phone_key = ?").bind(pk).first();
  // The private link is never handed out again from the public form (anyone could type a phone number). The office resends it.
  if (ex) return [{ success: true, again: true, ref: ex.ref }];
  const t = new Date().toISOString(), id = newId("bd"), ref = "BD-" + code(5), tok = token();
  await env.DB.prepare(`INSERT INTO birddogs (id, ref, token, name, phone, phone_key, email, city, zip, lang, status, licensed, broker, terms_version, terms_at, consent, consent_text, ip_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, ref, tok, name, fmtPhone(b.phone), pk, email, clean(b.city, 80), zip5(b.zip) || null,
    es ? "es" : "en", licensed ? 1 : 0, licensed ? broker : null, BD_TERMS_VERSION, t, b.consent === true ? 1 : 0, b.consent === true ? clean(b.consent_text, 600) : "", ipHash, t, t).run();
  return [{ success: true, ref, key: tok }];
}

async function submitLead(request, env) {
  const d = await dogFromKey(request, env);
  if (!d || d.status === "removed") return [{ success: false, message: "This link isn't active. Call or text 214-702-1519." }, 403];
  let b; try { b = await request.json(); } catch { return [{ success: false, message: "Could not read the form (photos may be too large)." }, 400]; }
  if (clean(b.hll_hp)) return [{ success: true, ref: "BL-OK" }];
  const es = (b.lang || d.lang) === "es", E = (en, sp) => (es ? sp : en);
  if (d.status !== "active") return [{ success: false, message: E("Your account is paused. Call or text 214-702-1519.", "Su cuenta está en pausa. Llame o escriba al 214-702-1519.") }, 403];

  const address = clean(b.address, 200), city = clean(b.city, 80), zip = zip5(b.zip);
  if (!/^\d+[A-Za-z]?\s+\S+/.test(address)) return [{ success: false, message: E("Enter the street address (number and street).", "Escriba la dirección (número y calle).") }, 400];
  if (!zip) return [{ success: false, message: E("Enter the 5-digit ZIP code.", "Escriba el código postal de 5 dígitos.") }, 400];
  if (zipState(zip) !== "TX") return [{ success: false, message: E("Right now we only accept Texas properties.", "Por ahora solo aceptamos propiedades en Texas.") }, 400];
  const ownerName = clean(b.owner_name, 160), ownerPk = phoneKey(b.owner_phone), relation = RELATIONS.includes(b.relation) ? b.relation : "";
  if (!ownerName) return [{ success: false, message: E("Enter the owner's name (or the family member you spoke with).", "Escriba el nombre del dueño (o del familiar con quien habló).") }, 400];
  if (!ownerPk) return [{ success: false, message: E("Enter a 10-digit phone number for the owner so we can verify.", "Escriba un teléfono de 10 dígitos del dueño para verificar.") }, 400];
  if (!relation) return [{ success: false, message: E("Choose who you spoke with.", "Elija con quién habló.") }, 400];
  const motivation = (Array.isArray(b.motivation) ? b.motivation : []).filter((x) => MOTIVATIONS.includes(x));
  const situation = clean(b.situation, 3000);
  if (!motivation.length) return [{ success: false, message: E("Choose at least one reason the owner wants to sell.", "Elija al menos una razón por la que el dueño quiere vender.") }, 400];
  if (motivation.includes("Other") && situation.length < 10) return [{ success: false, message: E("Describe the owner's situation.", "Describa la situación del dueño.") }, 400];
  const spoke = clean(b.spoke_on, 10);
  const daysAgo = /^\d{4}-\d{2}-\d{2}$/.test(spoke) ? (new Date(today() + "T12:00:00Z") - new Date(spoke + "T12:00:00Z")) / 864e5 : NaN;
  if (!(daysAgo >= 0 && daysAgo <= 30)) return [{ success: false, message: E("The date you spoke with the owner must be within the last 30 days.", "La fecha en que habló con el dueño debe ser de los últimos 30 días.") }, 400];
  if (b.owner_ok !== true) return [{ success: false, message: E("The owner must agree that House Lot & Land may contact them.", "El dueño debe aceptar que House Lot & Land lo contacte.") }, 400];
  if (b.attest !== true) return [{ success: false, message: E("Please confirm the statements at the bottom of the form.", "Confirme las declaraciones al final del formulario.") }, 400];
  const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, MAX_PHOTOS).map((p) => String(p || "")).map((p) => p.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)).filter(Boolean);
  if (!photos.length) return [{ success: false, message: E("Add at least one photo of the property.", "Agregue al menos una foto de la propiedad.") }, 400];
  if (photos.some((p) => p[2].length > MAX_PHOTO_B64)) return [{ success: false, message: E("A photo is too large. Try again (the page shrinks photos automatically) or use a smaller one.", "Una foto es demasiado grande. Intente con otra más pequeña.") }, 400];
  if (/\b\d{3}-?\d{2}-?\d{4}\b/.test(situation)) return [{ success: false, message: E("Please don't type Social Security numbers here.", "No escriba números de Seguro Social aquí.") }, 400];

  const db = env.DB, t = new Date().toISOString();
  const n = await db.prepare("SELECT COUNT(*) AS n FROM birddog_leads WHERE birddog_id = ? AND created_at > ?").bind(d.id, new Date(Date.now() - 864e5).toISOString()).first();
  if (n && n.n >= LEADS_PER_DAY) return [{ success: false, message: E("You've reached today's limit of 10 leads. Thank you! Send more tomorrow.", "Llegó al límite de 10 por día. ¡Gracias! Envíe más mañana.") }, 429];

  const key = propertyKey({ address, city, zip, state: "TX" });
  const onFile = await db.prepare("SELECT id FROM properties WHERE addr_key = ?").bind(key).first();
  if (onFile) return [{ success: false, dup: true, message: E("This property is already in our system, so it doesn't qualify. Thanks for sending it!", "Esta propiedad ya está en nuestro sistema, así que no califica. ¡Gracias por enviarla!") }, 409];
  const claimed = await db.prepare("SELECT birddog_id FROM birddog_leads WHERE addr_key = ? AND status != 'rejected'").bind(key).first();
  if (claimed) return [{ success: false, dup: true, message: claimed.birddog_id === d.id ? E("You already submitted this property.", "Ya envió esta propiedad.")
    : E("Another bird-dog already submitted this property first, so it doesn't qualify.", "Otro participante ya envió esta propiedad primero, así que no califica.") }, 409];

  const id = newId("bl"), ref = "BL-" + code(5), ipHash = await sha256((request.headers.get("cf-connecting-ip") || "") + "|hll-bd");
  const stmts = [db.prepare(`INSERT INTO birddog_leads (id, ref, birddog_id, addr_key, address, city, state, zip, prop_type, owner_name, owner_phone, owner_email, relation, motivation, situation,
      asking, spoke_on, owner_ok, photos, status, payout, ip_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'TX', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'submitted', ?, ?, ?, ?)`)
    .bind(id, ref, d.id, key, address, city || null, zip, PROP_TYPES.includes(b.prop_type) ? b.prop_type : null, ownerName, fmtPhone(b.owner_phone), emailKey(b.owner_email) || null, relation,
      JSON.stringify(motivation), situation, num(b.asking), spoke, photos.length, BD_PAYOUT, ipHash, t, t)];
  photos.forEach((p, i) => stmts.push(db.prepare("INSERT INTO birddog_photos (id, lead_id, n, mime, data, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(newId("bp"), id, i + 1, p[1], p[2], Math.round(p[2].length * 0.75), t)));
  try { await db.batch(stmts); }
  catch (e) { // lost a race for the same address
    if (/UNIQUE/i.test(String(e && e.message))) return [{ success: false, dup: true, message: E("This property was just submitted by someone else.", "Alguien más acaba de enviar esta propiedad.") }, 409];
    throw e;
  }
  return [{ success: true, ref }];
}

// ---------------- back office: /api/office/bd/* ----------------
const LEAD_SELECT = `SELECT l.*, b.name AS dog_name, b.ref AS dog_ref, b.w9 AS dog_w9, b.licensed AS dog_licensed, b.broker AS dog_broker, dl.stage AS deal_stage, dl.track AS deal_track
  FROM birddog_leads l JOIN birddogs b ON b.id = l.birddog_id LEFT JOIN deals dl ON dl.id = l.deal_id`;
const LEAD_STATUS = ["submitted", "verified", "rejected", "closed", "paid"];
const shape = (l) => ({ ...l, motivation: parse(l.motivation) || [], deal_closed: ["Closed", "Assigned"].includes(l.deal_stage) });

export async function officeBirddogApi(db, m, seg, b, u, t, url, json) {
  // seg[0] === "bd"
  const [, what, id, action] = seg;
  if (m === "GET" && what === "summary") {
    const dogs = (await db.prepare(`SELECT b.*, (SELECT COUNT(*) FROM birddog_leads l WHERE l.birddog_id = b.id) AS leads,
      (SELECT COUNT(*) FROM birddog_leads l WHERE l.birddog_id = b.id AND l.status IN ('verified','closed','paid')) AS good,
      (SELECT COALESCE(SUM(payout),0) FROM birddog_leads l WHERE l.birddog_id = b.id AND l.status = 'closed') AS owed,
      (SELECT COALESCE(SUM(payout),0) FROM birddog_leads l WHERE l.birddog_id = b.id AND l.status = 'paid' AND l.paid_at >= ?) AS paid_ytd
      FROM birddogs b ORDER BY CASE b.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, b.created_at DESC`).bind(today().slice(0, 4) + "-01-01").all()).results;
    const st = url.searchParams.get("status");
    const leads = (await db.prepare(`${LEAD_SELECT} ${LEAD_STATUS.includes(st) ? "WHERE l.status = ?" : ""} ORDER BY CASE l.status WHEN 'submitted' THEN 0 WHEN 'closed' THEN 1 WHEN 'verified' THEN 2 ELSE 3 END, l.created_at DESC LIMIT 500`)
      .bind(...(LEAD_STATUS.includes(st) ? [st] : [])).all()).results.map(shape);
    return json({ ok: true, dogs: dogs.map(({ token, ...x }) => x), leads, payout: BD_PAYOUT });
  }
  if (m === "GET" && what === "dog" && id) {
    const d = await db.prepare("SELECT * FROM birddogs WHERE id = ?").bind(id).first();
    if (!d) return json({ ok: false, message: "Not found." }, 404);
    const leads = (await db.prepare(`${LEAD_SELECT} WHERE l.birddog_id = ? ORDER BY l.created_at DESC`).bind(id).all()).results.map(shape);
    return json({ ok: true, dog: d, leads });
  }
  if (m === "PATCH" && what === "dog" && id) {
    const set = [], vals = [];
    for (const k of ["name", "email", "city", "zip", "pay_method", "notes", "broker", "status", "w9", "lang"]) if (k in b) {
      const v = clean(b[k], 4000) || null;
      if (k === "status" && !BD_STATUS.includes(v)) continue;
      if (k === "w9") { if (!W9.includes(v)) continue; set.push("w9_at = CASE WHEN COALESCE(w9,'') != ? THEN ? ELSE w9_at END"); vals.push(v, t); }
      if (k === "lang" && !["en", "es"].includes(v)) continue;
      set.push(`${k} = ?`); vals.push(k === "email" ? emailKey(v) || null : v);
    }
    if ("phone" in b) { set.push("phone = ?", "phone_key = ?"); vals.push(fmtPhone(b.phone), phoneKey(b.phone) || null); }
    if (b.new_key === true) { set.push("token = ?"); vals.push(token()); } // the old private link stops working
    if (set.length) await db.prepare(`UPDATE birddogs SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, id).run();
    return json({ ok: true });
  }
  if (m === "GET" && what === "lead" && id) {
    const l = await db.prepare(`${LEAD_SELECT} WHERE l.id = ?`).bind(id).first();
    if (!l) return json({ ok: false, message: "Not found." }, 404);
    const photos = (await db.prepare("SELECT id, n, mime, bytes FROM birddog_photos WHERE lead_id = ? ORDER BY n").bind(id).all()).results;
    const dog = await db.prepare("SELECT id, ref, name, phone, email, w9, licensed, broker, status, token FROM birddogs WHERE id = ?").bind(l.birddog_id).first();
    return json({ ok: true, lead: shape(l), photos, dog });
  }
  if (m === "GET" && what === "photo" && id) {
    const p = await db.prepare("SELECT mime, data FROM birddog_photos WHERE id = ?").bind(id).first();
    if (!p) return new Response("Not found", { status: 404 });
    const bin = Uint8Array.from(atob(p.data), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { "content-type": p.mime, "cache-control": "private, max-age=3600" } });
  }
  if (m === "POST" && what === "lead" && id && action) {
    const l = await db.prepare("SELECT * FROM birddog_leads WHERE id = ?").bind(id).first();
    if (!l) return json({ ok: false, message: "Not found." }, 404);
    const dog = await db.prepare("SELECT * FROM birddogs WHERE id = ?").bind(l.birddog_id).first();
    const note = clean(b.note, 2000);
    const upd = (sql, ...v) => db.prepare(`UPDATE birddog_leads SET ${sql}, updated_at = ? WHERE id = ?`).bind(...v, t, id).run();

    if (action === "verify") {
      if (l.status !== "submitted") return json({ ok: false, message: "Only new submissions can be verified." }, 400);
      if (!["wholesale", "subto", "creative"].includes(b.track)) return json({ ok: false, message: "Pick a track." }, 400);
      const earlier = await db.prepare("SELECT id FROM properties WHERE addr_key = ? AND created_at < ?").bind(l.addr_key, l.created_at).first();
      if (earlier) return json({ ok: false, message: "This property was already on file before the bird-dog sent it. Reject it as a duplicate." }, 409);
      const p = await upsertProperty(db, { address: l.address, city: l.city, zip: l.zip, state: "TX", prop_type: l.prop_type,
        data: { birddog: { lead: l.ref, by: dog.ref } } }, t);
      const c = await upsertContact(db, { name: l.owner_name, phone: l.owner_phone, email: l.owner_email,
        notes: `Referred by bird-dog ${dog.name} (${dog.ref}), lead ${l.ref}. Bird-dog says this person agreed House Lot & Land may contact them (spoke ${l.spoke_on}). No text consent yet: record it after you speak with them.` }, t);
      if (c) await linkContact(db, p.id, c.id, l.relation === "other" ? "contact" : l.relation, t);
      const mot = (parse(l.motivation) || []).join(", ");
      const dl = await upsertDeal(db, { property_id: p.id, contact_id: c && c.id, track: b.track, source: `Bird-dog ${dog.ref} (${dog.name})`, source_app: "birddog", source_id: l.id,
        asking: l.asking, next_touch: today(), notes: [`Motivation: ${mot}`, l.situation, note].filter(Boolean).join("\n") }, t);
      await logActivity(db, { property_id: p.id, contact_id: c && c.id, deal_id: dl.id, kind: "note", by: u.email, source: "birddog",
        summary: `Bird-dog lead ${l.ref} from ${dog.name} (${dog.ref}) verified into ${TRACKS[b.track].label}. $${l.payout} owed to the bird-dog if this deal funds. ${mot}` }, t);
      await upd("status = 'verified', track = ?, property_id = ?, deal_id = ?, verified_at = ?, office_notes = COALESCE(?, office_notes)", b.track, p.id, dl.id, t, note || null);
      return json({ ok: true, property_id: p.id, deal_id: dl.id });
    }
    if (action === "reject") {
      if (!["submitted", "verified"].includes(l.status)) return json({ ok: false, message: "This lead can't be rejected now." }, 400);
      const reason = clean(b.reason, 300);
      if (!reason) return json({ ok: false, message: "Give a reason (the bird-dog sees it)." }, 400);
      await upd("status = 'rejected', reason = ?", reason);
      if (l.property_id) await logActivity(db, { property_id: l.property_id, deal_id: l.deal_id, kind: "note", by: u.email, source: "birddog", summary: `Bird-dog lead ${l.ref} rejected: ${reason}. No payout.` }, t);
      return json({ ok: true });
    }
    if (action === "reopen") {
      if (l.status !== "rejected") return json({ ok: false, message: "Only rejected leads can be reopened." }, 400);
      const other = await db.prepare("SELECT ref FROM birddog_leads WHERE addr_key = ? AND status != 'rejected' AND id != ?").bind(l.addr_key, id).first();
      if (other) return json({ ok: false, message: `Another bird-dog lead (${other.ref}) now holds this address.` }, 409);
      await upd("status = ?, reason = NULL", l.verified_at ? "verified" : "submitted");
      return json({ ok: true });
    }
    if (action === "funded") {
      if (l.status !== "verified") return json({ ok: false, message: "Verify the lead first." }, 400);
      const at = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : today();
      await upd("status = 'closed', funded_at = ?", at);
      if (l.property_id) await logActivity(db, { property_id: l.property_id, deal_id: l.deal_id, kind: "note", by: u.email, source: "birddog",
        summary: `Deal funded ${at}. $${l.payout} now owed to bird-dog ${dog.name} (${dog.ref}), lead ${l.ref}.` }, t);
      return json({ ok: true });
    }
    if (action === "paid") {
      if (l.status !== "closed") return json({ ok: false, message: "Mark the deal funded first." }, 400);
      const at = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : today(), how = clean(b.method, 40) || "other";
      await upd("status = 'paid', paid_at = ?, pay_method = ?, pay_note = ?", at, how, note || null);
      if (l.property_id) await logActivity(db, { property_id: l.property_id, deal_id: l.deal_id, kind: "note", by: u.email, source: "birddog",
        summary: `Paid bird-dog ${dog.name} (${dog.ref}) $${l.payout} by ${how} on ${at} for lead ${l.ref}.${dog.licensed ? ` Paid to broker: ${dog.broker || "?"}.` : ""}` }, t);
      return json({ ok: true });
    }
    if (action === "notes") { await upd("office_notes = ?", note || null); return json({ ok: true }); }
    if (action === "payout") { const v = num(b.amount); if (v == null || v < 0) return json({ ok: false, message: "Enter an amount." }, 400); await upd("payout = ?", v); return json({ ok: true }); }
  }
  return json({ ok: false, message: "Not found." }, 404);
}
