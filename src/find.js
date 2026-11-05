// "Find my offer": houselotandland.org/find
// A seller looks up their private offer page by reference number, name or property address.
// - Reference number (printed on our letter/email): goes straight to the offer.
// - Name or address: must also match the last 4 digits of the phone or the email we have on file,
//   so a stranger can't pull up someone else's offer by typing a name.
// Every lookup answers the same way when nothing matches, and attempts are rate limited.

const REF_RE = /\bHL-?([A-HJ-NP-Z2-9]{5})\b/i;
const SUFFIX = { street: "st", drive: "dr", lane: "ln", road: "rd", avenue: "ave", boulevard: "blvd", court: "ct", circle: "cir", parkway: "pkwy", trail: "trl", highway: "hwy", place: "pl", terrace: "ter" };

export function normName(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
export function normAddr(s) {
  return normName(s).split(" ").map((w) => SUFFIX[w] || w).join(" ");
}

const T = {
  en: {
    title: "Find your offer",
    intro: "Enter the reference number from our letter or email (it starts with HL-), or your name or the property address.",
    q: "Reference number, name or property address",
    qPh: "e.g. HL-ABC23, Maria Lopez, or 123 Main St",
    v: "Last 4 digits of your phone, or your email",
    vHelp: "Only needed when you search by name or address.",
    go: "Find my offer",
    none: "We couldn't find offer options that match. Check the spelling, or try your reference number. You can also call us at 214-702-1519.",
    needV: "To protect your privacy, please also enter the last 4 digits of your phone number or your email address.",
    preparing: "We found your request. Your offer options are still being prepared; we'll email them to you within one business day.",
    expired: "Your offer options have expired. Please call us at 214-702-1519 for updated numbers.",
    many: "Too many tries. Please wait a little and try again, or call us at 214-702-1519.",
    error: "Something went wrong. Please try again or call us at 214-702-1519.",
    lang: "Español",
  },
  es: {
    title: "Encuentre su oferta",
    intro: "Escriba el número de referencia de nuestra carta o correo (empieza con HL-), o su nombre o la dirección de la propiedad.",
    q: "Número de referencia, nombre o dirección de la propiedad",
    qPh: "p. ej. HL-ABC23, María López o 123 Main St",
    v: "Últimos 4 dígitos de su teléfono, o su correo electrónico",
    vHelp: "Solo es necesario si busca por nombre o dirección.",
    go: "Buscar mi oferta",
    none: "No encontramos opciones de oferta que coincidan. Revise la ortografía o intente con su número de referencia. También puede llamarnos al 214-702-1519.",
    needV: "Para proteger su privacidad, escriba también los últimos 4 dígitos de su teléfono o su correo electrónico.",
    preparing: "Encontramos su solicitud. Sus opciones de oferta todavía se están preparando; se las enviaremos por correo en un día hábil.",
    expired: "Sus opciones de oferta vencieron. Llámenos al 214-702-1519 para recibir cifras actualizadas.",
    many: "Demasiados intentos. Espere un poco e intente de nuevo, o llámenos al 214-702-1519.",
    error: "Algo salió mal. Intente de nuevo o llámenos al 214-702-1519.",
    lang: "English",
  },
};

export function handleFindPage(request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "es" ? "es" : url.searchParams.get("lang") === "en" ? "en" : ((request.headers.get("accept-language") || "").toLowerCase().startsWith("es") ? "es" : "en");
  const t = T[lang];
  const other = lang === "es" ? "en" : "es";
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title} | House Lot &amp; Land Sales Co.</title><link rel="icon" href="/images/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--blue:#2563eb;--blue-d:#1d4ed8;--navy:#1e3a8a;--ink:#1f2937;--muted:#6b7280;--line:#e5e7eb;--bg:#f8fafc}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,sans-serif}
header{background:#1f2937;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
header img{height:56px;width:auto;display:block;background:#fff;padding:2px 6px}
header a.lang{color:#fff;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,.55);padding:8px 14px;border-radius:999px;font-size:14px}
main{max-width:620px;margin:0 auto;padding:28px 16px 48px}
h1{font:700 2rem/1.2 "Playfair Display",serif;margin:0 0 8px;color:var(--navy)}
form{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;display:grid;gap:14px;margin-top:16px}
label{display:grid;gap:6px;font-weight:600;font-size:15px}small{font-weight:400;color:var(--muted)}
input{font:16px Inter,sans-serif;padding:12px;border:1px solid #cbd5e1;border-radius:8px;width:100%}
.btn{border:0;border-radius:10px;background:var(--blue);color:#fff;font:600 16px Inter,sans-serif;padding:13px 18px;cursor:pointer;min-height:46px}
.btn:hover{background:var(--blue-d)}.btn:disabled{opacity:.6;cursor:wait}
.msg{min-height:1.5em;font-weight:600}.msg.err{color:#b91c1c}.msg.ok{color:#047857}
</style></head>
<body><header><a href="/"><img src="/images/Menu-Logo.png" alt="House Lot &amp; Land Sales Co. LLC"></a><a class="lang" href="?lang=${other}">${t.lang}</a></header>
<main><h1>${t.title}</h1><p>${t.intro}</p>
<form id="f" novalidate>
  <label>${t.q}<input name="q" required maxlength="160" placeholder="${esc(t.qPh)}" autocomplete="off"></label>
  <label>${t.v}<small>${t.vHelp}</small><input name="v" maxlength="160" autocomplete="off" inputmode="text"></label>
  <button class="btn" type="submit">${t.go}</button>
  <p class="msg" id="m" role="status" aria-live="polite"></p>
</form></main>
<script>
(function(){
  var f=document.getElementById("f"), m=document.getElementById("m"), lang=${JSON.stringify(lang)};
  f.addEventListener("submit", function(e){
    e.preventDefault(); var b=f.querySelector("button"); b.disabled=true; m.textContent=""; m.className="msg";
    fetch("/api/find",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({q:f.q.value,v:f.v.value,lang:lang})})
      .then(function(r){return r.json();})
      .then(function(j){ if(j.url){ location.href=j.url; return; } m.textContent=j.message||""; m.className="msg "+(j.kind==="ok"?"ok":"err"); b.disabled=false; })
      .catch(function(){ m.textContent=${JSON.stringify(t.error)}; m.className="msg err"; b.disabled=false; });
  });
})();
</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

export async function handleFindApi(request, env) {
  if (request.method !== "POST") return json({ message: "Method not allowed" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ message: T.en.error }, 400); }
  const t = T[body.lang === "es" ? "es" : "en"];
  const q = String(body.q || "").slice(0, 160).trim();
  const v = String(body.v || "").slice(0, 160).trim();
  if (!q) return json({ message: t.none });

  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? await sha256(ip + "|hll-find") : "anon";
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const tries = await env.DB.prepare("SELECT COUNT(*) AS n FROM find_attempts WHERE ip_hash = ? AND at > ? AND ok = 0").bind(ipHash, since).first();
  if (tries && tries.n >= 10) return json({ message: t.many }, 429);

  const now = new Date().toISOString();
  const fail = async (msg, kind = "err") => {
    await env.DB.prepare("INSERT INTO find_attempts (ip_hash, at, ok) VALUES (?, ?, 0)").bind(ipHash, now).run();
    return json({ message: msg, kind });
  };
  const win = async (row) => {
    await env.DB.prepare("INSERT INTO find_attempts (ip_hash, at, ok) VALUES (?, ?, 1)").bind(ipHash, now).run();
    if (row.expires_at && row.expires_at < now) return json({ message: t.expired });
    return json({ url: "/offer/" + row.token + (body.lang === "es" ? "?lang=es" : "") });
  };

  // 1) Reference number
  const rm = q.match(REF_RE);
  if (rm) {
    const ref = "HL-" + rm[1].toUpperCase();
    const row = await env.DB.prepare("SELECT token, expires_at FROM offers WHERE ref = ? AND status != 'withdrawn' ORDER BY updated_at DESC LIMIT 1").bind(ref).first();
    if (row) return win(row);
    const lead = await env.DB.prepare("SELECT 1 AS x FROM leads WHERE ref = ? LIMIT 1").bind(ref).first();
    if (lead) return fail(t.preparing, "ok");
    return fail(t.none);
  }

  // 2) Name or address: requires the phone's last 4 or the email on file.
  const digits = v.replace(/\D/g, "");
  const email = v.includes("@") ? v.toLowerCase() : "";
  const last4 = !email && digits.length >= 4 ? digits.slice(-4) : "";
  if (!email && !last4) return json({ message: t.needV, kind: "err" });

  const qName = normName(q), qAddr = normAddr(q);
  const num = (qAddr.match(/^\d+/) || [""])[0];
  const rows = (await env.DB.prepare(
    `SELECT token, expires_at, search_name, search_addr, phone_last4, email FROM offers
     WHERE status != 'withdrawn' AND ((? != '' AND phone_last4 = ?) OR (? != '' AND lower(email) = ?))
     ORDER BY updated_at DESC LIMIT 50`
  ).bind(last4, last4, email, email).all()).results || [];

  const nameTokens = qName.split(" ").filter((w) => w.length > 1);
  const match = rows.find((r) => {
    const sn = r.search_name || "", sa = r.search_addr || "";
    if (num && sa.startsWith(num + " ")) {
      const qWords = qAddr.split(" ").slice(1, 3).filter(Boolean);
      return qWords.every((w) => sa.includes(w));
    }
    return nameTokens.length > 0 && nameTokens.every((w) => sn.split(" ").includes(w));
  });
  if (match) return win(match);
  return fail(t.none);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
