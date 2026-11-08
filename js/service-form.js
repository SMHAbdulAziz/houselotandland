// Shared helpers for the service pages: money formatting, status check and order submission.
export const usd = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
export async function status() {
  try { const r = await fetch("/api/service/status"); return await r.json(); } catch { return { legal: false, payments: false }; }
}
// payload: { service, name, email, phone, ..., answers, addOns }. ui: { btn, msg, form, done }
export async function submit(payload, ui) {
  ui.msg.className = "msg"; ui.msg.textContent = "";
  const label = ui.btn.textContent; ui.btn.disabled = true; ui.btn.textContent = "Sending…";
  try {
    const r = await fetch("/api/service", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) throw new Error(j.message || "Something went wrong. Please try again or call 214-702-1519.");
    if (j.checkoutUrl) { location.href = j.checkoutUrl; return j; }
    ui.form.hidden = true;
    ui.done.querySelector("[data-ref]").textContent = j.ref;
    // The button starts as href="#", which the site's smooth-scroll script intercepts; a fresh copy drops that handler.
    const link = ui.done.querySelector("[data-order]");
    if (link) { const fresh = link.cloneNode(true); fresh.href = j.orderUrl; link.replaceWith(fresh); }
    const note = ui.done.querySelector("[data-note]"); if (note && j.payNote) note.textContent = j.payNote;
    ui.done.hidden = false; ui.done.scrollIntoView({ behavior: "smooth", block: "center" });
    return j;
  } catch (e) {
    ui.msg.className = "msg err"; ui.msg.textContent = e.message; ui.btn.disabled = false; ui.btn.textContent = label;
  }
}
export function moneyInputs(root) {
  root.querySelectorAll("[data-money]").forEach((el) => el.addEventListener("input", () => {
    const raw = el.value.replace(/[^\d.]/g, ""); if (!raw) { el.value = ""; return; }
    const [i, d] = raw.split("."); el.value = Number(i || 0).toLocaleString("en-US") + (d !== undefined ? "." + d.slice(0, 2) : "");
  }));
}
