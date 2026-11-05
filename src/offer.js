// Seller offer page: houselotandland.org/offer/<token>
// The Wholesale Deal Desk writes each approved offer into the D1 table "offers" (payload JSON).
// The seller opens a private link, sees the options and picks one (or asks for a call).
// Picks are recorded in "offers" + "offer_events"; the desk and Claude's hourly task read them back.

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

const T = {
  en: {
    title: "Your offer options",
    hello: (n) => (n ? `Hi ${n},` : "Hello,"),
    intro: (p, c) => `Here are the ways ${c} can buy ${p}. Pick the one that fits you best. Choosing an option doesn't commit you to anything: it tells us which paperwork to prepare for you to review.`,
    option: "Option",
    choose: "Choose this option",
    chosen: "Your choice",
    change: "You can change your choice any time before you sign.",
    thanks: (o) => `Thanks! We'll prepare the paperwork for ${o} and reach out within one business day.`,
    callTitle: "Rather talk it over?",
    callBtn: "Call us",
    aiBtn: "Talk to our assistant now",
    cbTitle: "Request a call back",
    cbPhone: "Best phone number",
    cbTime: "Best time to call",
    cbNote: "Anything we should know? (optional)",
    cbSend: "Request a call",
    cbThanks: "Got it. We'll call you at the time you picked.",
    expired: "These options have expired. Please call us for an updated offer.",
    withdrawn: "These options are no longer available. Please call us.",
    notFound: "We couldn't find these offer options. Please check the link in your email or call us.",
    error: "Something went wrong. Please try again or call us.",
    ref: "Reference",
    footer: "Prices are offers, not appraisals. Nothing is binding until both sides sign a written agreement.",
    lang: "Español",
  },
  es: {
    title: "Sus opciones de oferta",
    hello: (n) => (n ? `Hola ${n},` : "Hola,"),
    intro: (p, c) => `Estas son las formas en que ${c} puede comprar ${p}. Elija la que más le convenga. Elegir una opción no le compromete a nada: nos indica qué documentos preparar para que usted los revise.`,
    option: "Opción",
    choose: "Elegir esta opción",
    chosen: "Su elección",
    change: "Puede cambiar su elección en cualquier momento antes de firmar.",
    thanks: (o) => `¡Gracias! Prepararemos los documentos para ${o} y le contactaremos en un día hábil.`,
    callTitle: "¿Prefiere platicarlo?",
    callBtn: "Llámenos",
    aiBtn: "Hable con nuestro asistente ahora",
    cbTitle: "Pida que le llamemos",
    cbPhone: "Mejor número de teléfono",
    cbTime: "Mejor hora para llamarle",
    cbNote: "¿Algo que debamos saber? (opcional)",
    cbSend: "Pedir llamada",
    cbThanks: "Listo. Le llamaremos a la hora que eligió.",
    expired: "Estas opciones vencieron. Llámenos para una oferta actualizada.",
    withdrawn: "Estas opciones ya no están disponibles. Por favor llámenos.",
    notFound: "No encontramos estas opciones de oferta. Revise el enlace de su correo o llámenos.",
    error: "Algo salió mal. Intente de nuevo o llámenos.",
    ref: "Referencia",
    footer: "Los precios son ofertas, no avalúos. Nada es obligatorio hasta que ambas partes firmen un acuerdo por escrito.",
    lang: "English",
  },
};

export async function handleOfferPage(request, env, token, ctx) {
  const url = new URL(request.url);
  if (!TOKEN_RE.test(token)) return page(shell("en", null, msgBlock(T.en.notFound)), 404);
  const row = await env.DB.prepare("SELECT * FROM offers WHERE token = ?").bind(token).first();
  if (!row) return page(shell("en", null, msgBlock(T.en.notFound)), 404);

  let p;
  try { p = JSON.parse(row.payload); } catch { return page(shell("en", null, msgBlock(T.en.error)), 500); }
  const lang = url.searchParams.get("lang") === "es" ? "es" : url.searchParams.get("lang") === "en" ? "en" : (row.lang === "es" ? "es" : "en");
  const t = T[lang];

  if (row.status === "withdrawn") return page(shell(lang, p, msgBlock(t.withdrawn)));
  if (row.expires_at && row.expires_at < new Date().toISOString()) return page(shell(lang, p, msgBlock(t.expired)));

  if (!row.viewed_at) {
    const now = new Date().toISOString();
    const work = Promise.all([
      env.DB.prepare("UPDATE offers SET viewed_at = ?, events_at = ? WHERE token = ? AND viewed_at IS NULL").bind(now, now, token).run(),
      logEvent(env, request, token, "viewed", ""),
    ]);
    if (ctx && ctx.waitUntil) ctx.waitUntil(work); else await work;
  }

  return page(shell(lang, p, body(lang, p, row, token)));
}

export async function handleOfferApi(request, env, token, action) {
  if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);
  if (!TOKEN_RE.test(token)) return json({ ok: false, message: "Not found" }, 404);
  const row = await env.DB.prepare("SELECT token, payload, status, expires_at FROM offers WHERE token = ?").bind(token).first();
  if (!row) return json({ ok: false, message: "Not found" }, 404);
  if (row.status === "withdrawn" || (row.expires_at && row.expires_at < new Date().toISOString())) return json({ ok: false, message: "These options are no longer available." }, 410);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, message: "Bad request" }, 400); }

  // Flood control: 20 actions per offer per hour.
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM offer_events WHERE token = ? AND at > ? AND kind != 'viewed'").bind(token, since).first();
  if (n && n.n >= 20) return json({ ok: false, message: "Too many requests. Please call us." }, 429);

  const now = new Date().toISOString();
  if (action === "choose") {
    let keys = [];
    try { keys = (JSON.parse(row.payload).options || []).map((o) => o.key); } catch {}
    const key = String(body.key || "");
    if (!keys.includes(key)) return json({ ok: false, message: "Unknown option" }, 400);
    await env.DB.prepare("UPDATE offers SET chosen_key = ?, chosen_at = ?, status = 'chosen', events_at = ?, updated_at = ? WHERE token = ?").bind(key, now, now, now, token).run();
    await logEvent(env, request, token, "chosen", key);
    return json({ ok: true, key });
  }
  if (action === "callback") {
    const phone = clean(body.phone, 40), time = clean(body.time, 120), note = clean(body.note, 1000);
    if (phone.replace(/\D/g, "").length < 10) return json({ ok: false, message: "Please enter a 10-digit phone number." }, 400);
    await env.DB.prepare("UPDATE offers SET callback_at = ?, callback_phone = ?, callback_time = ?, callback_note = ?, events_at = ?, updated_at = ? WHERE token = ?").bind(now, phone, time, note, now, now, token).run();
    await logEvent(env, request, token, "callback", JSON.stringify({ phone, time, note }));
    return json({ ok: true });
  }
  return json({ ok: false, message: "Not found" }, 404);
}

async function logEvent(env, request, token, kind, detail) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? await sha256(ip + "|hll") : "";
  return env.DB.prepare("INSERT INTO offer_events (token, at, kind, detail, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(token, new Date().toISOString(), kind, String(detail || "").slice(0, 2000), ipHash, clean(request.headers.get("user-agent"), 300)).run();
}

/* ---------- rendering ---------- */

function body(lang, p, row, token) {
  const t = T[lang];
  const opts = Array.isArray(p.options) ? p.options : [];
  const chosen = row.chosen_key || "";
  const cards = opts.map((o, i) => {
    const isChosen = o.key === chosen;
    const L = (o.i18n && o.i18n[lang]) || o;
    o = { ...o, title: L.title || o.title, lines: L.lines || o.lines };
    const lines = (o.lines || []).map((l) => `<li>${esc(l)}</li>`).join("");
    return `<article class="opt${isChosen ? " is-chosen" : ""}" data-key="${esc(o.key)}">
      <div class="opt-head"><span class="opt-num">${t.option} ${i + 1}</span>${isChosen ? `<span class="badge">${t.chosen}</span>` : ""}</div>
      <h2>${esc(o.title || "")}</h2>
      <div class="price">${esc(o.priceText || "")}</div>
      <ul>${lines}</ul>
      <button class="btn choose" type="button" data-key="${esc(o.key)}" data-title="${esc(o.title || "")}">${isChosen ? "✓ " + t.chosen : t.choose}</button>
    </article>`;
  }).join("");

  const phone = esc(p.phone || "214-702-1519");
  const tel = String(p.phone || "214-702-1519").replace(/\D/g, "");
  const ai = p.aiLink && /^https:\/\//.test(p.aiLink) ? `<a class="btn ghost" href="${esc(p.aiLink)}" target="_blank" rel="noopener">${t.aiBtn}</a>` : "";

  return `
  <p class="hello">${esc(t.hello(p.firstName || ""))}</p>
  <p class="intro">${esc(t.intro(p.property || "", p.company || "House Lot & Land Sales Co. LLC"))}</p>
  <div class="status" id="status" role="status" aria-live="polite">${chosen ? esc(t.change) : ""}</div>
  <section class="opts">${cards}</section>
  ${pick(p.landNote, lang) ? `<p class="note">${esc(pick(p.landNote, lang))}</p>` : ""}
  <section class="talk">
    <h3>${t.callTitle}</h3>
    <div class="row"><a class="btn ghost" href="tel:+1${tel}">${t.callBtn}: ${phone}</a>${ai}</div>
    <form id="cb" class="cb">
      <h3>${t.cbTitle}</h3>
      <label>${t.cbPhone}<input name="phone" type="tel" autocomplete="tel" required></label>
      <label>${t.cbTime}<input name="time" type="text" maxlength="120"></label>
      <label>${t.cbNote}<textarea name="note" rows="2" maxlength="1000"></textarea></label>
      <button class="btn" type="submit">${t.cbSend}</button>
    </form>
  </section>
  ${pick(p.disclosure, lang) ? `<p class="fine">${esc(pick(p.disclosure, lang))}</p>` : ""}
  <p class="fine">${esc(t.footer)}</p>
  <p class="fine">${t.ref}: ${esc(p.ref || row.ref || "")}</p>
  <script>
  (function(){
    var token=${JSON.stringify(token)}, msgs=${JSON.stringify({ thanks: t.thanks("__"), err: t.error, cb: t.cbThanks, chosen: t.chosen, choose: t.choose })};
    var st=document.getElementById("status");
    function post(path, data){ return fetch("/api/offer/"+token+"/"+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(j){ if(!r.ok||!j.ok) throw new Error(j.message||msgs.err); return j; });}); }
    document.querySelectorAll(".choose").forEach(function(b){
      b.addEventListener("click", function(){
        var key=b.getAttribute("data-key"), title=b.getAttribute("data-title");
        document.querySelectorAll(".choose").forEach(function(x){x.disabled=true;});
        post("choose",{key:key}).then(function(){
          document.querySelectorAll(".opt").forEach(function(a){
            var on=a.getAttribute("data-key")===key; a.classList.toggle("is-chosen",on);
            var btn=a.querySelector(".choose"); btn.textContent= on ? "\\u2713 "+msgs.chosen : msgs.choose;
            var head=a.querySelector(".opt-head"), bd=head.querySelector(".badge");
            if(on && !bd){ bd=document.createElement("span"); bd.className="badge"; bd.textContent=msgs.chosen; head.appendChild(bd); }
            if(!on && bd) bd.remove();
          });
          st.textContent=msgs.thanks.replace("__", title); st.className="status ok";
        }).catch(function(e){ st.textContent=e.message||msgs.err; st.className="status err"; })
        .then(function(){ document.querySelectorAll(".choose").forEach(function(x){x.disabled=false;}); });
      });
    });
    var f=document.getElementById("cb");
    f.addEventListener("submit", function(e){
      e.preventDefault(); var fd=new FormData(f), btn=f.querySelector("button"); btn.disabled=true;
      post("callback",{phone:fd.get("phone"),time:fd.get("time"),note:fd.get("note")}).then(function(){
        f.innerHTML="<p class=\\"status ok\\">"+msgs.cb+"</p>";
      }).catch(function(err){ st.textContent=err.message||msgs.err; st.className="status err"; btn.disabled=false; st.scrollIntoView({behavior:"smooth"}); });
    });
  })();
  </script>`;
}

function pick(v, lang) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v[lang] || v.en || "";
}

function msgBlock(text) {
  return `<p class="intro">${esc(text)}</p><p class="row"><a class="btn ghost" href="tel:+12147021519">214-702-1519</a></p>`;
}

function shell(lang, p, inner) {
  const t = T[lang];
  const other = lang === "es" ? "en" : "es";
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>${t.title} | House Lot &amp; Land Sales Co.</title>
<link rel="icon" href="/images/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--blue:#2563eb;--blue-d:#1d4ed8;--navy:#1e3a8a;--ink:#1f2937;--muted:#6b7280;--line:#e5e7eb;--bg:#f8fafc;--gold:#f59e0b;--green:#10b981;--red:#b91c1c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,sans-serif}
header{background:#1f2937;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
header img{height:56px;width:auto;display:block;background:#fff;padding:2px 6px}header a.lang{color:#fff;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,.5);padding:6px 12px;border-radius:999px;font-size:14px}
main{max-width:980px;margin:0 auto;padding:24px 16px 48px}
h1{font:700 2rem/1.2 "Playfair Display",serif;margin:8px 0 4px;color:var(--navy)}
.hello{font-weight:600;margin:16px 0 4px}.intro{margin:0 0 16px;color:#374151}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:8px 0 16px}
.opt{background:#fff;border:2px solid var(--line);border-radius:14px;padding:18px;display:flex;flex-direction:column}
.opt.is-chosen{border-color:var(--green);box-shadow:0 0 0 4px rgba(16,185,129,.15)}
.opt-head{display:flex;justify-content:space-between;align-items:center}.opt-num{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.badge{background:var(--green);color:#fff;font-size:12px;font-weight:700;padding:2px 10px;border-radius:999px}
.opt h2{font:700 1.25rem/1.3 Inter,sans-serif;margin:8px 0 2px}.price{font:700 1.75rem/1.2 "Playfair Display",serif;color:var(--navy);margin-bottom:8px}
.opt ul{margin:0 0 16px;padding-left:18px;color:#374151;flex:1}.opt li{margin:4px 0}
.btn{display:inline-block;border:0;border-radius:10px;background:var(--blue);color:#fff;font:600 16px Inter,sans-serif;padding:12px 18px;cursor:pointer;text-align:center;text-decoration:none;min-height:44px}
.btn:hover{background:var(--blue-d)}.btn:disabled{opacity:.6;cursor:wait}.btn.ghost{background:#fff;color:var(--blue);border:2px solid var(--blue)}
.is-chosen .choose{background:var(--green)}
.status{min-height:1.5em;margin:4px 0 8px;font-weight:600}.status.ok{color:#047857}.status.err{color:var(--red)}
.note{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px}
.talk{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin:16px 0}
.talk h3{margin:0 0 10px;font-size:1.1rem}.row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px}
.cb{display:grid;gap:10px;border-top:1px solid var(--line);padding-top:14px;margin-top:6px}.cb label{display:grid;gap:4px;font-weight:600;font-size:14px}
.cb input,.cb textarea{font:16px Inter,sans-serif;padding:10px;border:1px solid #cbd5e1;border-radius:8px;width:100%}
.fine{font-size:13px;color:var(--muted);margin:8px 0}
@media (max-width:520px){h1{font-size:1.6rem}.price{font-size:1.5rem}}
</style></head>
<body><header><a href="/"><img src="/images/Menu-Logo.png" alt="House Lot &amp; Land Sales Co. LLC"></a>${p ? `<a class="lang" href="?lang=${other}">${t.lang}</a>` : ""}</header>
<main><h1>${t.title}</h1>${p && p.property ? `<p class="intro" style="margin:0">${esc(p.property)}</p>` : ""}${inner}</main></body></html>`;
}

function page(html, status = 200) {
  return new Response(html, { status, headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
  } });
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function clean(v, max) {
  return v == null ? "" : String(v).replace(/[\u0000-\u001F]/g, " ").trim().slice(0, max);
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
