// E-sign: houselotandland.org/sign/<signer token> and /doc/<view token>
// - The Deal Desk creates an envelope (agreement + variables) and one signer row per person, then emails each link.
// - The document is rendered once, on first open, and locked: its HTML and SHA-256 hash are stored,
//   so every signer signs the same text. Every view, consent, signature and decline is audited.
// - Real envelopes are refused until settings.agreements_approved = 'true' (attorney sign-off).
//   Test envelopes (test = 1) always work and are stamped TEST.

import { render, esc } from "./agreements.js";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

const L = {
  en: {
    review: "Review and sign",
    hi: (n) => `Hi ${n},`,
    lead: (t) => `Please read the ${t} below. When you're ready, confirm and sign at the bottom. Take your time and ask us anything first.`,
    consentT: "Consent to sign electronically",
    consent: "I agree to use electronic records and signatures for this document under the Texas Uniform Electronic Transactions Act. I can ask for a paper copy at no charge and can withdraw this consent for future documents by emailing houselotandland@gmail.com. I have read the document above.",
    typeName: "Type your full legal name",
    draw: "Draw your signature (optional)",
    clear: "Clear",
    sign: "Sign",
    decline: "I don't want to sign",
    declineQ: "Tell us why (optional)",
    declineBtn: "Decline to sign",
    signed: "Thank you. Your signature is recorded.",
    declined: "You declined to sign. We'll be in touch; you can also call us at 214-702-1519.",
    already: "You already signed this document.",
    status: "Who has signed",
    view: "View or print the document",
    notReady: "This agreement isn't ready for signature yet. We'll email you when it is.",
    voided: "This document was cancelled. Please contact us at 214-702-1519.",
    notFound: "We couldn't find this signing link. Please check your email or call us at 214-702-1519.",
    needName: "Please type your full name exactly as it should appear.",
    needConsent: "Please check the consent box first.",
    err: "Something went wrong. Please try again or call us.",
    test: "TEST DOCUMENT: not a real agreement",
    pending: "Waiting", done: "Signed", no: "Declined",
    cert: "Signature certificate",
  },
  es: {
    review: "Revise y firme",
    hi: (n) => `Hola ${n},`,
    lead: (t) => `Lea el siguiente documento (${t}). Cuando esté listo, confirme y firme al final. Tómese su tiempo y pregúntenos lo que necesite antes.`,
    consentT: "Consentimiento para firmar electrónicamente",
    consent: "Acepto usar registros y firmas electrónicas para este documento conforme a la Ley Uniforme de Transacciones Electrónicas de Texas. Puedo pedir una copia en papel sin costo y retirar este consentimiento para documentos futuros escribiendo a houselotandland@gmail.com. Leí el documento.",
    typeName: "Escriba su nombre legal completo",
    draw: "Dibuje su firma (opcional)",
    clear: "Borrar",
    sign: "Firmar",
    decline: "No quiero firmar",
    declineQ: "Díganos por qué (opcional)",
    declineBtn: "No firmar",
    signed: "Gracias. Su firma quedó registrada.",
    declined: "Usted decidió no firmar. Nos comunicaremos con usted; también puede llamarnos al 214-702-1519.",
    already: "Usted ya firmó este documento.",
    status: "Quién ha firmado",
    view: "Ver o imprimir el documento",
    notReady: "Este acuerdo todavía no está listo para firmar. Le avisaremos por correo cuando lo esté.",
    voided: "Este documento fue cancelado. Llámenos al 214-702-1519.",
    notFound: "No encontramos este enlace de firma. Revise su correo o llámenos al 214-702-1519.",
    needName: "Escriba su nombre completo tal como debe aparecer.",
    needConsent: "Primero marque la casilla de consentimiento.",
    err: "Algo salió mal. Intente de nuevo o llámenos.",
    test: "DOCUMENTO DE PRUEBA: no es un acuerdo real",
    pending: "Pendiente", done: "Firmó", no: "No firmó",
    cert: "Certificado de firmas",
  },
};

async function approved(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'agreements_approved'").first();
  return r && r.value === "true";
}

async function lockDoc(env, e) {
  if (e.doc_html) return e;
  let vars = {};
  try { vars = JSON.parse(e.vars); } catch {}
  const { title, html } = render({ ...vars, kind: e.kind });
  const doc = `<div class="doc" data-title="${esc(title)}">${html}</div>`;
  const hash = await sha256(doc);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE envelopes SET doc_html = ?, doc_hash = ?, locked_at = ? WHERE id = ? AND doc_html IS NULL").bind(doc, hash, now, e.id).run();
  await audit(env, null, e.id, null, "document_locked", "sha256 " + hash);
  return env.DB.prepare("SELECT * FROM envelopes WHERE id = ?").bind(e.id).first();
}

function docTitle(e) { const m = (e.doc_html || "").match(/data-title="([^"]*)"/); return m ? m[1] : "agreement"; }

export async function handleSignPage(request, env, token) {
  const lang0 = new URL(request.url).searchParams.get("lang");
  if (!TOKEN_RE.test(token)) return page(shell("en", L.en.review, `<p>${L.en.notFound}</p>`), 404);
  const s = await env.DB.prepare("SELECT * FROM signers WHERE sign_token = ?").bind(token).first();
  if (!s) return page(shell("en", L.en.review, `<p>${L.en.notFound}</p>`), 404);
  let e = await env.DB.prepare("SELECT * FROM envelopes WHERE id = ?").bind(s.envelope_id).first();
  const lang = lang0 === "es" || lang0 === "en" ? lang0 : e.lang === "es" ? "es" : "en";
  const t = L[lang];
  if (e.status === "voided") return page(shell(lang, t.review, `<p>${t.voided}</p>`));
  if (!e.test && !(await approved(env))) return page(shell(lang, t.review, `<p>${t.notReady}</p>`));

  e = await lockDoc(env, e);
  if (!s.viewed_at) {
    await env.DB.prepare("UPDATE signers SET viewed_at = ? WHERE id = ? AND viewed_at IS NULL").bind(new Date().toISOString(), s.id).run();
    await audit(env, request, e.id, s.id, "viewed", "");
    await touch(env, e.id);
  }
  const signers = (await env.DB.prepare("SELECT name, role, status, signed_at FROM signers WHERE envelope_id = ? ORDER BY ord").bind(e.id).all()).results || [];
  const title = docTitle(e);

  let action;
  if (s.status === "signed") action = `<p class="ok">${t.already}</p>`;
  else if (s.status === "declined") action = `<p class="err">${t.declined}</p>`;
  else if (e.status !== "sent") action = `<p>${t.voided}</p>`;
  else action = signForm(t);

  const body = `
    ${e.test ? `<p class="test">${t.test}</p>` : ""}
    <p><strong>${esc(t.hi(s.name.split(" ")[0]))}</strong> ${esc(t.lead(title))}</p>
    ${e.doc_html}
    <section class="status-box"><h2>${t.status}</h2><ul>${signers.map((x) => `<li>${esc(x.name)} <span class="role">(${esc(x.role)})</span>: <strong class="${x.status}">${x.status === "signed" ? t.done : x.status === "declined" ? t.no : t.pending}</strong></li>`).join("")}</ul>
    <p><a href="/doc/${esc(e.view_token)}${lang === "es" ? "?lang=es" : ""}" target="_blank" rel="noopener">${t.view}</a></p></section>
    <section class="sign-box" id="sign">${action}</section>
    <script>${signScript(token, t)}</script>`;
  return page(shell(lang, t.review, body, token));
}

function signForm(t) {
  return `<h2>${t.consentT}</h2>
  <label class="chk"><input type="checkbox" id="consent"> <span>${t.consent}</span></label>
  <label class="fld">${t.typeName}<input id="sigName" autocomplete="name" maxlength="120"></label>
  <div class="fld">${t.draw}<canvas id="pad" width="600" height="160" aria-label="${t.draw}"></canvas><button type="button" class="link" id="clr">${t.clear}</button></div>
  <p class="msg" id="msg" role="status" aria-live="polite"></p>
  <button class="btn" id="signBtn" type="button">${t.sign}</button>
  <details class="decl"><summary>${t.decline}</summary><label class="fld">${t.declineQ}<textarea id="why" rows="2" maxlength="500"></textarea></label><button class="btn ghost" id="declBtn" type="button">${t.declineBtn}</button></details>`;
}

function signScript(token, t) {
  return `(function(){
  var pad=document.getElementById("pad"); if(!pad) return;
  var ctx=pad.getContext("2d"), drawing=false, drawn=false; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.strokeStyle="#111827";
  function pos(e){var r=pad.getBoundingClientRect(), p=e.touches?e.touches[0]:e; return {x:(p.clientX-r.left)*pad.width/r.width, y:(p.clientY-r.top)*pad.height/r.height};}
  function start(e){drawing=true; var p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); e.preventDefault();}
  function move(e){if(!drawing)return; var p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); drawn=true; e.preventDefault();}
  function end(){drawing=false;}
  pad.addEventListener("mousedown",start); pad.addEventListener("mousemove",move); window.addEventListener("mouseup",end);
  pad.addEventListener("touchstart",start,{passive:false}); pad.addEventListener("touchmove",move,{passive:false}); pad.addEventListener("touchend",end);
  document.getElementById("clr").onclick=function(){ctx.clearRect(0,0,pad.width,pad.height); drawn=false;};
  var msg=document.getElementById("msg");
  function post(body){ return fetch("/api/sign/${token}",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){ if(!r.ok||!j.ok) throw new Error(j.message||${JSON.stringify(t.err)}); return j;});}); }
  document.getElementById("signBtn").onclick=function(){
    var name=document.getElementById("sigName").value.trim();
    if(!document.getElementById("consent").checked){ msg.textContent=${JSON.stringify(t.needConsent)}; msg.className="msg err"; return; }
    if(name.split(/\\s+/).length<2){ msg.textContent=${JSON.stringify(t.needName)}; msg.className="msg err"; return; }
    this.disabled=true;
    post({action:"sign",consent:true,sig_name:name,sig_image:drawn?pad.toDataURL("image/png"):""}).then(function(){ location.reload(); })
      .catch(function(e){ msg.textContent=e.message; msg.className="msg err"; document.getElementById("signBtn").disabled=false; });
  };
  document.getElementById("declBtn").onclick=function(){
    this.disabled=true;
    post({action:"decline",reason:document.getElementById("why").value}).then(function(){ location.reload(); })
      .catch(function(e){ msg.textContent=e.message; msg.className="msg err"; });
  };
})();`;
}

export async function handleSignApi(request, env, token) {
  if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);
  if (!TOKEN_RE.test(token)) return json({ ok: false, message: "Not found" }, 404);
  const s = await env.DB.prepare("SELECT * FROM signers WHERE sign_token = ?").bind(token).first();
  if (!s) return json({ ok: false, message: "Not found" }, 404);
  const e = await env.DB.prepare("SELECT * FROM envelopes WHERE id = ?").bind(s.envelope_id).first();
  if (!e || e.status !== "sent") return json({ ok: false, message: "This document can no longer be signed." }, 409);
  if (!e.test && !(await approved(env))) return json({ ok: false, message: "Not ready for signature." }, 409);
  if (!e.doc_html || !s.viewed_at) return json({ ok: false, message: "Please reload the page." }, 409);
  if (s.status !== "pending") return json({ ok: true });

  let b; try { b = await request.json(); } catch { return json({ ok: false, message: "Bad request" }, 400); }
  const now = new Date().toISOString();
  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? await sha256(ip + "|hll-sign") : "";
  const ua = clean(request.headers.get("user-agent"), 300);

  if (b.action === "decline") {
    const reason = clean(b.reason, 500);
    await env.DB.prepare("UPDATE signers SET status = 'declined', declined_at = ?, decline_reason = ?, ip_hash = ?, user_agent = ? WHERE id = ?").bind(now, reason, ipHash, ua, s.id).run();
    await audit(env, request, e.id, s.id, "declined", reason);
    await env.DB.prepare("UPDATE envelopes SET status = 'declined', events_at = ? WHERE id = ?").bind(now, e.id).run();
    return json({ ok: true });
  }
  if (b.action !== "sign" || b.consent !== true) return json({ ok: false, message: "Consent is required." }, 400);
  const name = clean(b.sig_name, 120);
  if (name.split(/\s+/).length < 2) return json({ ok: false, message: "Please type your full name." }, 400);
  let img = String(b.sig_image || "");
  if (img && (!img.startsWith("data:image/png;base64,") || img.length > 120000)) img = "";

  await audit(env, request, e.id, s.id, "consented_electronic", "UETA consent checkbox");
  await env.DB.prepare("UPDATE signers SET status = 'signed', consent_at = ?, signed_at = ?, sig_name = ?, sig_image = ?, ip_hash = ?, user_agent = ? WHERE id = ? AND status = 'pending'")
    .bind(now, now, name, img, ipHash, ua, s.id).run();
  await audit(env, request, e.id, s.id, "signed", `typed name "${name}"${img ? ", drawn signature" : ""}; document sha256 ${e.doc_hash}`);

  const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM signers WHERE envelope_id = ? AND status != 'signed'").bind(e.id).first();
  if (left && left.n === 0) {
    await env.DB.prepare("UPDATE envelopes SET status = 'completed', completed_at = ?, events_at = ? WHERE id = ?").bind(now, now, e.id).run();
    await audit(env, null, e.id, null, "completed", "all parties signed");
  } else {
    await touch(env, e.id);
  }
  return json({ ok: true });
}

export async function handleDocPage(request, env, viewToken) {
  const lang = new URL(request.url).searchParams.get("lang") === "es" ? "es" : "en";
  const t = L[lang];
  if (!TOKEN_RE.test(viewToken)) return page(shell(lang, t.cert, `<p>${t.notFound}</p>`), 404);
  let e = await env.DB.prepare("SELECT * FROM envelopes WHERE view_token = ?").bind(viewToken).first();
  if (!e) return page(shell(lang, t.cert, `<p>${t.notFound}</p>`), 404);
  if (!e.test && !(await approved(env))) return page(shell(lang, t.cert, `<p>${t.notReady}</p>`));
  e = await lockDoc(env, e);
  const signers = (await env.DB.prepare("SELECT * FROM signers WHERE envelope_id = ? ORDER BY ord").bind(e.id).all()).results || [];
  const log = (await env.DB.prepare("SELECT a.at, a.event, a.detail, a.ip_hash, s.name FROM sign_audit a LEFT JOIN signers s ON s.id = a.signer_id WHERE a.envelope_id = ? ORDER BY a.id").bind(e.id).all()).results || [];
  const blocks = signers.map((s) => `<div class="sigblock"><div class="sigline">${s.status === "signed" ? (s.sig_image ? `<img src="${esc(s.sig_image)}" alt="Signature of ${esc(s.name)}">` : `<span class="script">${esc(s.sig_name)}</span>`) : "&nbsp;"}</div>
    <div>${esc(s.name)} · ${esc(s.role)}</div><div class="small">${s.status === "signed" ? `Signed electronically ${esc(s.signed_at)} as "${esc(s.sig_name)}"` : s.status === "declined" ? "Declined" : "Not signed yet"}</div></div>`).join("");
  const cert = `<section class="cert"><h2>${t.cert}</h2>
    <p class="small">Envelope ${esc(e.id)} · Reference ${esc(e.ref)} · Status: <strong>${esc(e.status)}</strong>${e.completed_at ? ` · Completed ${esc(e.completed_at)}` : ""}<br>Document locked ${esc(e.locked_at || "")} · SHA-256 <code>${esc(e.doc_hash || "")}</code></p>
    <table><thead><tr><th>Time (UTC)</th><th>Signer</th><th>Event</th><th>Detail</th><th>Device id</th></tr></thead><tbody>
    ${log.map((a) => `<tr><td>${esc(a.at)}</td><td>${esc(a.name || "")}</td><td>${esc(a.event)}</td><td>${esc(a.detail || "")}</td><td>${esc((a.ip_hash || "").slice(0, 12))}</td></tr>`).join("")}</tbody></table></section>`;
  const body = `${e.test ? `<p class="test">${t.test}</p>` : ""}<p class="noprint"><button class="btn ghost" onclick="window.print()">Print / Save as PDF</button></p>
    ${e.doc_html}<section class="agr"><h2>Signatures</h2><div class="sigs">${blocks}</div></section>${cert}`;
  return page(shell(lang, t.cert, body));
}

/* helpers */
async function audit(env, request, envelopeId, signerId, event, detail) {
  let ipHash = "", ua = "";
  if (request) { const ip = request.headers.get("cf-connecting-ip") || ""; ipHash = ip ? await sha256(ip + "|hll-sign") : ""; ua = clean(request.headers.get("user-agent"), 300); }
  return env.DB.prepare("INSERT INTO sign_audit (envelope_id, signer_id, at, event, detail, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(envelopeId, signerId, new Date().toISOString(), event, String(detail || "").slice(0, 1000), ipHash, ua).run();
}
function touch(env, id) { return env.DB.prepare("UPDATE envelopes SET events_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run(); }

function shell(lang, title, body) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)} | House Lot &amp; Land Sales Co.</title>
<link rel="icon" href="/images/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@700&family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>
:root{--blue:#2563eb;--blue-d:#1d4ed8;--navy:#1e3a8a;--ink:#1f2937;--muted:#6b7280;--line:#e5e7eb;--bg:#f8fafc}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,system-ui,sans-serif}
header{background:#1f2937;padding:12px 16px}header img{height:52px;background:#fff;padding:2px 6px;display:block}
main{max-width:860px;margin:0 auto;padding:24px 16px 56px}h1{font:700 1.8rem/1.25 "Playfair Display",serif;color:var(--navy);margin:16px 0 4px}
h2{font-size:1.15rem;margin:24px 0 8px}.meta{color:var(--muted);margin:0 0 8px}
.doc{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 22px 18px;margin:16px 0}
.agr p{margin:10px 0}.fill{font-weight:600}.blank{color:#b45309}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:15px}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:#f1f5f9}
.status-box,.sign-box,.cert{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 20px;margin:16px 0}
.status-box ul{padding-left:18px}.signed{color:#047857}.declined{color:#b91c1c}.pending{color:#b45309}.role{color:var(--muted)}
.chk{display:flex;gap:10px;align-items:flex-start;font-size:15px}.chk input{margin-top:5px;width:20px;height:20px}
.fld{display:grid;gap:6px;font-weight:600;margin:14px 0}.fld input,.fld textarea{font:16px Inter,sans-serif;padding:10px;border:1px solid #cbd5e1;border-radius:8px}
canvas{width:100%;max-width:600px;height:160px;border:1px dashed #94a3b8;border-radius:8px;background:#fff;touch-action:none}
.btn{border:0;border-radius:10px;background:var(--blue);color:#fff;font:600 16px Inter,sans-serif;padding:13px 22px;cursor:pointer;min-height:46px}.btn:hover{background:var(--blue-d)}.btn:disabled{opacity:.6}
.btn.ghost{background:#fff;color:var(--blue);border:2px solid var(--blue)}.link{background:none;border:0;color:var(--blue);cursor:pointer;justify-self:start;padding:0;font:inherit}
.msg{min-height:1.4em;font-weight:600}.err{color:#b91c1c}.ok{color:#047857;font-weight:600}
.decl{margin-top:18px}.decl summary{cursor:pointer;color:var(--muted)}
.test{background:#fef3c7;border:2px solid #f59e0b;color:#92400e;font-weight:700;text-align:center;padding:10px;border-radius:10px}
.sigs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.sigline{border-bottom:1px solid #111;min-height:64px;display:flex;align-items:flex-end}
.sigline img{max-height:60px;max-width:100%}.script{font:600 2rem Caveat,cursive}.small{font-size:13px;color:var(--muted)}code{font-size:12px;word-break:break-all}
@media print{header,.noprint,.sign-box,.status-box{display:none}body{background:#fff}.doc{border:0;padding:0}}
</style></head><body><header><a href="/"><img src="/images/Menu-Logo.png" alt="House Lot &amp; Land Sales Co. LLC"></a></header><main>${body}</main></body></html>`;
}
function page(html, status = 200) {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "x-frame-options": "DENY" } });
}
function json(o, status = 200) { return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function clean(v, max) { return v == null ? "" : String(v).replace(/[\u0000-\u001F]/g, " ").trim().slice(0, max); }
async function sha256(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(""); }
