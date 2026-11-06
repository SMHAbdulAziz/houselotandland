// Shabbat notice for every page.
//  - Closed (sunset Friday to sunset Saturday): a bar with a countdown to reopening. On the site's own
//    pages (mode "site") every form is replaced by a closed notice. On customer pages (mode "access":
//    order, offer, sign, find) nothing is hidden; the server refuses new-business actions instead.
//  - Friday before sunset: a reminder bar with the closing time.
//  - Always: a footer line with the hours and a link to the Terms of Use, and a terms note under forms.
// The server enforces the same hours (src/worker.js), so this script is a courtesy, not the lock.
import { shabbatStatus, fmtTime, localDate, weekday } from "./shabbat.js";

const mode = new URL(import.meta.url).searchParams.get("mode") || "site";
const lang = () => (typeof window.hllLang === "function" ? window.hllLang() : document.documentElement.lang) === "es" ? "es" : "en";
const T = {
  en: {
    closedTitle: "Closed for Shabbat",
    closedBody: "We observe Shabbat from sunset Friday to sunset Saturday. New inquiries, offers, applications, bookings, orders and payments open again",
    access: "Your orders, documents and offer pages stay available.",
    opensIn: "Opens in",
    formTitle: "This form is closed for Shabbat",
    formBody: "We don't accept new business from sunset Friday to sunset Saturday. This form opens again",
    soon: "We close for Shabbat today at",
    soonTail: "and reopen Saturday at",
    hours: "Closed for Shabbat every week from sunset Friday to sunset Saturday (Dallas time).",
    terms: "Terms of Use",
    agree: "By submitting, you agree to our",
    d: "d", h: "h", m: "m", s: "s",
  },
  es: {
    closedTitle: "Cerrado por el Shabat",
    closedBody: "Guardamos el Shabat desde la puesta del sol del viernes hasta la del sábado. Las consultas, ofertas, solicitudes, citas, pedidos y pagos nuevos abren de nuevo el",
    access: "Sus pedidos, documentos y páginas de oferta siguen disponibles.",
    opensIn: "Abrimos en",
    formTitle: "Este formulario está cerrado por el Shabat",
    formBody: "No aceptamos negocios nuevos desde la puesta del sol del viernes hasta la del sábado. Este formulario abre de nuevo el",
    soon: "Cerramos por el Shabat hoy a las",
    soonTail: "y abrimos de nuevo el sábado a las",
    hours: "Cerrado por el Shabat cada semana desde la puesta del sol del viernes hasta la del sábado (hora de Dallas).",
    terms: "Términos de uso",
    agree: "Al enviar, usted acepta nuestros",
    d: "d", h: "h", m: "m", s: "s",
  },
};

const css = `
.shb-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0b1730;color:#f8fafc;border-top:3px solid #f59e0b;
  padding:12px 16px calc(12px + env(safe-area-inset-bottom));font:15px/1.45 Inter,system-ui,sans-serif;box-shadow:0 -8px 24px rgba(2,6,23,.35)}
.shb-in{max-width:1100px;margin:0 auto;display:flex;gap:10px 18px;align-items:center;flex-wrap:wrap}
.shb-bar b{color:#fbbf24}.shb-txt{flex:1 1 320px;min-width:0}.shb-txt small{display:block;color:#cbd5e1;font-size:.85rem}
.shb-cd{font:700 1.25rem/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#fbbf24;white-space:nowrap}
.shb-cd span{display:block;font:500 .72rem Inter,system-ui,sans-serif;color:#cbd5e1;letter-spacing:.04em;text-transform:uppercase}
.shb-x{background:none;border:0;color:#cbd5e1;font-size:1.4rem;cursor:pointer;padding:0 4px;line-height:1}
.shb-soon{background:#1e293b;border-top-color:#64748b}
.shb-card{border:2px solid #f59e0b;background:#fffbeb;color:#78350f;border-radius:14px;padding:20px;margin:12px 0;text-align:center;font-family:Inter,system-ui,sans-serif}
.shb-card h3{margin:0 0 6px;color:#78350f;font-size:1.15rem}.shb-card p{margin:4px 0;color:#78350f}
.shb-card .shb-cd{color:#b45309;margin-top:8px;font-size:1.5rem}.shb-card .shb-cd span{color:#92400e}
.shb-foot{margin-top:6px;font-size:.85rem}.shb-foot a{color:inherit;text-decoration:underline}
.shb-agree{font-size:.82rem;color:#64748b;margin:8px 0 0}.shb-agree a{color:inherit;text-decoration:underline}
body.shb-pad{padding-bottom:110px}
@media print{.shb-bar{display:none}}`;

function countdown(ms, t) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return (d ? d + t.d + " " : "") + p(h) + t.h + " " + p(m) + t.m + " " + p(x) + t.s;
}

const hidden = [];
let bar = null, timer = null;

function clear() {
  if (bar) bar.remove(); bar = null;
  document.body.classList.remove("shb-pad");
  document.querySelectorAll(".shb-card").forEach((c) => c.remove());
  hidden.splice(0).forEach((f) => { f.hidden = false; });
  clearInterval(timer);
}

function render() {
  clear();
  const st = shabbatStatus(), t = T[lang()], L = lang();
  footer(t);
  if (st.closed) {
    bar = document.createElement("div");
    bar.className = "shb-bar"; bar.setAttribute("role", "status");
    bar.innerHTML = `<div class="shb-in"><div class="shb-txt"><b>${t.closedTitle}.</b> ${t.closedBody} <b>${fmtTime(st.opensAt, L)}</b>.<small>${t.access}</small></div>
      <div class="shb-cd" data-cd><span>${t.opensIn}</span><i></i></div></div>`;
    document.body.append(bar); document.body.classList.add("shb-pad");
    if (mode === "site") {
      document.querySelectorAll("form").forEach((f) => {
        if (f.closest(".shb-card")) return;
        const c = document.createElement("div");
        c.className = "shb-card";
        c.innerHTML = `<h3>${t.formTitle}</h3><p>${t.formBody} <b>${fmtTime(st.opensAt, L)}</b>.</p><div class="shb-cd" data-cd><span>${t.opensIn}</span><i></i></div>`;
        f.before(c); f.hidden = true; hidden.push(f);
      });
      document.querySelectorAll("#payNowWrap").forEach((el) => { el.hidden = true; });
    }
    const tick = () => {
      const left = st.opensAt - Date.now();
      document.querySelectorAll("[data-cd] i").forEach((i) => { i.textContent = countdown(left, t); i.style.fontStyle = "normal"; });
      if (left <= 0) { clearInterval(timer); setTimeout(() => location.reload(), 1500); }
    };
    tick(); timer = setInterval(tick, 1000);
    return;
  }
  // Friday before sunset: a reminder the visitor can dismiss.
  const today = localDate();
  let dismissed = false; try { dismissed = sessionStorage.getItem("shb_soon") === today; } catch {}
  if (weekday(today) === 5 && !dismissed) {
    bar = document.createElement("div");
    bar.className = "shb-bar shb-soon"; bar.setAttribute("role", "status");
    bar.innerHTML = `<div class="shb-in"><div class="shb-txt">${t.soon} <b>${fmtTime(st.closesAt, L).replace(/^.* (at|a las) /, "")}</b> ${t.soonTail} <b>${fmtTime(st.opensAt, L).replace(/^.* (at|a las) /, "")}</b>.</div>
      <button class="shb-x" type="button" aria-label="Close">&times;</button></div>`;
    bar.querySelector(".shb-x").onclick = () => { try { sessionStorage.setItem("shb_soon", today); } catch {} bar.remove(); document.body.classList.remove("shb-pad"); };
    document.body.append(bar); document.body.classList.add("shb-pad");
  }
  // Re-check every minute so the page closes itself at sunset.
  timer = setInterval(() => { if (shabbatStatus().closed) render(); }, 60000);
}

function footer(t) {
  document.querySelectorAll(".shb-foot, .shb-agree").forEach((e) => e.remove());
  const fb = document.querySelector(".footer-bottom");
  if (fb) { const p = document.createElement("p"); p.className = "shb-foot"; p.innerHTML = `${t.hours} <a href="/terms.html">${t.terms}</a>`; fb.append(p); }
  if (mode === "site") document.querySelectorAll("form").forEach((f) => {
    const btn = f.querySelector('[type="submit"], button.submit, button:not([type="button"])');
    if (!btn) return;
    const p = document.createElement("p"); p.className = "shb-agree"; p.innerHTML = `${t.agree} <a href="/terms.html" target="_blank" rel="noopener">${t.terms}</a>.`;
    btn.after(p);
  });
}

const style = document.createElement("style"); style.textContent = css; document.head.append(style);
render();
// Re-render in the other language when the visitor switches.
document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-lang-toggle]")) setTimeout(render, 50); });
