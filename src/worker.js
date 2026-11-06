// House Lot & Land Sales Co. LLC — site Worker.
// Static pages are served from the repo root (see wrangler.jsonc). Only /api/* runs this code.
//
// POST /api/lead  — saves a website form submission to the D1 database "hll-leads".
//                   Claude's hourly task reads new rows and adds them to the Wholesale Deal Desk.
// POST /api/loan  — private money loan application (src/loan.js), table loan_apps.
// /api/service, /order/*, /api/stripe/webhook — service orders and Stripe (src/services.js).

import { handleOfferPage, handleOfferApi } from "./offer.js";
import { handleFindPage, handleFindApi } from "./find.js";
import { handleSignPage, handleSignApi, handleDocPage } from "./sign.js";
import { handleLoanApi } from "./loan.js";
import { handleServiceApi, handleOrderPage } from "./services.js";
import { shabbatStatus, closedMessage, TZ } from "../js/shabbat.js";

// New-business actions refused from sunset Friday to sunset Saturday (Shabbat). Viewing orders, documents,
// offer pages and "Find my offer" stays open, and Stripe webhooks are still recorded.
const NEW_BUSINESS = /^\/api\/(lead|loan|service|offer\/[^/]+\/(choose|callback|owners)|sign\/[^/]+|order\/[^/]+\/doc)$/;
// Customer pages rendered by this Worker get the Shabbat notice (mode=access: nothing is hidden).
const NOTICE_PAGES = /^\/(offer\/[^/]+|sign\/[^/]+|order\/[^/]+|find)\/?$/;

const REF_ALPHABET ="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_LEN = { name: 120, phone: 40, email: 160, property_address: 300, property_type: 60, property_condition: 60, timeline: 60, details: 3000 };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "POST" && NEW_BUSINESS.test(url.pathname)) {
      const st = shabbatStatus();
      if (st.closed) {
        const h = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": String(Math.max(60, Math.ceil((st.opensAt - Date.now()) / 1000))), ...cors(request) };
        return new Response(JSON.stringify({ success: false, ok: false, closed: true, opensAt: st.opensAt.toISOString(), message: closedMessage(st) }), { status: 503, headers: h });
      }
    }
    const res = await route(request, env, ctx, url);
    if (request.method === "GET" && NOTICE_PAGES.test(url.pathname) && (res.headers.get("content-type") || "").includes("text/html")) {
      return new HTMLRewriter().on("body", { element(el) { el.append('<script type="module" src="/js/shabbat-banner.js?mode=access"></script>', { html: true }); } }).transform(res);
    }
    return res;
  },
};

async function route(request, env, ctx, url) {
    if (url.pathname === "/find" || url.pathname === "/find/") return handleFindPage(request);
    let sm = url.pathname.match(/^\/sign\/([^/]+)\/?$/);
    if (sm && request.method === "GET") return handleSignPage(request, env, sm[1]);
    sm = url.pathname.match(/^\/api\/sign\/([^/]+)$/);
    if (sm) return handleSignApi(request, env, sm[1]);
    sm = url.pathname.match(/^\/doc\/([^/]+)\/?$/);
    if (sm && request.method === "GET") return handleDocPage(request, env, sm[1]);
    if (url.pathname === "/api/find") return handleFindApi(request, env);

    let m = url.pathname.match(/^\/offer\/([^/]+)\/?$/);
    if (m && request.method === "GET") return handleOfferPage(request, env, m[1], ctx);
    m = url.pathname.match(/^\/api\/offer\/([^/]+)\/(choose|callback|owners)$/);
    if (m) return handleOfferApi(request, env, m[1], m[2]);

    if (url.pathname === "/api/lead") {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
      if (request.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405, request);
      return handleLead(request, env);
    }
    if (url.pathname === "/api/loan") return handleLoanApi(request, env);
    if (url.pathname === "/api/service" || url.pathname === "/api/service/status" || url.pathname === "/api/stripe/webhook" || url.pathname.startsWith("/api/order/")) return handleServiceApi(request, env, url);
    if (url.pathname.startsWith("/order/")) return handleOrderPage(request, env, url);
    if (url.pathname === "/api/health") return json({ ok: true }, 200, request);
    if (url.pathname === "/api/hours") return hours();

    return env.ASSETS.fetch(request);
}

async function handleLead(request, env) {
  let body;
  try {
    const type = request.headers.get("content-type") || "";
    body = type.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return json({ success: false, message: "Could not read the form. Please try again." }, 400, request);
  }

  // Bots fill hidden fields; real visitors never see "website".
  if (clean(body.website)) return json({ success: true }, 200, request);

  const formType = body.form_type === "contact" ? "contact" : "offer";
  const f = {
    name: clean(body.name, MAX_LEN.name),
    phone: clean(body.phone, MAX_LEN.phone),
    email: clean(body.email, MAX_LEN.email),
    property_address: clean(body["property-address"] ?? body.property_address, MAX_LEN.property_address),
    property_type: clean(body["property-type"] ?? body.property_type, MAX_LEN.property_type),
    property_condition: clean(body["property-condition"] ?? body.property_condition, MAX_LEN.property_condition),
    timeline: clean(body.timeline, MAX_LEN.timeline),
    details: clean(body["property-details"] ?? body.details ?? body.message, MAX_LEN.details),
  };

  const missing = ["name", "phone", "email"].filter((k) => !f[k]);
  if (missing.length) return json({ success: false, message: "Please fill in: " + missing.join(", ") }, 400, request);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return json({ success: false, message: "Please enter a valid email address." }, 400, request);
  if (f.phone.replace(/\D/g, "").length < 10) return json({ success: false, message: "Please enter a 10-digit phone number." }, 400, request);

  const consent = formType === "offer" && truthy(body.consent) ? 1 : 0;
  const consentText = consent ? clean(body.consent_text, 600) : "";
  const lang = clean(body.lang, 5) === "es" ? "es" : "en";

  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? await sha256(ip + "|hll") : "";

  // Light flood control: at most 5 submissions per visitor per 10 minutes.
  if (ipHash) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM leads WHERE ip_hash = ? AND created_at > ?").bind(ipHash, since).first();
    if (row && row.n >= 5) return json({ success: false, message: "We already have your request. Please call us at 214-702-1519." }, 429, request);
  }

  const id = "web_" + crypto.randomUUID();
  const ref = makeRef();
  await env.DB.prepare(
    `INSERT INTO leads (id, ref, created_at, form_type, name, phone, email, property_address, property_type, property_condition, timeline, details, lang, consent, consent_text, ip_hash, user_agent, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, ref, new Date().toISOString(), formType,
    f.name, f.phone, f.email, f.property_address, f.property_type, f.property_condition, f.timeline, f.details,
    lang, consent, consentText, ipHash,
    clean(request.headers.get("user-agent"), 300), (request.cf && request.cf.country) || ""
  ).run();

  return json({ success: true, result: "success", ref }, 200, request);
}

function clean(v, max = 500) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}
function truthy(v) {
  return v === true || ["on", "true", "1", "yes"].includes(String(v).toLowerCase());
}
function makeRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return "HL-" + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
function cors(request) {
  const origin = request.headers.get("origin") || "";
  const ok = /^https:\/\/(www\.)?houselotandland\.org$/.test(origin) || /\.workers\.dev$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : "https://houselotandland.org",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
function json(obj, status, request) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors(request) } });
}

// GET /api/hours: open/closed for Shabbat, for the AI phone line (ElevenLabs tool "check_business_hours").
// say_en / say_es are read to the caller word for word when closed.
function hours() {
  const st = shabbatStatus();
  const spoken = (t, lang) => {
    const loc = lang === "es" ? "es-US" : "en-US";
    const day = t.toLocaleDateString(loc, { weekday: "long", month: "long", day: "numeric", timeZone: TZ });
    const time = t.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit", timeZone: TZ });
    return lang === "es" ? `el ${day} a las ${time}` : `${day} at ${time}`;
  };
  const body = { closed: st.closed, opens_at: st.opensAt.toISOString(), closes_at: st.closesAt.toISOString(),
    opens_text: spoken(st.opensAt, "en"), closes_text: spoken(st.closesAt, "en") };
  if (st.closed) {
    body.say_en = `Thank you for calling House Lot and Land Sales Company. We are closed for Shabbat, from sunset Friday to sunset Saturday, and we don't conduct any business during that time. We open again ${spoken(st.opensAt, "en")}, Central time. Please call back then. Please refer to the Terms of Use on our website, house lot and land dot org, for more information regarding this policy. Thank you, and goodbye.`;
    body.say_es = `Gracias por llamar a House Lot and Land Sales Company. Estamos cerrados por el Shabat, desde la puesta del sol del viernes hasta la puesta del sol del sábado, y no realizamos ningún negocio durante ese tiempo. Abrimos de nuevo ${spoken(st.opensAt, "es")}, hora central. Por favor llame de nuevo entonces. Para más información sobre esta política, consulte los Términos de uso en nuestro sitio web, house lot and land punto org. Gracias, y hasta luego.`;
  }
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
