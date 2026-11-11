// POST /api/loan — private money loan application from houselotandland.org/apply.html.
// Saves one row in D1 table loan_apps with the fix-and-flip analysis (same engine the page shows the applicant).
// The Deal Desk "Funding" panel reads and works these rows; the hourly task emails the applicant and Harvey.
//
// Never collect SSNs, dates of birth, ID numbers or bank account numbers here: documents are gathered
// later through a channel Harvey chooses. The form tells applicants this too.

import { analyzeFlip, EXCLUDED_STATES, LOAN_TYPES, EXIT_STRATEGIES } from "../js/loan-analyzer.js";

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

// Text fields kept from the form, with max lengths.
const TEXT = {
  loan_type: 30, exit_strategy: 30, loan_term: 30, property_street: 200, property_city: 80, property_state: 2, property_zip: 10,
  property_type: 40, occupancy: 40, year_built: 10, sqft: 20, lot_size: 40, beds: 10, baths: 10, units: 10, garage: 80,
  county_parcel: 120, rehab_scope: 2000, closing_date: 20, under_contract: 10, title_company: 200, arv_comps: 1000,
  borrower_name: 120, borrower_phone: 40, borrower_email: 160, borrower_address: 300, borrower_state: 2,
  entity_name: 160, entity_type: 40, flips_done: 10, rentals_owned: 10, experience: 1000, credit_range: 30,
  guarantor_name: 120, guarantor_phone: 40, guarantor_email: 160, guarantor_address: 300, guarantor_relationship: 80,
  heard_from: 120, notes: 3000,
};
const MONEY = ["arv", "purchase_price", "rehab", "earnest_money", "seller_concessions", "loan_requested", "cash_available", "monthly_rent", "payoff"];

export async function handleLoanApi(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  if (request.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405, request);

  let body;
  try {
    const type = request.headers.get("content-type") || "";
    body = type.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return json({ success: false, message: "Could not read the application. Please try again." }, 400, request);
  }
  if (clean(body.hll_hp)) return json({ success: true, ref: "PM-OK" }, 200, request); // honeypot

  const d = {};
  for (const [k, max] of Object.entries(TEXT)) d[k] = clean(body[k], max);
  for (const k of MONEY) { const n = money(body[k]); d[k] = n === null ? null : n; }
  d.property_state = d.property_state.toUpperCase();
  d.borrower_state = d.borrower_state.toUpperCase();
  if (!(d.loan_type in LOAN_TYPES)) d.loan_type = "fix_flip";
  if (!(d.exit_strategy in EXIT_STRATEGIES)) d.exit_strategy = "";

  const errs = [];
  if (!d.borrower_name) errs.push("your name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.borrower_email)) errs.push("a valid email");
  if (d.borrower_phone.replace(/\D/g, "").length < 10) errs.push("a 10-digit phone number");
  if (!d.property_street || !d.property_city || !STATES.includes(d.property_state)) errs.push("the property address and state");
  if (!d.purchase_price && !d.arv) errs.push("the purchase price or value");
  if (errs.length) return json({ success: false, message: "Please add " + errs.join(", ") + "." }, 400, request);

  if (EXCLUDED_STATES.includes(d.property_state))
    return json({ success: false, message: `We're not able to broker loans for property in ${d.property_state}. Please call 214-702-1519 if you have a deal in another state.` }, 400, request);
  if (!truthy(body.business_purpose))
    return json({ success: false, message: "We only arrange business-purpose loans on investment property. Please confirm the business-purpose statement." }, 400, request);
  if (d.occupancy === "owner")
    return json({ success: false, message: "We can't arrange loans on a home you or a family member will live in. Please call 214-702-1519 with any questions." }, 400, request);

  const consent = truthy(body.consent) ? 1 : 0;
  const consentText = consent ? clean(body.consent_text, 600) : "";

  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? await sha256(ip + "|hll") : "";
  if (ipHash) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM loan_apps WHERE ip_hash = ? AND created_at > ?").bind(ipHash, since).first();
    if (row && row.n >= 4) return json({ success: false, message: "We already have your application. Please call 214-702-1519." }, 429, request);
  }

  const analysis = d.loan_type === "fix_flip" || d.loan_type === "bridge"
    ? analyzeFlip({ arv: d.arv, purchase_price: d.purchase_price, rehab: d.rehab, exit_strategy: d.exit_strategy || "mls_listing" })
    : null;

  const now = new Date().toISOString();
  const id = "ln_" + crypto.randomUUID();
  const ref = makeRef();
  const address = [d.property_street, d.property_city, [d.property_state, d.property_zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  await env.DB.prepare(
    `INSERT INTO loan_apps (id, ref, created_at, updated_at, status, loan_type, property_address, property_state,
       borrower_name, borrower_email, borrower_phone, arv, purchase_price, rehab, loan_amount, net_profit, eligible,
       data, analysis, broker_fee_pct, consent, consent_text, ip_hash, user_agent, country)
     VALUES (?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, ref, now, now, d.loan_type, address, d.property_state,
    d.borrower_name, d.borrower_email.toLowerCase(), d.borrower_phone,
    d.arv, d.purchase_price, d.rehab,
    analysis ? analysis.loanAmount : null, analysis ? analysis.netProfit : null, analysis ? (analysis.eligible ? 1 : 0) : null,
    JSON.stringify(d), analysis ? JSON.stringify(analysis) : null, analysis ? analysis.brokerFeePct : null,
    consent, consentText, ipHash, clean(request.headers.get("user-agent"), 300), (request.cf && request.cf.country) || ""
  ).run();

  return json({ success: true, ref, analysis }, 200, request);
}

function clean(v, max = 500) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}
function money(v) {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n * 100) / 100 : null;
}
function truthy(v) {
  return v === true || ["on", "true", "1", "yes"].includes(String(v).toLowerCase());
}
function makeRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return "PM-" + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
function cors(request) {
  const origin = request.headers.get("origin") || "";
  const ok = /^https:\/\/(www\.)?houselotandland\.org$/.test(origin) || /\.workers\.dev$/.test(origin);
  return { "Access-Control-Allow-Origin": ok ? origin : "https://houselotandland.org", "Access-Control-Allow-Methods": "POST, OPTIONS",
           "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}
function json(obj, status, request) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors(request) } });
}
