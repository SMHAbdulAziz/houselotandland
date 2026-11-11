// POST /api/worker/apply — crew and independent contractor applications from /work-with-us.html.
// Saved to the "workers" table with status "applied"; Harvey reviews them in the back office (/office).
// Never collects SSNs, tax IDs, ID or bank numbers: W-9s are requested privately after approval.
// Closed on Shabbat by the Worker's NEW_BUSINESS check (src/worker.js).

import { phoneKey, emailKey, fmtPhone } from "../js/hub-keys.js";
import { newId } from "./office.js";

export const TRADES = ["Mowing and edging", "Landscaping, beds and mulch", "Pressure washing", "Painting (interior or exterior)", "Debris haul-off",
  "Cleaning and make-ready", "Handyman (no licensed trades)", "Gutters", "Property checks and photos", "Moving and labor"];
export const EQUIPMENT = ["Truck", "Trailer", "Mower and trimmer", "Pressure washer", "Painting gear", "Ladder", "Own hand tools"];
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const H = (request) => {
  const origin = request.headers.get("origin") || "";
  const ok = /^https:\/\/(www\.)?houselotandland\.org$/.test(origin) || /\.workers\.dev$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "Access-Control-Allow-Origin": ok ? origin : "https://houselotandland.org", Vary: "Origin" };
};
const clean = (v, max = 500) => (v == null ? "" : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max));
const pick = (arr, allowed) => (Array.isArray(arr) ? arr.filter((x) => allowed.includes(x)) : []);
async function sha256(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(""); }

export async function handleWorkerApply(request, env) {
  const headers = H(request);
  const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (request.method !== "POST") return out({ success: false, message: "Method not allowed" }, 405);
  let b; try { b = await request.json(); } catch { return out({ success: false, message: "Could not read the form." }, 400); }
  if (clean(b.hll_hp)) return out({ success: true, ref: "WK-OK" });
  const es = b.lang === "es";
  const name = clean(b.name, 120), pk = phoneKey(b.phone), email = emailKey(b.email);
  if (name.split(/\s+/).length < 2) return out({ success: false, message: es ? "Escriba su nombre completo." : "Please enter your full name." }, 400);
  if (!pk) return out({ success: false, message: es ? "Escriba un número de teléfono de 10 dígitos." : "Please enter a 10-digit phone number." }, 400);
  if (b.adult !== true) return out({ success: false, message: es ? "Debe tener 18 años o más." : "You must be 18 or older to apply." }, 400);
  if (b.ack !== true) return out({ success: false, message: es ? "Marque que entiende cómo funciona el trabajo." : "Please check that you understand how the work is paid." }, 400);
  const trades = pick(b.trades, TRADES);
  if (!trades.length) return out({ success: false, message: es ? "Elija al menos un tipo de trabajo." : "Choose at least one kind of work." }, 400);
  // Refuse anything that looks like a Social Security or tax ID typed into a free-text box.
  const text = clean(b.experience, 2000);
  if (/\b\d{3}-?\d{2}-?\d{4}\b/.test(text)) return out({ success: false, message: es ? "No escriba números de Seguro Social ni de impuestos aquí." : "Please don't type Social Security or tax ID numbers here." }, 400);

  const ipHash = await sha256((request.headers.get("cf-connecting-ip") || "") + "|hll-work");
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM workers WHERE ip_hash = ? AND created_at > ?").bind(ipHash, new Date(Date.now() - 30 * 60e3).toISOString()).first();
  if (recent && recent.n >= 4) return out({ success: false, message: es ? "Ya recibimos su solicitud." : "We already have your application." }, 429);

  const t = new Date().toISOString();
  const ex = await env.DB.prepare("SELECT id, ref, status FROM workers WHERE phone_key = ?").bind(pk).first();
  if (ex) {
    const line = `Applied again ${t.slice(0, 10)}: ${trades.join(", ")}${text ? " · " + text.slice(0, 300) : ""}`;
    await env.DB.prepare("UPDATE workers SET notes = CASE WHEN COALESCE(notes, '') = '' THEN ? ELSE notes || char(10) || ? END, updated_at = ? WHERE id = ?")
      .bind(line, line, t, ex.id).run();
    return out({ success: true, ref: ex.ref, again: true });
  }
  const id = newId("w"), ref = "WK-" + id.slice(2, 7).toUpperCase();
  await env.DB.prepare(`INSERT INTO workers (id, ref, name, phone, phone_key, email, city, zip, lang, kind, trades, equipment, availability, experience, status, consent, consent_text, ip_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?, ?, ?, ?, ?)`).bind(
    id, ref, name, fmtPhone(b.phone), pk, email || null, clean(b.city, 80), clean(b.zip, 10), es ? "es" : "en", b.kind === "crew" ? "crew" : "contractor",
    JSON.stringify(trades), JSON.stringify(pick(b.equipment, EQUIPMENT)), JSON.stringify(pick(b.availability, DAYS)), text,
    b.consent === true ? 1 : 0, b.consent === true ? clean(b.consent_text, 600) : "", ipHash, t, t).run();
  return out({ success: true, ref });
}
