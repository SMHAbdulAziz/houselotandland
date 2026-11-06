// Service orders: Homestead Trust, Curb Appeal, Contract Drafting, Vacant Property Watch.
//   POST /api/service              create an order / booking / quote request (price recomputed from js/services-catalog.js)
//   GET  /order/<token>            the customer's private order page (status, documents, document builder)
//   GET  /order/<token>/docs       printable documents for a homestead or single-document order
//   GET  /order/<token>/doc/<id>   printable document made with a subscription
//   POST /api/order/<token>/doc    make a document (subscriptions)
//   POST /api/stripe/webhook       Stripe events (checkout completed, subscription ended)
// Payments use Stripe Checkout through its REST API. Secrets (never in the repo):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET  -> `npx wrangler secret put ...` or the Cloudflare dashboard.
// Without STRIPE_SECRET_KEY, orders are saved as awaiting_payment and Harvey invoices them.
// Legal documents stay DRAFT (and real customers join a waitlist) until settings.legal_templates_approved = 'true'.

import { HOMESTEAD, CURB, CURB_ADDONS, CONTRACT_PLANS, DOCS, watchQuote, curbTotal, homesteadTotal, WATCH } from "../js/services-catalog.js";
import { homesteadDocs, contractDoc, printable, esc, DISCLAIMER } from "./legaldocs.js";

const SERVICES = ["homestead", "curb", "contracts", "watch"];
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function handleServiceApi(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  if (url.pathname === "/api/stripe/webhook") return stripeWebhook(request, env);
  let m = url.pathname.match(/^\/api\/order\/([^/]+)\/doc$/);
  if (m && request.method === "POST") return makeDoc(request, env, m[1]);
  if (url.pathname === "/api/service/status") return json({ legal: await approved(env), payments: !!env.STRIPE_SECRET_KEY }, 200, request);
  if (url.pathname === "/api/service" && request.method === "POST") return createOrder(request, env, url);
  return json({ success: false, message: "Not found" }, 404, request);
}

export async function handleOrderPage(request, env, url) {
  let m = url.pathname.match(/^\/order\/([^/]+)\/docs\/?$/);
  if (m) return docsPage(env, m[1]);
  m = url.pathname.match(/^\/order\/([^/]+)\/doc\/([^/]+)\/?$/);
  if (m) return subDocPage(env, m[1], m[2]);
  m = url.pathname.match(/^\/order\/([^/]+)\/?$/);
  if (m) return orderPage(env, m[1], url);
  return html(page("Not found", `<p>We couldn't find that page.</p>`), 404);
}

/* ---------------- create ---------------- */
async function createOrder(request, env, url) {
  let b;
  try { b = await request.json(); } catch { return json({ success: false, message: "Could not read the form. Please try again." }, 400, request); }
  if (clean(b.website)) return json({ success: true, ref: "SV-OK" }, 200, request);
  const service = String(b.service || "");
  if (!SERVICES.includes(service)) return json({ success: false, message: "Unknown service." }, 400, request);

  const name = clean(b.name, 120), email = clean(b.email, 160).toLowerCase(), phone = clean(b.phone, 40), company = clean(b.company, 160);
  if (!name) return json({ success: false, message: "Please add your name." }, 400, request);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ success: false, message: "Please add a valid email address." }, 400, request);
  if (service !== "contracts" && phone.replace(/\D/g, "").length < 10) return json({ success: false, message: "Please add a 10-digit phone number." }, 400, request);

  const ipHash = await sha256((request.headers.get("cf-connecting-ip") || "") + "|hll");
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM service_requests WHERE ip_hash = ? AND created_at > ?").bind(ipHash, new Date(Date.now() - 30 * 60e3).toISOString()).first();
  if (recent && recent.n >= 6) return json({ success: false, message: "We already have your request. Please call 214-702-1519." }, 429, request);

  const test = /^test\b/i.test(name);
  const legalOk = await approved(env);
  const answers = cleanObj(b.answers || {});
  let item = "", label = "", amount = null, mode = "payment", interval = null, status = "new", property = clean(b.property_address || answers.property_address, 300);
  const extra = {};

  if (service === "homestead") {
    for (const k of ["settlor_name", "trust_name", "successor_trustee", "property_address", "county", "beneficiaries"])
      if (!answers[k]) return json({ success: false, message: "Please complete every required question." }, 400, request);
    if (answers.marital === "married" && !answers.spouse_name) return json({ success: false, message: "Please add your spouse's name. In Texas both spouses sign to convey a homestead." }, 400, request);
    const addOns = (Array.isArray(b.addOns) ? b.addOns : []).filter((x) => HOMESTEAD.addOns[x]);
    item = "package"; label = "Texas Homestead Trust package"; amount = homesteadTotal(addOns); extra.addOns = addOns;
  } else if (service === "contracts") {
    const plan = String(b.plan || "single");
    if (!CONTRACT_PLANS[plan]) return json({ success: false, message: "Choose a plan." }, 400, request);
    if (plan === "single") {
      const d = DOCS[b.doc];
      if (!d) return json({ success: false, message: "Choose a document." }, 400, request);
      const miss = d.fields.filter((f) => f.required && !answers[f.name]);
      if (miss.length) return json({ success: false, message: "Please complete: " + miss.map((f) => f.label).join(", ") }, 400, request);
      item = b.doc; label = d.title; amount = d.price;
    } else {
      item = plan; label = `Contract Drafting ${CONTRACT_PLANS[plan].name} plan`; amount = CONTRACT_PLANS[plan].price; mode = "subscription"; interval = "month";
    }
    property = clean(answers.property_address, 300);
  } else if (service === "curb") {
    if (!CURB[b.package]) return json({ success: false, message: "Choose a package." }, 400, request);
    if (!property) return json({ success: false, message: "Please add the property address." }, 400, request);
    const earliest = earliestCurbDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(answers.date1 || "")) return json({ success: false, message: "Please choose your first choice date." }, 400, request);
    for (const d of [answers.date1, answers.date2].filter(Boolean))
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < earliest) return json({ success: false, message: `Please choose dates on or after ${fmtDay(earliest)}. We need at least two days to schedule a crew.` }, 400, request);
    const addOns = (Array.isArray(b.addOns) ? b.addOns : []).filter((x) => CURB_ADDONS[x]);
    item = b.package; label = `Curb Appeal ${CURB[b.package].name} package`; amount = curbTotal(b.package, addOns); extra.addOns = addOns;
    status = "requested";
  } else if (service === "watch") {
    const q = watchQuote({ properties: answers.properties, frequency: answers.frequency, core: answers.core !== "no", addOns: Array.isArray(b.addOns) ? b.addOns : [] });
    item = answers.frequency || "biweekly"; label = "Vacant Property Watch quote"; amount = null; extra.estimate = q; extra.addOns = (b.addOns || []).filter((x) => WATCH.addOns[x]);
    status = "quote_requested";
  }

  const legal = service === "homestead" || service === "contracts";
  if (test) status = "test";
  else if (legal && !legalOk) status = "waitlist";
  else if (amount != null && service !== "curb") status = "awaiting_payment";

  const id = "sv_" + crypto.randomUUID(), ref = makeRef(), token = makeToken(), now = new Date().toISOString();
  const consent = b.consent === true ? 1 : 0;
  await env.DB.prepare(`INSERT INTO service_requests (id, ref, token, created_at, updated_at, service, item, label, status, name, email, phone, company, property_address,
      answers, extra, amount, mode, consent, consent_text, ip_hash, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, ref, token, now, now, service, item, label, status, name, email, phone, company, property,
    JSON.stringify(answers), JSON.stringify(extra), amount, mode, consent, consent ? clean(b.consent_text, 600) : "", ipHash, clean(request.headers.get("user-agent"), 300)).run();

  const orderUrl = `${url.origin}/order/${token}`;
  let checkoutUrl = null, payNote = null;
  const payNow = status === "awaiting_payment" || (service === "curb" && status === "requested" && b.payNow === true);
  if (payNow) {
    if (env.STRIPE_SECRET_KEY) {
      try {
        const s = await stripe(env, "POST", "/v1/checkout/sessions", {
          mode, customer_email: email, client_reference_id: id,
          success_url: `${orderUrl}?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${orderUrl}?canceled=1`,
          "metadata[ref]": ref, "metadata[service]": service,
          "line_items[0][quantity]": 1, "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": Math.round(amount * 100),
          "line_items[0][price_data][product_data][name]": label,
          ...(interval ? { "line_items[0][price_data][recurring][interval]": interval, "subscription_data[metadata][ref]": ref } : {}),
        });
        checkoutUrl = s.url;
        await env.DB.prepare("UPDATE service_requests SET stripe_session = ?, updated_at = ? WHERE id = ?").bind(s.id, now, id).run();
      } catch (e) { payNote = "Online payment isn't available right now. We'll email you an invoice."; }
    } else payNote = "We'll email you a secure invoice to pay online.";
  }
  return json({ success: true, ref, orderUrl, checkoutUrl, status, payNote }, 200, request);
}

/* ---------------- order page ---------------- */
async function load(env, token) {
  if (!TOKEN_RE.test(token)) return null;
  const r = await env.DB.prepare("SELECT * FROM service_requests WHERE token = ?").bind(token).first();
  if (!r) return null;
  r.answers = parse(r.answers) || {}; r.extra = parse(r.extra) || {};
  return r;
}

async function refreshPayment(env, r, sessionId) {
  if (!env.STRIPE_SECRET_KEY || !sessionId || r.paid_at) return r;
  if (sessionId !== r.stripe_session) return r;
  try {
    const s = await stripe(env, "GET", `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (s.payment_status === "paid" || s.status === "complete") await markPaid(env, r.id, s);
    return await load(env, r.token);
  } catch { return r; }
}

async function markPaid(env, id, s) {
  const now = new Date().toISOString();
  const r = await env.DB.prepare("SELECT service, status FROM service_requests WHERE id = ?").bind(id).first();
  if (!r) return;
  const next = r.service === "contracts" && s.mode === "subscription" ? "active" : r.service === "curb" ? "paid" : "paid";
  await env.DB.prepare(`UPDATE service_requests SET status = CASE WHEN status IN ('test','cancelled') THEN status ELSE ? END, paid_at = COALESCE(paid_at, ?),
      stripe_customer = COALESCE(?, stripe_customer), stripe_subscription = COALESCE(?, stripe_subscription), amount_paid = ?, updated_at = ? WHERE id = ?`)
    .bind(next, now, s.customer || null, s.subscription || null, s.amount_total != null ? s.amount_total / 100 : null, now, id).run();
}

async function orderPage(env, token, url) {
  let r = await load(env, token);
  if (!r) return html(page("Order not found", `<p>We couldn't find this order. Check the link in your email or call 214-702-1519.</p>`), 404);
  r = await refreshPayment(env, r, url.searchParams.get("session_id"));
  const legalOk = await approved(env);
  const paid = ["paid", "active", "delivered", "completed", "scheduled"].includes(r.status) || r.status === "test";
  const money = (n) => (n == null ? "" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
  const canceled = url.searchParams.get("canceled");
  let body = `<p class="muted">Reference <b>${esc(r.ref)}</b> · ${esc(r.label)}${r.amount != null ? ` · ${money(r.amount)}${r.mode === "subscription" ? "/month" : ""}` : ""}</p>`;
  if (r.status === "test") body += `<div class="note warn">Test order: documents are stamped TEST and nothing is charged.</div>`;
  if (canceled && !paid) body += `<div class="note warn">Payment was cancelled. You can try again below or call 214-702-1519.</div>`;

  if (r.status === "waitlist") {
    body += `<h2>You're on the list</h2><p>Thanks, ${esc(first(r.name))}. This service opens soon. We saved your answers and will email you at ${esc(r.email)} as soon as it's available. Nothing has been charged.</p>`;
  } else if (r.status === "awaiting_payment") {
    body += `<h2>Almost done</h2><p>Your order is saved. ${env.STRIPE_SECRET_KEY && r.stripe_session ? `<a class="btn" href="${esc(await checkoutLink(env, r))}">Pay securely</a>` : "We'll email you a secure invoice to pay online."}</p><p class="muted">Bookmark this page: it's your private link to your order${r.service === "contracts" || r.service === "homestead" ? " and documents" : ""}.</p>`;
  } else if (r.service === "homestead") {
    body += `<h2>Your Homestead Trust documents</h2><p>Your package is ready${legalOk || r.status === "test" ? "" : " as a draft"}. Open it, read every page, then follow the signing and recording steps on the last page.</p><p><a class="btn" href="/order/${esc(token)}/docs">Open your documents</a></p>`;
  } else if (r.service === "contracts" && r.mode === "payment") {
    body += `<h2>Your document is ready</h2><p><a class="btn" href="/order/${esc(token)}/docs">Open ${esc(r.label)}</a></p>`;
  } else if (r.service === "contracts") {
    body += await builderSection(env, r, token);
  } else if (r.service === "curb") {
    const p = CURB[r.item], a = r.answers || {}, nm = esc(first(r.name));
    const reach = r.consent ? "call or text you" : "email you";
    const isPaid = !!r.paid_at || r.amount_paid != null;
    const paidLine = isPaid ? `Your payment of <b>${money(r.amount_paid ?? r.amount)}</b> was received${r.paid_at ? ` on ${esc(fmtDay(r.paid_at.slice(0, 10)))}` : ""}.` : "";
    const msg = ({
      requested: `Thanks, ${nm}. We received your booking request. We'll ${reach} within one business day to confirm your date and time. ${isPaid ? paidLine : "Once your date is confirmed, we'll send a secure link to pay."}`,
      paid: `Thanks, ${nm}. ${paidLine} We'll ${reach} within one business day to confirm your date and time.`,
      scheduled: `You're all set, ${nm}. Your crew is scheduled for <b>${esc(fmtWhen(r.appointment_at))}</b>. ${isPaid ? paidLine : ""}`,
      in_progress: `Your crew is on the job today. We'll send before-and-after photos when they finish.`,
      completed: `Your job is complete. If anything was missed, call 214-702-1519 and we'll come back and make it right.`,
      cancelled: `This booking was cancelled. Questions? Call 214-702-1519.`,
    })[r.status] || `Status: ${esc(curbStatus(r))}`;
    const dates = [a.date1, a.date2].filter(Boolean).map(fmtDay).join(" or ");
    const row = (k, v) => (v ? `<div><span>${k}</span><b>${v}</b></div>` : "");
    body += `<p><b>Status: ${esc(curbStatus(r))}</b></p><p>${msg}</p>
      <div class="kv">${row("Property", esc(r.property_address))}${r.appointment_at ? row("Scheduled", esc(fmtWhen(r.appointment_at))) : row("Requested dates", esc(dates))}
      ${row("Time window", esc(a.window))}${row("Access", esc(a.access))}${row("Total", money(r.amount))}${row("Paid", isPaid ? money(r.amount_paid ?? r.amount) : "Not yet")}</div>
      <h3>What's included</h3>
      <ul>${(p ? p.items : []).map((x) => `<li>${esc(x)}</li>`).join("")}${(r.extra.addOns || []).map((x) => `<li>${esc(CURB_ADDONS[x] ? CURB_ADDONS[x].label : x)}</li>`).join("")}</ul>
      <p class="muted">Bookmark this page: it's your private link to this booking. Questions? Call 214-702-1519.</p>`;
  } else if (r.service === "watch") {
    const q = r.extra.estimate || {};
    body += `<h2>Your quote request</h2><p>Thanks, ${esc(first(r.name))}. Harvey will review your portfolio and send a formal quote within one business day.</p>
      <div class="kv"><div><span>Properties</span><b>${esc(q.properties)}</b></div><div><span>Inspections per month</span><b>${esc(q.visitsPerMonth)}</b></div>
      <div><span>Estimated monthly (inspections)</span><b>${money(q.monthly)}</b></div><div><span>Estimated onboarding</span><b>${money(q.onboarding)}</b></div></div>
      <p class="muted">Estimate only, before add-on services billed as used.</p>`;
  } else {
    body += `<p>Status: ${esc(r.status)}</p>`;
  }
  if (r.service === "homestead" || r.service === "contracts") body += `<p class="disc">${esc(DISCLAIMER)}</p>`;
  return html(page(r.service === "curb" ? `Booking ${r.ref}` : r.service === "watch" ? `Quote request ${r.ref}` : `Order ${r.ref}`, body));
}

async function checkoutLink(env, r) {
  try { const s = await stripe(env, "GET", `/v1/checkout/sessions/${encodeURIComponent(r.stripe_session)}`); if (s.url && s.status === "open") return s.url; } catch {}
  return "tel:214-702-1519";
}

async function builderSection(env, r, token) {
  if (r.status !== "active" && r.status !== "test") return `<h2>Subscription ${esc(r.status)}</h2><p>This plan isn't active. Call 214-702-1519 or email houselotandland+website@gmail.com.</p>`;
  const plan = CONTRACT_PLANS[r.item] || {};
  const docs = (await env.DB.prepare("SELECT id, title, created_at FROM service_docs WHERE request_id = ? ORDER BY created_at DESC LIMIT 100").bind(r.id).all()).results || [];
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const used = docs.filter((d) => d.created_at >= monthStart.toISOString()).length;
  const left = plan.docs ? Math.max(0, plan.docs - used) : null;
  const opts = Object.entries(DOCS).map(([k, d]) => `<option value="${k}">${esc(d.title)}</option>`).join("");
  return `<h2>Your document builder</h2><p>${esc(plan.name)} plan · ${left == null ? "unlimited documents" : `${left} of ${plan.docs} documents left this month`}</p>
   ${docs.length ? `<h3>Your documents</h3><ul>${docs.map((d) => `<li><a href="/order/${esc(token)}/doc/${esc(d.id)}">${esc(d.title)}</a> <span class="muted">${esc(d.created_at.slice(0, 10))}</span></li>`).join("")}</ul>` : ""}
   ${left === 0 ? `<p class="note warn">You've used this month's documents. Upgrade to Investor for unlimited documents: call 214-702-1519.</p>` : `
   <h3>Make a new document</h3><label>Document<select id="docType">${opts}</select></label><p id="docBlurb" class="muted"></p><form id="docForm"></form>
   <button class="btn" id="docGo" type="button">Create document</button><p id="docMsg" class="muted"></p>
   <script type="module">
     import { DOCS } from "/js/services-catalog.js";
     const sel = document.getElementById("docType"), form = document.getElementById("docForm");
     const field = (f) => { const req = f.required ? " required" : ""; const lab = '<span>' + f.label + (f.required ? ' *' : '') + '</span>';
       if (f.type === "textarea") return '<label>' + lab + '<textarea name="' + f.name + '"' + req + '></textarea></label>';
       if (f.type === "select") return '<label>' + lab + '<select name="' + f.name + '">' + f.options.map(o => '<option>' + o + '</option>').join('') + '</select></label>';
       return '<label>' + lab + '<input name="' + f.name + '" type="' + (f.type === "money" || f.type === "number" ? "text" : f.type) + '"' + (f.type === "money" || f.type === "number" ? ' inputmode="decimal"' : '') + req + '></label>'; };
     const draw = () => { const d = DOCS[sel.value]; document.getElementById("docBlurb").textContent = d.blurb; form.innerHTML = d.fields.map(field).join(""); };
     sel.addEventListener("change", draw); draw();
     document.getElementById("docGo").addEventListener("click", async () => {
       const d = DOCS[sel.value], a = Object.fromEntries(new FormData(form)), miss = d.fields.filter(f => f.required && !String(a[f.name] || "").trim());
       const msg = document.getElementById("docMsg"); if (miss.length) { msg.textContent = "Please complete: " + miss.map(f => f.label).join(", "); return; }
       msg.textContent = "Creating…";
       const r = await fetch("/api/order/${esc(token)}/doc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc: sel.value, answers: a }) });
       const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) { msg.textContent = j.message || "Something went wrong."; return; }
       location.href = j.url;
     });
   </script>`}`;
}

async function makeDoc(request, env, token) {
  const r = await load(env, token);
  if (!r || r.service !== "contracts" || r.mode !== "subscription") return json({ success: false, message: "Not found" }, 404, request);
  if (r.status !== "active" && r.status !== "test") return json({ success: false, message: "Your plan isn't active." }, 403, request);
  let b; try { b = await request.json(); } catch { return json({ success: false, message: "Bad request" }, 400, request); }
  const d = DOCS[b.doc]; if (!d) return json({ success: false, message: "Choose a document." }, 400, request);
  const a = cleanObj(b.answers || {});
  const miss = d.fields.filter((f) => f.required && !a[f.name]);
  if (miss.length) return json({ success: false, message: "Please complete: " + miss.map((f) => f.label).join(", ") }, 400, request);
  const plan = CONTRACT_PLANS[r.item] || {};
  if (plan.docs) {
    const ms = new Date(); ms.setUTCDate(1); ms.setUTCHours(0, 0, 0, 0);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM service_docs WHERE request_id = ? AND created_at >= ?").bind(r.id, ms.toISOString()).first();
    if (n && n.n >= plan.docs) return json({ success: false, message: "You've used this month's documents." }, 403, request);
  }
  const id = "dc_" + crypto.randomUUID().slice(0, 18);
  await env.DB.prepare("INSERT INTO service_docs (id, request_id, doc_type, title, answers, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, r.id, b.doc, d.title, JSON.stringify(a), new Date().toISOString()).run();
  await env.DB.prepare("UPDATE service_requests SET updated_at = ? WHERE id = ?").bind(new Date().toISOString(), r.id).run();
  return json({ success: true, url: `/order/${token}/doc/${id}` }, 200, request);
}

async function docsPage(env, token) {
  const r = await load(env, token);
  if (!r) return html(page("Not found", `<p>We couldn't find these documents.</p>`), 404);
  const ok = ["paid", "delivered", "completed", "test"].includes(r.status);
  if (!ok) return Response.redirect(`https://houselotandland.org/order/${token}`, 302);
  const legalOk = await approved(env);
  const docs = r.service === "homestead" ? homesteadDocs(r.answers) : contractDoc(r.item, r.answers);
  if (!docs) return html(page("Not found", `<p>Document not found.</p>`), 404);
  if (r.status === "paid") await env.DB.prepare("UPDATE service_requests SET delivered_at = COALESCE(delivered_at, ?) WHERE id = ?").bind(new Date().toISOString(), r.id).run();
  return html(printable(docs, { draft: !legalOk, test: r.status === "test", title: `${r.label} · ${r.ref}`, backUrl: `/order/${token}` }));
}

async function subDocPage(env, token, docId) {
  const r = await load(env, token);
  if (!r) return html(page("Not found", `<p>Not found.</p>`), 404);
  const d = await env.DB.prepare("SELECT * FROM service_docs WHERE id = ? AND request_id = ?").bind(docId, r.id).first();
  if (!d) return html(page("Not found", `<p>Document not found.</p>`), 404);
  const legalOk = await approved(env);
  return html(printable(contractDoc(d.doc_type, parse(d.answers) || {}), { draft: !legalOk, test: r.status === "test", title: d.title, backUrl: `/order/${token}` }));
}

/* ---------------- Stripe ---------------- */
async function stripe(env, method, path, params) {
  const body = params ? new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])) : undefined;
  const res = await fetch("https://api.stripe.com" + path, { method, headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) }, body });
  const j = await res.json();
  if (!res.ok) throw new Error((j.error && j.error.message) || "Stripe error");
  return j;
}

async function stripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("not configured", { status: 503 });
  const payload = await request.text();
  const header = request.headers.get("stripe-signature") || "";
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")).filter((x) => x.length === 2).map(([k, v]) => [k, v]));
  const v1s = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!parts.t || !v1s.length || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return new Response("bad signature", { status: 400 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${payload}`))), (b) => b.toString(16).padStart(2, "0")).join("");
  if (!v1s.some((s) => timingSafeEq(s, mac))) return new Response("bad signature", { status: 400 });
  const evt = JSON.parse(payload);
  const o = evt.data && evt.data.object;
  if (evt.type === "checkout.session.completed" && o && o.client_reference_id) {
    if (o.payment_status === "paid" || o.mode === "subscription") await markPaid(env, o.client_reference_id, o);
  } else if (evt.type === "customer.subscription.deleted" && o) {
    await env.DB.prepare("UPDATE service_requests SET status = 'cancelled', updated_at = ? WHERE stripe_subscription = ?").bind(new Date().toISOString(), o.id).run();
  } else if (evt.type === "invoice.payment_failed" && o && o.subscription) {
    await env.DB.prepare("UPDATE service_requests SET status = 'past_due', updated_at = ? WHERE stripe_subscription = ?").bind(new Date().toISOString(), o.subscription).run();
  } else if (evt.type === "invoice.paid" && o && o.subscription) {
    await env.DB.prepare("UPDATE service_requests SET status = 'active', updated_at = ? WHERE stripe_subscription = ? AND status = 'past_due'").bind(new Date().toISOString(), o.subscription).run();
  }
  return new Response("ok");
}
function timingSafeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

/* ---------------- helpers ---------------- */
async function approved(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'legal_templates_approved'").first();
  return !!(r && r.value === "true");
}
function curbStatus(r) { return ({ requested: "Request received", paid: "Paid, confirming your date", scheduled: "Scheduled", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled", test: "Test" })[r.status] || r.status; }
function fmtWhen(s) { const d = new Date(s); return isNaN(d) ? s : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }); }
function fmtDay(s) { const d = new Date(String(s).slice(0, 10) + "T12:00:00Z"); return isNaN(d) ? String(s) : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }
// Curb bookings need two days' lead time, counted in North Texas (Central) time.
const CURB_LEAD_DAYS = 2;
function earliestCurbDate(now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + CURB_LEAD_DAYS);
  return d.toISOString().slice(0, 10);
}
const first = (n) => String(n || "").trim().split(/\s+/)[0] || "there";
function parse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function clean(v, max = 500) { return v == null ? "" : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max); }
function cleanObj(o) { const out = {}; for (const [k, v] of Object.entries(o).slice(0, 60)) if (/^[a-z][a-z0-9_]{0,39}$/.test(k)) out[k] = clean(v, 3000); return out; }
function makeRef() { const b = crypto.getRandomValues(new Uint8Array(5)); return "SV-" + Array.from(b, (x) => REF_ALPHABET[x % REF_ALPHABET.length]).join(""); }
function makeToken() { const b = crypto.getRandomValues(new Uint8Array(18)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function sha256(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(""); }
function cors(request) {
  const origin = request.headers.get("origin") || "";
  const ok = /^https:\/\/(www\.)?houselotandland\.org$/.test(origin) || /\.workers\.dev$/.test(origin);
  return { "Access-Control-Allow-Origin": ok ? origin : "https://houselotandland.org", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}
function json(obj, status, request) { return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors(request) } }); }
function html(s, status = 200) { return new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-store" } }); }
function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · House Lot &amp; Land</title><meta name="robots" content="noindex">
<style>:root{color-scheme:light}body{margin:0;background:#f1f5f9;font:16px/1.6 Inter,system-ui,sans-serif;color:#334155}
header{background:#0b1730;color:#fff;padding:14px 16px;font-weight:700}header a{color:#fff;text-decoration:none}
main{max-width:760px;margin:28px auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px -12px rgba(15,23,42,.2)}
@media(max-width:800px){main{margin:16px;padding:20px}}
h1{color:#0f172a;font:700 1.6rem Georgia,serif;margin:0 0 6px}h2{color:#0f172a;font-size:1.2rem;margin:20px 0 6px}h3{color:#0f172a;font-size:1rem;margin:18px 0 6px}
.muted{color:#64748b;font-size:.92rem}.btn{display:inline-block;background:#f59e0b;color:#1f2937;font-weight:700;padding:.75rem 1.3rem;border-radius:10px;text-decoration:none;border:0;cursor:pointer;font-size:1rem}
.note{padding:.7rem 1rem;border-radius:10px;background:#eff6ff;color:#1e3a8a;margin:12px 0}.note.warn{background:#fef3c7;color:#92400e}
.kv{display:grid;gap:6px;margin:12px 0}.kv div{display:flex;justify-content:space-between;border-bottom:1px dashed #e2e8f0;padding:6px 0}.kv b{color:#0f172a}
label{display:grid;gap:4px;margin:10px 0;font-weight:500;color:#1e293b;font-size:.93rem}input,select,textarea{font:inherit;padding:.6rem .7rem;border:1px solid #cbd5e1;border-radius:8px}textarea{min-height:80px}
.disc{margin-top:26px;font-size:.8rem;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px}</style></head>
<body><header><a href="/">House Lot &amp; Land Sales Co. LLC</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}
