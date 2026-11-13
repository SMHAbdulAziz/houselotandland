// Back office app (served only behind Cloudflare Access; data from /api/office/*).
import { TRACKS, CLOSED_STAGES, propertyKey, splitAddr, US_STATES, normState, zipState } from "/js/hub-keys.js";
// cur "" offers "From ZIP (else TX)", which the server fills from the ZIP code.
const stateSelect = (name, cur, attrs = "") => `<select name="${name}" ${attrs}>${cur ? "" : `<option value="" selected>From ZIP (else TX)</option>`}${Object.entries(US_STATES).map(([k, v]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${k} · ${esc(v)}</option>`).join("")}</select>`;
const cityLine = (p) => [p.city, [p.state, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
import { shabbatStatus, fmtTime } from "/js/shabbat.js";
import { CURB, CURB_LOT, CURB_ADDONS, CURB_QUOTE, curbQuoteSuggest } from "/js/services-catalog.js";
import { OWNER_TEMPLATES, renderOwnerEmail } from "/office/owner-email.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usd = (n) => (n == null || n === "" || !isFinite(n) ? "—" : "$" + Math.round(Number(n)).toLocaleString());
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const addDays = (n) => { const d = new Date(today() + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
// Plain dates (YYYY-MM-DD) stay as written; full timestamps show in local (Central) time.
const fmtDate = (s) => (s ? (/T\d\d:/.test(String(s)) ? new Date(s) : new Date(String(s).slice(0, 10) + "T12:00:00")).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
const fmtWhen = (s) => (s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const label = (p) => p.address || p.pname || p.name || "Untitled";
function toast(m) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2800); }

async function api(path, opts = {}) {
  const r = await fetch("/api/office/" + path, { ...opts, headers: { "content-type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok || j.ok === false) throw Object.assign(new Error(j.message || "Something went wrong."), { data: j, status: r.status });
  return j;
}
const send = (path, method, body) => api(path, { method, body });

// Dashboards and tools this back office links to.
const LINKS = [
  ["Deal pipelines", [
    ["Wholesale Deal Desk", "https://claude.ai/artifact/5MAcErFcTQZoe6VCGzbjHs", "Wholesale leads, offers, agreements, Funding and Services panels"],
    ["Sub-To Pipeline", "https://claude.ai/artifact/FtLdvSwuLyK8tRCEQKL2N8", "Subject-to leads with the deal analyzer"],
    ["Creative Finance Deal Tracker", "https://claude.ai/artifact/34uqcPNYFQnpZAwZvtxvTp", "Seller-finance RV parks and multifamily"],
    ["Sub-To Deal Kit", "https://claude.ai/artifact/F1KTc9QAdmU7kpybhoCxd8", "Scripts, checklists and paperwork for sub-to deals"],
    ["Seller Agreement Templates", "https://claude.ai/artifact/BVUBuBv8iR8y7bDdca5wY3", "Draft for attorney review"],
  ]],
  ["Website", [
    ["Home page", "/", "houselotandland.org"], ["Investor funding", "/funding.html", "Calculator and programs"], ["Loan application", "/apply.html", "Private money intake"],
    ["Curb Appeal", "/curb-appeal.html", "Packages and booking"], ["Property Watch", "/property-watch.html", "Vacant property quotes"],
    ["Homestead Trust", "/homestead-trust.html", "Waitlist until attorney approval"], ["Contract Drafting", "/contracts.html", "Waitlist until attorney approval"],
    ["Work with us", "/work-with-us.html", "Crew and contractor applications"], ["Terms of Use", "/terms.html", "Includes the Shabbat policy"], ["Business hours", "/api/hours", "Open/closed status the phone line uses"],
  ]],
  ["Accounts", [
    ["Stripe", "https://dashboard.stripe.com/", "Payments and payouts"], ["Cloudflare", "https://dash.cloudflare.com/", "Website, database and Access login"],
    ["ElevenLabs agents", "https://elevenlabs.io/app/agents", "AI phone line and call transcripts"], ["Gmail", "https://mail.google.com/", "houselotandland@gmail.com"],
  ]],
];
const TRADES = ["Mowing and edging", "Landscaping, beds and mulch", "Pressure washing", "Painting (interior or exterior)", "Debris haul-off", "Cleaning and make-ready",
  "Handyman (no licensed trades)", "Gutters", "Property checks and photos", "Moving and labor"];
const EQUIP = ["Truck", "Trailer", "Mower and trimmer", "Pressure washer", "Painting gear", "Ladder", "Own hand tools"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const W_STATUS = ["applied", "approved", "active", "inactive", "declined"];
const W_PILL = { applied: "warn", approved: "", active: "ok", inactive: "mute", declined: "bad" };
const TYPES = ["Single-family", "Duplex to fourplex", "Mobile home on land", "Apartment complex", "RV park", "Mobile home park", "Land", "Commercial", "Other"];

// ---------------- Shabbat ----------------
function shabbatBanner() {
  const st = shabbatStatus(), b = $("shabbat");
  b.hidden = !st.closed;
  if (st.closed) b.textContent = `Closed for Shabbat. You can look things up, but changes are paused until ${fmtTime(st.opensAt)}.`;
  document.body.classList.toggle("closed", st.closed);
  return st.closed;
}

// ---------------- router ----------------
const VIEWS = { overview, deals, add, import: importView, jobs, quotes, workers, affiliates, links };
let dealFilter = { track: "", stage: "", q: "", open: "1" };
async function route() {
  shabbatBanner();
  const [tab, arg] = (location.hash.slice(1) || "overview").split("/");
  document.querySelectorAll("#tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
  const fn = VIEWS[tab] || overview;
  $("view").innerHTML = `<p class="hint">Loading…</p>`;
  try { await fn(arg); } catch (e) { $("view").innerHTML = `<div class="card"><p>${esc(e.message)}</p></div>`; }
}
addEventListener("hashchange", route);
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); dealFilter = { track: "", stage: "", q: $("q").value.trim(), open: "" }; location.hash = "deals"; route(); });

// ---------------- overview ----------------
async function overview() {
  fillFileCounties(); // background: counties for properties on file that lack one
  const s = await api("summary");
  $("who").textContent = s.user;
  const byTrack = {};
  for (const r of s.deals) (byTrack[r.track] ||= []).push(r);
  const wk = Object.fromEntries(s.workers.map((r) => [r.status, r.n]));
  const open = s.deals.filter((r) => !CLOSED_STAGES.has(r.stage)).reduce((a, r) => a + r.n, 0);
  $("view").innerHTML = `
    <section class="kpis">
      <a class="kpi" href="#deals"><b>${open}</b><span>Open deals</span></a>
      <a class="kpi" href="#deals"><b>${s.due.length}</b><span>Follow-ups due</span></a>
      <a class="kpi" href="#deals"><b>${s.counts.properties}</b><span>Properties · ${s.counts.contacts} contacts</span></a>
      <a class="kpi" href="#quotes"><b>${s.quoteNeeded || 0}</b><span>Curb Appeal quotes to send</span></a>
      <a class="kpi" href="#workers"><b>${wk.applied || 0}</b><span>Worker applications to review</span></a>
      <a class="kpi" href="#affiliates"><b>${(s.aff && s.aff.open) || 0}</b><span>Open affiliate referrals${s.aff && s.aff.toPay ? ` · <b style="color:var(--bad);font-size:inherit">${s.aff.toPay} to pay</b>` : ""}</span></a>
      <a class="kpi" href="#workers"><b>${(wk.active || 0) + (wk.approved || 0)}</b><span>Approved and active workers</span></a>
    </section>
    ${salesSection(s.sales)}
    <section class="card"><div class="head"><h2>Pipelines</h2><span class="hint">One property can be on several tracks; it's still one record.</span></div>
      <div class="tracks">${Object.entries(TRACKS).map(([k, tr]) => {
        const rows = byTrack[k] || [], n = rows.reduce((a, r) => a + r.n, 0);
        return `<a class="track" href="#deals" data-track="${k}" style="text-decoration:none;color:inherit"><h3>${esc(tr.label)} <span class="pill">${n}</span></h3>
          ${tr.stages.map((st) => { const c = (rows.find((r) => r.stage === st) || {}).n || 0; return c ? `<div class="bar"><span>${esc(st)}</span><i>${c}</i></div>` : ""; }).join("") || `<span class="hint">No deals yet</span>`}</a>`;
      }).join("")}</div></section>
    <div class="two">
      <section class="card"><div class="head"><h2>Follow-ups due</h2><span class="hint">Today, ${fmtDate(today())}</span></div>
        <div class="list">${s.due.length ? s.due.slice(0, 25).map(dueRow).join("") : `<div class="empty">Nothing due. Nice.</div>`}</div></section>
      <section class="card"><div class="head"><h2>Recent activity</h2></div>
        <div class="log">${s.recent.length ? s.recent.map((a) => `<div><time>${esc(fmtWhen(a.at))}</time>${a.property_id ? `<button class="link btn small" data-prop="${esc(a.property_id)}" style="border:0;padding:0;color:var(--blue);background:none">${esc(a.address || a.pname || "Property")}</button> · ` : ""}${esc(a.summary)}</div>`).join("") : `<div class="empty">No activity yet.</div>`}</div></section>
    </div>`;
  $("view").querySelectorAll("[data-track]").forEach((a) => a.addEventListener("click", () => { dealFilter = { track: a.dataset.track, stage: "", q: "", open: "1" }; }));
}
function dueRow(d) {
  const late = d.next_touch < today();
  return `<div class="row"><button class="link" data-prop="${esc(d.property_id)}"><div class="t">${esc(label(d))}</div>
    <div class="s">${esc(TRACKS[d.track]?.label)} · ${esc(d.stage)}${d.cname ? " · " + esc(d.cname) : ""}${d.cphone ? " · " + esc(d.cphone) : ""}</div></button>
    <span class="pill ${late ? "bad" : "warn"}">${late ? "Due " + fmtDate(d.next_touch) : "Today"}</span></div>`;
}

// ---------------- deals ----------------
// Deals list: sort by column, quick filters, rows per page, select and bulk-update (same tools as the Import tab).
const dv = { sort: { key: "", dir: 1 }, page: 0, quick: "all", sel: new Set(), rows: [] };
let dealPageSize = (() => { try { const v = localStorage.getItem("hll_deals_page"); return v === null ? 25 : +v; } catch { return 25; } })();
const DEAL_SORT = { property: (d) => label(d).replace(/^\d+\s*/, "") + " " + String(parseInt(label(d)) || 0).padStart(7, "0"), place: (d) => [d.state, d.city].join(" "),
  stage: (d) => (TRACKS[d.track]?.label || "") + String((TRACKS[d.track]?.stages || []).indexOf(d.stage)).padStart(2, "0"), owner: (d) => d.cname || "",
  asking: (d) => d.asking == null ? "" : String(Math.round(d.asking)).padStart(12, "0"), touch: (d) => d.next_touch || "", added: (d) => d.created_at || "" };
const DEAL_QUICK = [["all", "All"], ["due", "Follow-up due"], ["notouch", "No next touch"], ["noowner", "No owner"], ["noprice", "No asking price"]];
function dealQuick(d, q) {
  if (q === "due") return d.next_touch && d.next_touch <= today() && !CLOSED_STAGES.has(d.stage);
  if (q === "notouch") return !d.next_touch;
  if (q === "noowner") return !d.cname && !d.cphone && !d.cemail;
  if (q === "noprice") return d.asking == null;
  return true;
}
async function deals() {
  const p = new URLSearchParams(Object.entries(dealFilter).filter(([, v]) => v));
  const { rows } = await api("deals?" + p);
  dv.rows = rows; const ids = new Set(rows.map((d) => d.id)); [...dv.sel].forEach((id) => { if (!ids.has(id)) dv.sel.delete(id); });
  drawDeals();
}
function drawDeals() {
  const rows = dv.rows, tr = TRACKS[dealFilter.track];
  let list = rows.filter((d) => dealQuick(d, dv.quick));
  const k = dv.sort.key;
  if (k) list = list.slice().sort((a, b) => { const x = String(DEAL_SORT[k](a) || ""), y = String(DEAL_SORT[k](b) || "");
    if (!x && y) return 1; if (x && !y) return -1; return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" }) * dv.sort.dir; });
  const size = dealPageSize || list.length || 1, pages = Math.max(1, Math.ceil(list.length / size));
  dv.page = Math.min(Math.max(0, dv.page), pages - 1);
  const start = dealPageSize ? dv.page * size : 0, shown = dealPageSize ? list.slice(start, start + size) : list;
  const sel = rows.filter((d) => dv.sel.has(d.id)), selTrack = [...new Set(sel.map((d) => d.track))];
  const stageTrack = TRACKS[dealFilter.track] ? dealFilter.track : selTrack.length === 1 ? selTrack[0] : "";
  const th = (key, l) => `<th><button class="link sort" data-dsort="${key}" title="Sort">${l}${dv.sort.key === key ? (dv.sort.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
  const allShown = shown.length && shown.every((d) => dv.sel.has(d.id));
  $("view").innerHTML = `<section class="card">
    <div class="head"><h2>Deals</h2><span class="hint">${rows.length} on file${list.length !== rows.length ? ` · ${list.length} match` : ""}${dealFilter.q ? ` for “${esc(dealFilter.q)}”` : ""} · ${dv.sel.size} selected</span></div>
    <div class="chips" style="margin-bottom:8px">${[["", "All tracks"], ...Object.entries(TRACKS).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button class="chip" data-t="${k}" aria-pressed="${dealFilter.track === k}">${esc(l)}</button>`).join("")}
      <button class="chip" data-open aria-pressed="${dealFilter.open === "1"}">Open only</button></div>
    ${tr ? `<div class="chips" style="margin-bottom:8px">${["", ...tr.stages].map((st) => `<button class="chip" data-st="${esc(st)}" aria-pressed="${dealFilter.stage === st}">${esc(st || "Any stage")}</button>`).join("")}</div>` : ""}
    <div class="chips" style="margin-bottom:10px">${DEAL_QUICK.map(([k, l]) => `<button class="chip" data-dq="${k}" aria-pressed="${dv.quick === k}">${esc(l)} <span class="hint">${rows.filter((d) => dealQuick(d, k)).length}</span></button>`).join("")}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">
      <button class="btn small" type="button" id="dAll">Select all ${list.length}</button>
      <button class="btn small" type="button" id="dNone" ${dv.sel.size ? "" : "disabled"}>Select none</button>
      <span class="hint">With ${dv.sel.size} selected:</span>
      <select id="dStage" ${dv.sel.size && stageTrack ? "" : "disabled"} title="${stageTrack ? "" : "Pick one track above (or select deals from one track) to change stages"}" style="width:auto">
        <option value="">Set stage…</option>${stageTrack ? TRACKS[stageTrack].stages.map((s) => `<option>${esc(s)}</option>`).join("") : ""}</select>
      <input type="date" id="dTouch" ${dv.sel.size ? "" : "disabled"} title="Set next touch" style="width:auto">
      <button class="btn small gold" type="button" id="dApply" disabled>Apply</button>
      <button class="btn small danger" type="button" id="dDel" ${dv.sel.size ? "" : "disabled"}>Delete selected</button>
      <span class="hint" id="dProg"></span>
      <span style="flex:1"></span>
      <label class="hint" style="display:flex;gap:6px;align-items:center;white-space:nowrap">Rows per page <select id="dSize" style="width:auto">${[25, 50, 100, 0].map((n) => `<option value="${n}" ${dealPageSize === n ? "selected" : ""}>${n || "All"}</option>`).join("")}</select></label>
      ${pages > 1 ? `<button class="btn small" type="button" id="dPrev" ${dv.page ? "" : "disabled"}>‹ Prev</button><span class="hint">Page ${dv.page + 1} of ${pages}</span><button class="btn small" type="button" id="dNext" ${dv.page < pages - 1 ? "" : "disabled"}>Next ›</button>` : ""}
    </div>
    <div class="tablewrap"><table><thead><tr><th><input type="checkbox" id="dPageAll" ${allShown ? "checked" : ""} aria-label="Select this page"></th>${th("property", "Property")}${th("place", "City · state")}${th("stage", "Track · stage")}${th("owner", "Owner")}<th>Also on</th>${th("asking", "Asking / value")}${th("touch", "Next touch")}${th("added", "Added")}</tr></thead>
    <tbody>${shown.map((d) => `<tr class="click" data-prop="${esc(d.property_id)}"><td class="nosel"><input type="checkbox" data-dsel="${esc(d.id)}" ${dv.sel.has(d.id) ? "checked" : ""} aria-label="Select"></td>
      <td><b>${esc(label(d))}</b><div class="hint">${esc([d.prop_type, d.county && d.county + " Co."].filter(Boolean).join(" · "))}</div></td>
      <td>${esc([d.city, d.state].filter(Boolean).join(", ") || "—")}</td>
      <td><span class="pill">${esc(TRACKS[d.track]?.label)}</span> ${esc(d.stage)}${d.ref ? `<div class="hint">${esc(d.ref)}</div>` : ""}</td>
      <td>${esc(d.cname || "—")}${d.cphone ? `<div class="hint">${esc(d.cphone)}</div>` : ""}${d.opt_out ? ` <span class="pill bad">Do not contact</span>` : d.litigator ? ` <span class="pill bad">Mail only</span>` : ""}</td>
      <td>${(d.tracks || "").split(",").filter((t) => t && t !== d.track).map((t) => `<span class="pill mute">${esc(TRACKS[t]?.label || t)}</span>`).join(" ") || "—"}</td>
      <td>${d.asking ? usd(d.asking) : "—"}${d.value ? `<div class="hint">value ${usd(d.value)}</div>` : ""}</td>
      <td>${d.next_touch ? `<span class="pill ${!CLOSED_STAGES.has(d.stage) && d.next_touch < today() ? "bad" : "mute"}">${fmtDate(d.next_touch)}</span>` : "—"}</td>
      <td class="hint">${d.created_at ? fmtDate(d.created_at.slice(0, 10)) : ""}</td></tr>`).join("")}</tbody></table></div>
    ${list.length ? `<p class="hint" style="margin-top:8px">Showing ${start + 1}–${start + shown.length} of ${list.length}</p>` : `<div class="empty">No deals match. Try “All tracks”, turn off “Open only”, or add a property.</div>`}</section>`;
  const v = $("view");
  v.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => { dealFilter.track = b.dataset.t; dealFilter.stage = ""; dv.page = 0; deals(); });
  v.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => { dealFilter.stage = b.dataset.st; dv.page = 0; deals(); });
  v.querySelector("[data-open]").onclick = () => { dealFilter.open = dealFilter.open ? "" : "1"; dv.page = 0; deals(); };
  v.querySelectorAll("[data-dq]").forEach((b) => b.onclick = () => { dv.quick = b.dataset.dq; dv.page = 0; drawDeals(); });
  v.querySelectorAll("[data-dsort]").forEach((b) => b.onclick = () => { const k = b.dataset.dsort; dv.sort = dv.sort.key === k ? (dv.sort.dir > 0 ? { key: k, dir: -1 } : { key: "", dir: 1 }) : { key: k, dir: 1 }; drawDeals(); });
  v.querySelectorAll("[data-dsel]").forEach((c) => c.onchange = () => { c.checked ? dv.sel.add(c.dataset.dsel) : dv.sel.delete(c.dataset.dsel); drawDeals(); });
  $("dPageAll").onchange = (e) => { shown.forEach((d) => e.target.checked ? dv.sel.add(d.id) : dv.sel.delete(d.id)); drawDeals(); };
  $("dAll").onclick = () => { list.forEach((d) => dv.sel.add(d.id)); drawDeals(); };
  $("dNone").onclick = () => { dv.sel.clear(); drawDeals(); };
  $("dSize").onchange = (e) => { dealPageSize = +e.target.value; dv.page = 0; try { localStorage.setItem("hll_deals_page", String(dealPageSize)); } catch {} drawDeals(); };
  if ($("dPrev")) { $("dPrev").onclick = () => { dv.page--; drawDeals(); }; $("dNext").onclick = () => { dv.page++; drawDeals(); }; }
  if (dv.sel.size) armClick($("dDel"), `Click again to delete ${dv.sel.size}`, async () => {
    const r = await send("deals/delete", "POST", { ids: [...dv.sel] });
    toast(`${r.deals} deal${r.deals === 1 ? "" : "s"} removed${r.properties ? `, ${r.properties} propert${r.properties === 1 ? "y" : "ies"} with no other tracks deleted` : ""}.`);
    dv.sel.clear(); deals();
  });
  const ready = () => { $("dApply").disabled = !dv.sel.size || (!$("dStage").value && !$("dTouch").value); };
  $("dStage").onchange = ready; $("dTouch").oninput = ready;
  $("dApply").onclick = async () => {
    const stage = $("dStage").value, touch = $("dTouch").value;
    const todo = rows.filter((d) => dv.sel.has(d.id)); let n = 0, skipped = 0;
    $("dApply").disabled = true;
    for (const d of todo) {
      const body = {};
      if (stage && TRACKS[d.track].stages.includes(stage)) body.stage = stage; else if (stage) skipped++;
      if (touch) body.next_touch = touch;
      if (!Object.keys(body).length) continue;
      $("dProg").textContent = `Updating ${++n} of ${todo.length}…`;
      try { await send("deal/" + d.id, "PATCH", body); } catch (er) { toast(er.message); break; }
    }
    toast(`${n} deal${n === 1 ? "" : "s"} updated${skipped ? ` (${skipped} on another track kept their stage)` : ""}`);
    dv.sel.clear(); deals();
  };
}

// ---------------- property drawer ----------------
document.addEventListener("click", (e) => {
  const p = e.target.closest("[data-prop]"); if (p && !e.target.closest(".nosel")) { e.preventDefault(); openProperty(p.dataset.prop); }
  const w = e.target.closest("[data-worker]"); if (w) { e.preventDefault(); openWorker(w.dataset.worker); }
});
$("dClose").onclick = () => ($("drawer").hidden = true);
$("drawer").addEventListener("click", (e) => { if (e.target.id === "drawer") $("drawer").hidden = true; });
addEventListener("keydown", (e) => { if (e.key === "Escape") $("drawer").hidden = true; });

async function openProperty(id) {
  const { property: p, deals: ds, contacts, activities } = await api("property/" + id);
  const missing = Object.keys(TRACKS).filter((k) => !ds.some((d) => d.track === k));
  $("dBody").innerHTML = `
    <div><h2 id="dTitle">${esc(label(p))}</h2><p class="hint" style="margin:4px 0 0">${esc([p.name && p.address ? p.name : "", cityLine(p), p.county && p.county + " County", p.prop_type].filter(Boolean).join(" · "))}</p></div>
    <section class="card"><div class="head"><h3>Tracks</h3><span class="hint">One deal per track</span></div>
      <div style="display:grid;gap:10px">${ds.map(dealCard).join("") || `<p class="hint">Not on any track yet.</p>`}</div>
      ${missing.length ? `<div class="acts" style="margin-top:10px"><span class="hint">Add to:</span>${missing.map((k) => `<button class="btn small" data-addtrack="${k}">${esc(TRACKS[k].label)}</button>`).join("")}</div>` : ""}</section>
    <section class="card"><div class="head"><h3>Owners and contacts</h3></div>
      <div class="list">${contacts.map((c) => `<div class="row"><div><div class="t">${esc(c.name || "Unnamed")} <span class="pill mute">${esc(c.role)}</span></div>
        <div class="s">${esc([c.phone, c.email, c.lang === "es" ? "Spanish" : ""].filter(Boolean).join(" · ") || "No phone or email")}${c.mailing ? "<br>Mail: " + esc(c.mailing) : ""}</div></div>
        <div class="acts">${c.opt_out ? `<span class="pill bad">Do not contact</span>` : c.consent ? `<span class="pill ok">Consent on file</span>` : `<span class="pill mute">No consent</span>`}${c.litigator ? ` <span class="pill bad">TCPA litigator: mail only</span>` : ""}
          <button class="btn small" data-dnc="${esc(c.id)}" data-v="${c.opt_out ? 0 : 1}">${c.opt_out ? "Allow contact" : "Do not contact"}</button></div>
        ${c.opt_out ? "" : c.consent ? `<div class="s" style="margin-top:4px">${(() => { let j = {}; try { j = JSON.parse(c.consent_json || "{}") || {}; } catch {} return esc(["Consent: " + (j.source || "on file"), j.at && fmtDate(String(j.at).slice(0, 10)), j.note].filter(Boolean).join(" · ")); })()}
            <button class="link" type="button" data-unconsent="${esc(c.id)}">Remove consent</button></div>`
          : `<details style="margin-top:6px"><summary class="hint" style="cursor:pointer">Record text consent</summary>
            <form class="acts" data-consent="${esc(c.id)}" style="margin-top:6px"><select name="how" required style="width:auto"><option value="">How did they agree?</option><option>Asked us to text them on a call</option><option>Texted us first and asked for info</option><option>Agreed in writing or by email</option><option>Agreed in person</option></select>
              <input name="note" placeholder="Note (date, what they said)" style="width:auto;flex:1"><button class="btn small">Save</button></form></details>`}</div>`).join("") || `<p class="hint">No contact yet.</p>`}</div>
      <details style="margin-top:10px"><summary class="hint" style="cursor:pointer">Add a contact</summary>
        <form id="addContact" class="grid" style="margin-top:10px"><label>Name<input name="name"></label><label>Phone<input name="phone" inputmode="tel"></label><label>Email<input name="email" type="email"></label>
        <label>Role<select name="role"><option>owner</option><option>co-owner</option><option>heir</option><option>executor</option><option>spouse</option><option>broker</option><option>agent</option><option>tenant</option><option>other</option></select></label>
        <div class="wide"><button class="btn gold">Add contact</button></div></form></details></section>
    ${ownerEmailSection(p, ds, contacts)}
    <section class="card"><div class="head"><h3>Property details</h3></div>
      <form id="propForm" class="grid">
        ${[["name", "Name (parks, complexes)"], ["address", "Street address"], ["city", "City"]].map(([k, l]) => `<label>${l}<input name="${k}" value="${esc(p[k] ?? "")}"></label>`).join("")}
        <label>State${stateSelect("state", p.state || "TX")}</label>
        ${[["zip", "ZIP"], ["county", "County"]].map(([k, l]) => `<label>${l}<input name="${k}" value="${esc(p[k] ?? "")}"></label>`).join("")}
        <label>Type<select name="prop_type">${["", ...TYPES].map((t) => `<option ${p.prop_type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        ${[["units", "Units / sites"], ["beds", "Beds"], ["baths", "Baths"], ["sqft", "Sq ft"], ["acres", "Acres"]].map(([k, l]) => `<label>${l}<input name="${k}" inputmode="decimal" value="${esc(p[k] ?? "")}"></label>`).join("")}
        <div class="wide"><button class="btn">Save details</button></div></form></section>
    <section class="card"><div class="head"><h3>History</h3></div>
      <form id="logForm" class="grid"><label>Type<select name="kind"><option value="call">Call</option><option value="text">Text</option><option value="email">Email</option><option value="mail">Mail</option><option value="visit">Visit</option><option value="note" selected>Note</option></select></label>
        <label>Deal<select name="deal_id"><option value="">Property (all tracks)</option>${ds.map((d) => `<option value="${esc(d.id)}">${esc(TRACKS[d.track].label)}</option>`).join("")}</select></label>
        <label>Next touch<input name="next_touch" type="date" value="${addDays(3)}"></label>
        <label class="wide">What happened<textarea name="summary" required></textarea></label><div class="wide"><button class="btn gold">Log it</button></div></form>
      <div class="log" style="margin-top:12px">${activities.map((a) => `<div><time>${esc(fmtWhen(a.at))}</time><span class="pill mute">${esc(a.kind)}</span> ${esc(a.summary)}${a.by ? ` <span class="hint">· ${esc(a.by)}</span>` : ""}</div>`).join("") || `<div class="hint">Nothing logged yet.</div>`}</div></section>
    <section class="card" style="border-color:#f1c4c4"><div class="head"><h3>Delete this property</h3></div>
      <p class="hint" style="margin:0 0 10px">Removes it from every track, here and in the Deal Desk, Sub-To and Creative dashboards, with its history. Contacts who asked not to be contacted stay on the do-not-contact list. This can't be undone.</p>
      <button type="button" class="btn small danger" id="delProp">Delete property</button></section>`;
  $("drawer").hidden = false;
  const body = $("dBody");
  body.querySelectorAll("[data-rmdeal]").forEach((b) => armClick(b, "Click again to remove", async () => {
    const r = await send("deal/" + b.dataset.rmdeal, "DELETE"); toast(r.properties ? "Removed. The property had no other tracks, so it was deleted." : "Removed from the track.");
    if (r.properties) { $("drawer").hidden = true; route(); } else openProperty(id);
  }));
  armClick($("delProp"), "Click again to delete for good", async () => { await send("property/" + id, "DELETE"); toast("Property deleted."); $("drawer").hidden = true; route(); });
  body.querySelectorAll("[data-deal]").forEach((f) => f.addEventListener("submit", async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(f));
    try { await send("deal/" + f.dataset.deal, "PATCH", fd); toast("Saved"); openProperty(id); } catch (er) { toast(er.message); }
  }));
  body.querySelectorAll("[data-addtrack]").forEach((b) => b.onclick = async () => {
    try { await send("deal", "POST", { property_id: id, track: b.dataset.addtrack, contact_id: contacts[0] && contacts[0].id }); toast("Added to " + TRACKS[b.dataset.addtrack].label); openProperty(id); } catch (er) { toast(er.message); }
  });
  body.querySelectorAll("[data-dnc]").forEach((b) => b.onclick = async () => {
    try { await send("contact/" + b.dataset.dnc, "PATCH", { opt_out: b.dataset.v === "1" }); toast(b.dataset.v === "1" ? "Marked do not contact" : "Contact allowed"); openProperty(id); } catch (er) { toast(er.message); }
  });
  body.querySelectorAll("[data-consent]").forEach((fm) => fm.onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(fm));
    try { await send("contact/" + fm.dataset.consent, "PATCH", { consent: true, consent_source: fd.how, consent_note: fd.note, property_id: id }); toast("Consent recorded"); openProperty(id); } catch (er) { toast(er.message); } });
  body.querySelectorAll("[data-unconsent]").forEach((b) => b.onclick = async () => {
    try { await send("contact/" + b.dataset.unconsent, "PATCH", { consent: false, property_id: id }); toast("Consent removed"); openProperty(id); } catch (er) { toast(er.message); } });
  $("addContact").onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    try { const r = await send("contact", "POST", { ...fd, property_id: id }); toast(r.merged ? "Matched an existing contact and linked it" : "Contact added"); openProperty(id); } catch (er) { toast(er.message); } };
  wireOwnerEmail(p, ds, contacts);
  $("propForm").onsubmit = async (e) => { e.preventDefault();
    try { await send("property/" + id, "PATCH", Object.fromEntries(new FormData(e.target))); toast("Saved"); openProperty(id); }
    catch (er) { toast(er.message); if (er.data && er.data.existing) openProperty(er.data.existing); } };
  $("logForm").onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    try { await send("activity", "POST", { ...fd, property_id: id, deal_id: fd.deal_id || null, contact_id: contacts[0] && contacts[0].id }); toast("Logged"); openProperty(id); } catch (er) { toast(er.message); } };
}
// Two-step confirm for destructive buttons: first click arms (label changes), second click within 5 s runs.
function armClick(btn, confirmLabel, fn) {
  btn.addEventListener("click", async () => {
    if (btn.dataset.armed !== "1") { const was = btn.textContent; btn.dataset.armed = "1"; btn.dataset.was = was; btn.textContent = confirmLabel;
      setTimeout(() => { if (btn.isConnected && btn.dataset.armed === "1") { btn.dataset.armed = ""; btn.textContent = was; } }, 5000); return; }
    btn.dataset.armed = ""; btn.disabled = true; btn.textContent = "Removing…";
    try { await fn(); } catch (er) { toast(er.message); btn.disabled = false; btn.textContent = btn.dataset.was; }
  });
}
function dealCard(d) {
  const tr = TRACKS[d.track];
  return `<form class="deal" data-deal="${esc(d.id)}"><div class="acts" style="justify-content:space-between"><b>${esc(tr.label)}</b>
      <span class="hint">${esc([d.ref, d.source].filter(Boolean).join(" · "))}</span></div>
    <div class="grid"><label>Stage<select name="stage">${tr.stages.map((s) => `<option ${s === d.stage ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label>Next touch<input type="date" name="next_touch" value="${esc(d.next_touch || "")}"></label>
      <label>Asking ($)<input name="asking" inputmode="decimal" value="${esc(d.asking ?? "")}"></label><label>Value / ARV ($)<input name="value" inputmode="decimal" value="${esc(d.value ?? "")}"></label>
      <label class="wide">Notes<textarea name="notes">${esc(d.notes || "")}</textarea></label></div>
    <div class="acts"><button class="btn small gold">Save</button>${dashLink(d)}<span style="flex:1"></span><button type="button" class="btn small danger" data-rmdeal="${esc(d.id)}" title="Takes this property off the ${esc(tr.label)} track here and in its dashboard">Remove from ${esc(tr.label)}</button></div></form>`;
}
function dashLink(d) {
  const L = { wholesale: LINKS[0][1][0], subto: LINKS[0][1][1], creative: LINKS[0][1][2] }[d.track];
  return L ? `<a class="btn small" href="${L[1]}" target="_blank" rel="noopener">Open ${esc(L[0])} ↗</a>` : "";
}

// ---------------- owner / family email drafts (office/owner-email.js) ----------------
let mailAddress = null;
const propLine = (p) => [p.address || p.name, p.city, [p.state, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
function ownerEmailSection(p, ds, contacts) {
  const tracks = ds.map((d) => d.track);
  const first = Object.entries(OWNER_TEMPLATES).find(([, t]) => tracks.includes(t.track));
  const withEmail = contacts.filter((c) => c.email);
  const heir = contacts.find((c) => /heir|executor|spouse/.test(c.role || "")) || withEmail[0] || null;
  const owner = contacts.find((c) => (c.role || "owner") === "owner" && c !== heir) || null;
  const blocked = contacts.length && contacts.every((c) => c.opt_out);
  return `<section class="card" id="oeCard"><div class="head"><h3>Email the owner or family</h3><span class="hint">Opens a draft in Gmail; nothing sends until you press Send</span></div>
    ${blocked ? `<p class="hint"><span class="pill bad">Do not contact</span> Every contact on this property opted out, so drafts are turned off.</p>` : `
    <form id="oeForm" class="grid">
      <label class="wide">Template<select name="tpl">${Object.entries(OWNER_TEMPLATES).map(([k, t]) => `<option value="${k}" ${first && first[0] === k ? "selected" : ""}>${esc(TRACKS[t.track].label)}: ${esc(t.label)}</option>`).join("")}</select></label>
      <label>Language<select name="lang"><option value="en">English</option><option value="es" ${heir && heir.lang === "es" ? "selected" : ""}>Spanish</option></select></label>
      <label>Send to (email)<input name="to" type="email" list="oeEmails" value="${esc(heir ? heir.email || "" : "")}"><datalist id="oeEmails">${withEmail.map((c) => `<option value="${esc(c.email)}">${esc(c.name || "")}</option>`).join("")}</datalist></label>
      <label>Recipient's name<input name="recipient" value="${esc(heir && heir !== owner && /heir|executor|spouse/.test(heir.role || "") ? heir.name || "" : "")}" placeholder="Blank: “To the family of …”"></label>
      <label>Late owner's name<input name="late" value="${esc(owner ? owner.name || "" : (!heir || !/heir|executor|spouse/.test(heir.role || "") ? (heir && heir.name) || "" : ""))}" placeholder="As on the county records"></label>
      <label class="wide">Subject<input name="subject"></label>
      <label class="wide">Message<textarea name="body" rows="16" style="font-family:inherit"></textarea></label>
      <label class="wide" id="oeAddrWrap" hidden>Your mailing address (required at the bottom of marketing emails; saved for next time)<input name="mail" placeholder="1030 Oxbow Lane, Dallas, TX 75241"></label>
      <div class="wide acts"><button class="btn gold" type="button" id="oeGmail">Open draft in Gmail</button><button class="btn" type="button" id="oeCopy">Copy text</button><span class="hint" id="oeMsg"></span></div>
      <div class="wide" style="border-top:1px solid var(--line, #e3e8ef);padding-top:10px;margin-top:4px">
        <div class="acts"><b>Or text the matching short version</b><span class="hint">Only to contacts with text consent on file; sends from the business phone inside texting hours</span></div>
        ${(() => { const ok = contacts.filter((c) => c.phone && c.consent && !c.opt_out && !c.litigator);
          return ok.length ? `<div class="acts" style="margin-top:8px"><select id="oeTextTo" style="width:auto">${ok.map((c) => `<option value="${esc(c.id)}">${esc((c.name || "Contact") + " · " + c.phone)}</option>`).join("")}</select>
            <button class="btn" type="button" id="oeText">Text via phone gateway</button><span class="hint" id="oeTextMsg"></span></div>`
            : `<p class="hint" style="margin:6px 0 0">No contact here has text consent on file, so texting is off. Use email or a letter.</p>`; })()}
      </div>
    </form>`}</section>`;
}
async function wireOwnerEmail(p, ds, contacts) {
  const f = $("oeForm"); if (!f) return;
  if (mailAddress === null) { try { mailAddress = (await api("settings")).mail_address || ""; } catch { mailAddress = ""; } }
  $("oeAddrWrap").hidden = !!mailAddress;
  const fill = () => {
    const v = Object.fromEntries(new FormData(f));
    const r = renderOwnerEmail(v.tpl, v.lang, { recipient: v.recipient, lateOwner: v.late, property: propLine(p), propertyShort: p.address || p.name || "", mailAddress: mailAddress || v.mail || "" });
    f.subject.value = r.subject; f.body.value = r.body;
  };
  fill();
  ["tpl", "lang", "recipient", "late", "mail"].forEach((k) => f[k].addEventListener("change", fill));
  const done = async (how) => {
    if (!mailAddress && f.mail.value.trim()) { try { await send("settings", "PUT", { mail_address: f.mail.value.trim() }); mailAddress = f.mail.value.trim(); } catch {} }
    const t = OWNER_TEMPLATES[f.tpl.value], d = ds.find((x) => x.track === t.track);
    try { await send("activity", "POST", { property_id: p.id, deal_id: d ? d.id : null, contact_id: (contacts.find((c) => c.email === f.to.value.trim()) || {}).id || null, kind: "email",
      summary: `${how}: “${f.subject.value}” (${t.label}${f.lang.value === "es" ? ", Spanish" : ""})${f.to.value ? " to " + f.to.value.trim() : ""}` }); } catch {}
  };
  $("oeGmail").onclick = async () => {
    if (!f.to.value.trim()) { $("oeMsg").textContent = "Add the email address first (or use Copy text)."; return; }
    if (!mailAddress && !f.mail.value.trim()) { $("oeMsg").textContent = "Add your mailing address first."; return; }
    open("https://mail.google.com/mail/?authuser=houselotandland@gmail.com&view=cm&fs=1&to=" + encodeURIComponent(f.to.value.trim()) + "&su=" + encodeURIComponent(f.subject.value) + "&body=" + encodeURIComponent(f.body.value), "_blank", "noopener");
    await done("Email drafted in Gmail"); $("oeMsg").textContent = "Draft opened in Gmail and logged in the history.";
  };
  if ($("oeText")) $("oeText").onclick = async () => {
    const tpl = "heir_" + OWNER_TEMPLATES[f.tpl.value].track, btn = $("oeText");
    btn.disabled = true; $("oeTextMsg").textContent = "Sending…";
    try { const r = await send("text", "POST", { template: tpl, id: $("oeTextTo").value, property_id: p.id, lang: f.lang.value, first_name: (f.recipient.value || "").trim().split(/\s+/)[0] || "" });
      $("oeTextMsg").textContent = r.message || "Sent."; }
    catch (er) { $("oeTextMsg").textContent = er.message; }
    btn.disabled = false;
  };
  $("oeCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(f.subject.value + "\n\n" + f.body.value); $("oeMsg").textContent = "Copied."; await done("Email text copied"); } catch { $("oeMsg").textContent = "Couldn't copy; select the text and copy it."; }
  };
}

// ---------------- add property ----------------
async function add() {
  $("view").innerHTML = `<section class="card"><div class="head"><h2>Add a property</h2><span class="hint">If the address or owner is already on file, it's matched instead of duplicated.</span></div>
    <form id="addForm" class="grid">
      <label class="wide">Street address<input name="address" placeholder="1234 Pecan Dr" autocomplete="off"></label>
      <label>Name (for parks or complexes)<input name="name"></label><label>City<input name="city"></label><label>State${stateSelect("state", "")}</label><label>ZIP<input name="zip" inputmode="numeric"></label><label>County<input name="county"></label>
      <label>Type<select name="prop_type">${TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label><label>Units / sites<input name="units" inputmode="numeric"></label>
      <label>Owner name<input name="cname"></label><label>Owner phone<input name="cphone" inputmode="tel"></label><label>Owner email<input name="cemail" type="email"></label>
      <label>Track<select name="track">${Object.entries(TRACKS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</select></label>
      <label>Source<input name="source" placeholder="Driving for dollars, referral…"></label>
      <label class="wide">Notes<textarea name="notes"></textarea></label>
      <div class="wide"><button class="btn gold">Add property</button></div></form><p id="addMsg" class="hint"></p></section>`;
  $("addForm").onsubmit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try {
      const r = await send("property", "POST", { property: { address: f.address, name: f.name, city: f.city, state: f.state, zip: f.zip, county: f.county, prop_type: f.prop_type, units: f.units },
        contact: f.cname || f.cphone || f.cemail ? { name: f.cname, phone: f.cphone, email: f.cemail } : null, track: f.track, source: f.source || "Back office", notes: f.notes });
      toast(r.merged ? (r.deal_merged ? "Already on file and on this track: opened it" : "Matched an existing property and added the track") : "Property added");
      e.target.reset(); openProperty(r.property_id);
    } catch (er) { $("addMsg").textContent = er.message; }
  };
}

// ---------------- workers ----------------
let wFilter = "";
async function workers() {
  const { rows } = await api("workers" + (wFilter ? "?status=" + wFilter : ""));
  $("view").innerHTML = `<section class="card"><div class="head"><h2>Workers and crews</h2><div class="acts"><a class="btn small" href="/work-with-us.html" target="_blank" rel="noopener">Public apply page ↗</a><button class="btn small gold" id="newW">Add a worker</button></div></div>
    <p class="hint" style="margin-top:0">Independent contractors only for now. Open a worker to send the W-9 request through your secure W-9 link (tax ID numbers never go through email, texts or this site). 1099-NEC is generally required once you pay someone $2,000 or more in 2026. Check with your CPA.</p>
    <div class="chips" style="margin-bottom:12px">${["", ...W_STATUS].map((s) => `<button class="chip" data-ws="${s}" aria-pressed="${wFilter === s}">${esc(s ? s[0].toUpperCase() + s.slice(1) : "All")}</button>`).join("")}</div>
    <div class="list">${rows.map((w) => `<div class="row"><button class="link" data-worker="${esc(w.id)}"><div class="t">${esc(w.name)} <span class="pill ${W_PILL[w.status]}">${esc(w.status)}</span></div>
      <div class="s">${esc([w.ref, w.kind === "crew" ? "Crew" : "Contractor", w.city, w.phone].filter(Boolean).join(" · "))}<br>${esc((w.trades || []).join(", "))}</div></button>
      <div class="s" style="text-align:right">${w.jobs} jobs${w.owed ? `<br><b style="color:var(--bad)">Owed ${usd(w.owed)}</b>` : ""}${w.paid_ytd ? `<br>Paid ${usd(w.paid_ytd)} this year` : ""}<br>W-9: ${esc(w.w9)}${w.w9_at && w.w9 !== "not requested" ? " " + fmtDate(w.w9_at) : ""}</div></div>`).join("") || `<div class="empty">No workers yet. Share the apply page or add one.</div>`}</div></section>`;
  $("view").querySelectorAll("[data-ws]").forEach((b) => b.onclick = () => { wFilter = b.dataset.ws; workers(); });
}
function checks(name, all, sel) { return `<div class="checks">${all.map((x) => `<label><input type="checkbox" name="${name}" value="${esc(x)}" ${sel.includes(x) ? "checked" : ""}> ${esc(x)}</label>`).join("")}</div>`; }
function workerForm(w) {
  w = w || { status: "approved", kind: "contractor", trades: [], equipment: [], availability: [], w9: "not requested" };
  return `<form id="wForm" class="grid">
    <label>Name<input name="name" value="${esc(w.name || "")}" required></label><label>Phone<input name="phone" value="${esc(w.phone || "")}"></label><label>Email<input name="email" value="${esc(w.email || "")}"></label>
    <label>City<input name="city" value="${esc(w.city || "")}"></label><label>ZIP<input name="zip" value="${esc(w.zip || "")}"></label>
    <label>Status<select name="status">${W_STATUS.map((s) => `<option ${s === w.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <label>Type<select name="kind"><option value="contractor" ${w.kind !== "crew" ? "selected" : ""}>Independent contractor</option><option value="crew" ${w.kind === "crew" ? "selected" : ""}>Crew member</option></select></label>
    <label>W-9<select name="w9">${["not requested", "requested", "received"].map((s) => `<option ${s === w.w9 ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <label>Agreement signed<input type="date" name="agreement_at" value="${esc((w.agreement_at || "").slice(0, 10))}"></label>
    <label>Insurance expires<input type="date" name="insurance_exp" value="${esc(w.insurance_exp || "")}"></label>
    <label>Rate / pay terms<input name="rate_note" value="${esc(w.rate_note || "")}" placeholder="$140 per Refresh job"></label>
    <div class="wide"><label>Work they do</label>${checks("trades", TRADES, w.trades)}</div>
    <div class="wide"><label>Equipment</label>${checks("equipment", EQUIP, w.equipment)}</div>
    <div class="wide"><label>Days available (no Saturday work)</label>${checks("availability", DAYS, w.availability)}</div>
    <label class="wide">Notes<textarea name="notes">${esc(w.notes || "")}</textarea></label>
    ${w.experience ? `<div class="wide note"><b>From their application:</b> ${esc(w.experience)}</div>` : ""}
    <div class="wide"><button class="btn gold">Save worker</button></div></form>`;
}
const readW = (f) => { const fd = new FormData(f), o = Object.fromEntries(fd); for (const k of ["trades", "equipment", "availability"]) o[k] = fd.getAll(k); return o; };
async function openWorker(id) {
  const { worker: w, jobs } = await api("worker/" + id);
  const { rows: svc } = await api("open-services");
  $("dBody").innerHTML = `<div><h2 id="dTitle">${esc(w.name)}</h2><p class="hint" style="margin:4px 0 0">${esc([w.ref, "applied " + fmtDate(w.created_at), w.lang === "es" ? "Prefers Spanish" : "", w.consent ? "OK to text" : "No text consent"].filter(Boolean).join(" · "))}</p></div>
    <section class="card">${workerForm(w)}</section>
    ${await w9Section(w)}
    <section class="card"><div class="head"><h3>Jobs and pay</h3><span class="hint">No Saturday dates</span></div>
      <form id="jobForm" class="grid"><label class="wide">Service order<select name="service_request_id"><option value="">Other job (type a title)</option>${svc.map((s) => `<option value="${esc(s.id)}">${esc(s.ref)} · ${esc(s.label)} · ${esc(s.property_address || "")}${s.crew ? " · crew: " + esc(s.crew) : ""}</option>`).join("")}</select></label>
        <label>Title<input name="title" placeholder="Curb Appeal Refresh, 123 Main"></label><label>Date<input type="date" name="work_date" min="${today()}"></label><label>Pay ($)<input name="pay" inputmode="decimal"></label>
        <div class="wide"><button class="btn gold">Assign job</button></div></form>
      <div class="list" style="margin-top:10px">${jobs.map((j) => `<div class="row"><div><div class="t">${esc(j.title || j.slabel || "Job")}</div><div class="s">${esc([fmtDate(j.work_date), j.sref, j.property_address, j.pay != null ? usd(j.pay) : ""].filter(Boolean).join(" · "))}</div></div>
        <div class="acts"><span class="pill ${j.paid_at ? "ok" : j.status === "done" ? "bad" : "mute"}">${j.paid_at ? "Paid " + fmtDate(j.paid_at) : j.status === "done" ? "Done, unpaid" : esc(j.status)}</span>
        ${j.status === "scheduled" ? `<button class="btn small" data-job="${esc(j.id)}" data-st="done">Mark done</button>` : ""}${!j.paid_at && j.status === "done" ? `<button class="btn small" data-job="${esc(j.id)}" data-paid="1">Mark paid</button>` : ""}</div></div>`).join("") || `<p class="hint">No jobs yet.</p>`}</div></section>`;
  $("drawer").hidden = false;
  $("wForm").onsubmit = async (e) => { e.preventDefault(); try { await send("worker/" + id, "PATCH", readW(e.target)); toast("Saved"); openWorker(id); } catch (er) { toast(er.message); } };
  wireW9(w, () => { openWorker(id); if (location.hash.startsWith("#workers")) workers(); });
  $("jobForm").onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    if (f.work_date && new Date(f.work_date + "T12:00:00Z").getUTCDay() === 6) { toast("No Saturday work (Shabbat). Pick another day."); return; }
    const s = svc.find((x) => x.id === f.service_request_id); if (!f.title && s) f.title = `${s.label}, ${s.property_address || ""}`;
    try { await send("job", "POST", { ...f, worker_id: id }); toast("Job assigned"); openWorker(id); } catch (er) { toast(er.message); } };
  $("dBody").querySelectorAll("[data-job]").forEach((b) => b.onclick = async () => {
    const body = b.dataset.paid ? { paid_at: today(), pay_method: prompt("Paid how? (cash, Zelle, check…)", "cash") || "cash" } : { status: b.dataset.st };
    try { await send("job/" + b.dataset.job, "PATCH", body); toast("Saved"); openWorker(id); } catch (er) { toast(er.message); }
  });
}
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "wForm" || !$("view").contains(e.target)) return;
  e.preventDefault();
  try { const r = await send("worker", "POST", readW(e.target)); toast("Worker added"); $("drawer").hidden = true; openWorker(r.id); } catch (er) { toast(er.message); }
});
document.addEventListener("click", (e) => { if (e.target.id === "newW") { $("view").insertAdjacentHTML("beforeend", `<section class="card"><div class="head"><h2>Add a worker</h2></div>${workerForm(null)}</section>`); e.target.disabled = true; } }, true);


// ---------------- import (Google Maps saved lists) ----------------
let imp = { rows: [], list: "", busy: false, src: "", sort: { key: "", dir: 1 }, filter: "all", page: 0 };
let impPageSize = (() => { try { return +localStorage.getItem("hll_imp_page") || 25; } catch { return 25; } })();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const looksStreet = (s) => /^\d+[A-Za-z]?\s+\S+/.test(String(s || "").trim());
function coordsIn(s) {
  const t = decodeURIComponent(String(s || ""));
  const m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
    t.match(/\/(?:search|place)\/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/) || t.match(/^\s*\(?(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})\)?\s*$/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
function makeRow(o) {
  const r = { name: o.name || "", address: "", city: "", zip: "", county: "", lat: o.lat ?? null, lng: o.lng ?? null, note: o.note || "", link: o.link || "", on: true, found: false, state: "" };
  const src = o.address || (looksStreet(o.name) ? o.name : "");
  if (src) Object.assign(r, splitAddr(src));
  if (r.name && r.address && r.name.split(",")[0].trim().toLowerCase() === r.address.toLowerCase()) r.name = "";
  return r;
}
function parseLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const c = coordsIn(l);
    if (c) return makeRow({ ...c, link: /^https?:/.test(l) ? l : "" });
    if (/^https?:/.test(l)) { const pm = decodeURIComponent(l).match(/\/maps\/place\/([^/@]+)/); return makeRow({ name: pm ? pm[1].replace(/\+/g, " ") : "", link: l }); }
    return makeRow({ address: l });
  });
}
function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
function parseTakeout(name, text) {
  if (/\.json$/i.test(name) || /^\s*[{[]/.test(text)) {
    const j = JSON.parse(text), feats = j.features || [];
    return feats.map((ft) => { const pr = ft.properties || {}, loc = pr.location || {}, g = (ft.geometry || {}).coordinates || [];
      return makeRow({ name: loc.name || pr.Title || pr.name || "", address: loc.address || pr.address || "", lat: g[1] ?? null, lng: g[0] ?? null, note: pr.Comment || pr.note || "", link: pr.google_maps_url || pr.url || "" }); });
  }
  const rows = parseCsv(text); if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase()), ix = (n) => head.indexOf(n);
  const hasHead = ix("title") >= 0 || ix("url") >= 0;
  const T = hasHead ? ix("title") : 0, N = hasHead ? ix("note") : 1, U = hasHead ? ix("url") : 2, C = hasHead ? ix("comment") : -1;
  return rows.slice(hasHead ? 1 : 0).map((r) => {
    const title = (r[T] || "").trim(), url = (r[U] || "").trim(), c = coordsIn(url) || coordsIn(title);
    return makeRow({ name: title, lat: c?.lat, lng: c?.lng, note: [r[N], C >= 0 ? r[C] : ""].filter((x) => x && x.trim()).join(" · "), link: url });
  });
}
const keyOf = (r) => propertyKey({ address: r.address, city: r.city, zip: r.zip, state: r.state, name: r.name });
function rowState(r) {
  if (r.found) return (r.tracks || []).length ? ["mute", "On file · " + r.tracks.map((k) => TRACKS[k]?.label || k).join(", ")] : ["warn", "On file · no track"];
  if (!looksStreet(r.address) && r.lat != null && !r.approx) return ["bad", "Pin only: find its address"];
  if (!looksStreet(r.address) && !(r.name && r.city)) return ["bad", "Needs an address"];
  if (r.approx) return ["warn", "Nearest street (check it)"];
  return ["ok", "Ready"];
}
async function checkExisting() {
  const keys = [...new Set(imp.rows.map(keyOf).filter(Boolean))];
  if (!keys.length) return;
  try { const { found } = await send("import/check", "POST", { keys });
    imp.rows.forEach((r) => { const f = found[keyOf(r)]; if (f) { r.found = true; r.pid = f.id; r.ptype = f.type; r.tracks = f.tracks; } else if (imp.src !== "onfile") { r.found = false; r.pid = null; r.ptype = ""; r.tracks = []; } }); } catch {}
}
async function importView() {
  $("view").innerHTML = `<section class="card"><div class="head"><h2>Import a Google Maps list</h2><span class="hint">Addresses already on file are matched, never duplicated.</span></div>
    <div class="chips" style="margin-bottom:12px"><button class="chip" data-src="link" aria-pressed="true">Share link</button><button class="chip" data-src="paste" aria-pressed="false">Paste</button><button class="chip" data-src="file" aria-pressed="false">Takeout file</button><button class="chip" data-src="onfile" aria-pressed="false">On file, no track or type</button></div>
    <form id="srcLink" class="grid"><label class="wide">List share link<input name="url" placeholder="https://maps.app.goo.gl/…" autocomplete="off"></label>
      <p class="hint wide" style="margin:0">In Google Maps: Saved → open the list → Share → make sure it's shared with anyone with the link → Copy link.</p>
      <div class="wide"><button class="btn gold">Load list</button></div></form>
    <form id="srcPaste" class="grid" hidden><label class="wide">One per line: street addresses, coordinates (32.7767, -96.7970) or Google Maps links<textarea name="text" rows="7" placeholder="3917 Holliday Rd, Dallas, TX 75211&#10;32.71234, -96.65432&#10;https://maps.google.com/?q=32.7,-96.8"></textarea></label>
      <div class="wide"><button class="btn gold">Load lines</button></div></form>
    <form id="srcFile" class="grid" hidden><label class="wide">Google Takeout file (Saved lists .csv, or Saved Places .json)<input type="file" name="file" accept=".csv,.json,text/csv,application/json"></label>
      <p class="hint wide" style="margin:0">takeout.google.com → Deselect all → check “Saved” (and “Maps (your places)” for starred places) → export, then pick the list's .csv from the download.</p>
      <div class="wide"><button class="btn gold">Load file</button></div></form>
    <form id="srcOnfile" class="grid" hidden><p class="hint wide" style="margin:0">Properties already in the master list that aren't on any track, or have no property type yet. Sort and select them below, then add them to a track or set their type in bulk.</p>
      <div class="wide"><button class="btn gold">Load properties</button></div></form>
    <p id="impMsg" class="hint"></p><p id="countyFill" class="hint"></p></section><div id="impPreview"></div>`;
  $("view").querySelectorAll("[data-src]").forEach((b) => b.onclick = () => {
    $("view").querySelectorAll("[data-src]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    $("srcLink").hidden = b.dataset.src !== "link"; $("srcPaste").hidden = b.dataset.src !== "paste"; $("srcFile").hidden = b.dataset.src !== "file"; $("srcOnfile").hidden = b.dataset.src !== "onfile";
  });
  const loaded = async (rows, list, src) => { imp = { ...imp, rows: rows.map((r, n) => ({ ...r, uid: n + 1 })), list, src, busy: false, filter: "all", page: 0, sort: { key: "", dir: 1 } };
    await checkExisting(); drawPreview(); $("impMsg").textContent = `${rows.length} places loaded.`; autoCounties(); };
  $("srcLink").onsubmit = async (e) => { e.preventDefault(); $("impMsg").textContent = "Reading the list from Google…";
    try { const r = await send("import/gmaps-link", "POST", { url: e.target.url.value.trim() }); await loaded(r.rows.map(makeRow), r.list_name, "link"); }
    catch (er) { $("impMsg").textContent = er.message; } };
  $("srcPaste").onsubmit = async (e) => { e.preventDefault(); await loaded(parseLines(e.target.text.value), "Pasted list", "paste"); };
  $("srcOnfile").onsubmit = async (e) => { e.preventDefault(); $("impMsg").textContent = "Loading…";
    try { const { rows } = await api("import/unassigned");
      await loaded(rows.map((r) => ({ name: r.name, address: r.address, city: r.city, zip: r.zip, state: r.state, county: r.county, lat: r.lat, lng: r.lng, note: [r.list, r.note].filter(Boolean).join(" · "),
        on: false, found: true, pid: r.id, ptype: r.type, tracks: r.tracks, link: "" })), "On file, no track or type", "onfile");
      imp.filter = "all"; drawPreview(); } catch (er) { $("impMsg").textContent = er.message; } };
  $("srcFile").onsubmit = async (e) => { e.preventDefault(); const fl = e.target.file.files[0]; if (!fl) { toast("Pick a file first."); return; }
    try { await loaded(parseTakeout(fl.name, await fl.text()), fl.name.replace(/\.(csv|json)$/i, ""), "file"); } catch (er) { $("impMsg").textContent = "Couldn't read that file: " + er.message; } };
  if (imp.rows.length) drawPreview();
  fillFileCounties();
}
// Counties fill in by themselves: list rows as soon as a list loads, and properties already on file in the background.
async function autoCounties() {
  const todo = imp.rows.filter((r) => !r.county && (r.lat != null || looksStreet(r.address)));
  for (let i = 0; i < todo.length; i += 25) {
    const part = todo.slice(i, i + 25);
    const pr = $("impProg"); if (pr) pr.textContent = `Finding counties… ${Math.min(i + 25, todo.length)} of ${todo.length}`;
    try { const { counties } = await send("counties", "POST", { items: part.map((r) => ({ key: r.uid, lat: r.lat, lng: r.lng, address: r.address, city: r.city, zip: r.zip, state: r.state })) });
      part.forEach((r) => { if (counties[r.uid] && !r.county) r.county = counties[r.uid]; }); } catch { break; }
    if (location.hash.startsWith("#import") && !document.activeElement?.matches?.("#impPreview input")) drawPreview();
  }
  const pr = $("impProg"); if (pr && todo.length) pr.textContent = `Counties filled: ${todo.filter((r) => r.county).length} of ${todo.length}.`;
}
let fillingCounties = false;
async function fillFileCounties() {
  if (fillingCounties) return; fillingCounties = true;
  try {
    for (let k = 0; k < 40; k++) {
      const r = await send("import/fill-counties", "POST", {});
      const el = $("countyFill"); if (el) el.textContent = r.left ? `Filling in counties for properties on file… ${r.left} left` : "";
      if (!r.left || !r.checked) break;
    }
  } catch {} finally { fillingCounties = false; const el = $("countyFill"); if (el) el.textContent = ""; }
}
// Filters, sorting, paging and selection for the import list (and for "on file, no track or type").
const IMP_FILTERS = [["all", "All"], ["new", "New"], ["onfile", "On file"], ["notrack", "On file, no track"], ["notype", "No type"], ["needs", "Needs address"]];
function impMatch(r, f) {
  if (f === "new") return !r.found;
  if (f === "onfile") return r.found;
  if (f === "notrack") return r.found && !(r.tracks || []).length;
  if (f === "notype") return !r.ptype;
  if (f === "needs") return rowState(r)[0] === "bad";
  return true;
}
const IMP_SORT = { name: (r) => r.name, address: (r) => r.address.replace(/^\d+\s*/, "") + " " + String(parseInt(r.address) || 0).padStart(7, "0"), city: (r) => r.city, state: (r) => r.state, zip: (r) => r.zip,
  county: (r) => r.county, type: (r) => r.ptype || "", status: (r) => rowState(r)[1], order: (r) => String(r.uid).padStart(6, "0") };
function impView() {
  let list = imp.rows.filter((r) => impMatch(r, imp.filter));
  const k = imp.sort.key;
  if (k) list = list.slice().sort((a, b) => { const x = String(IMP_SORT[k](a) || ""), y = String(IMP_SORT[k](b) || "");
    if (!x && y) return 1; if (x && !y) return -1; return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" }) * imp.sort.dir; });
  const size = impPageSize || list.length || 1, pages = Math.max(1, Math.ceil(list.length / size));
  if (imp.page >= pages) imp.page = pages - 1;
  return { list, pages, shown: impPageSize ? list.slice(imp.page * size, imp.page * size + size) : list };
}
function drawPreview() {
  const rows = imp.rows, sel = rows.filter((r) => r.on);
  const pins = sel.filter((r) => r.lat != null && !looksStreet(r.address) && !r.approx).length;
  const fwd = sel.filter((r) => looksStreet(r.address) && !r.zip && !r.found).length;
  const ready = sel.filter((r) => !r.found && rowState(r)[0] !== "bad").length;
  const selOnFile = sel.filter((r) => r.found && r.pid).length;
  const { list, pages, shown } = impView();
  const th = (key, label) => `<th><button class="link sort" data-sort="${key}" title="Sort">${label}${imp.sort.key === key ? (imp.sort.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
  const allShownOn = shown.length && shown.every((r) => r.on);
  $("impPreview").innerHTML = `<section class="card"><div class="head"><h2>${esc(imp.list || "Preview")}</h2><span class="hint">${rows.length} places · ${rows.filter((r) => r.found).length} on file · ${sel.length} selected</span></div>
    <div class="grid" style="margin-bottom:10px">
      <label>Add to track<select id="impTrack"><option value="">No track (just the property)</option>${Object.entries(TRACKS).map(([k, v]) => `<option value="${k}" ${imp.track === k ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></label>
      <label>Type<select id="impType"><option value="">Not set</option>${TYPES.map((t) => `<option ${imp.ptype === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="wide">Source label<input id="impSource" value="${esc(imp.source ?? ("Google Maps list: " + (imp.list || "")))}"></label></div>
    <p>${imp.src !== "onfile" ? `<button class="btn" type="button" id="impGeo" ${pins + fwd ? "" : "disabled"}>Find street addresses (${pins} pins${fwd ? `, ${fwd} missing ZIP` : ""})</button>
      <button class="btn gold" type="button" id="impGo" ${ready ? "" : "disabled"}>Import ${ready} new</button>` : ""}
      <button class="btn ${imp.src === "onfile" ? "gold" : ""}" type="button" id="impAssign" ${selOnFile ? "" : "disabled"} title="Uses the track and type picked above">Apply track/type to ${selOnFile} selected on file</button>
      <span class="hint" id="impProg"></span></p>
    <div class="chips" style="margin:6px 0 10px">${IMP_FILTERS.map(([k, l]) => `<button class="chip" data-impf="${k}" aria-pressed="${imp.filter === k}">${esc(l)} <span class="hint">${rows.filter((r) => impMatch(r, k)).length}</span></button>`).join("")}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">
      <button class="btn small" type="button" id="impAll">Select all ${list.length}${imp.filter !== "all" ? " shown" : ""}</button>
      <button class="btn small" type="button" id="impNone">Select none</button>
      <button class="btn small" type="button" id="impRemove" ${sel.length ? "" : "disabled"}>Remove ${sel.length} selected from this list</button>
      <span style="flex:1"></span>
      <label class="hint" style="display:flex;gap:6px;align-items:center;white-space:nowrap">Rows per page <select id="impSize">${[25, 50, 100, 0].map((n) => `<option value="${n}" ${impPageSize === n ? "selected" : ""}>${n || "All"}</option>`).join("")}</select></label>
      ${pages > 1 ? `<button class="btn small" type="button" id="impPrev" ${imp.page ? "" : "disabled"}>‹ Prev</button><span class="hint">Page ${imp.page + 1} of ${pages}</span><button class="btn small" type="button" id="impNext" ${imp.page < pages - 1 ? "" : "disabled"}>Next ›</button>` : ""}
    </div>
    <div class="tablewrap"><table><thead><tr><th><input type="checkbox" id="impPageAll" ${allShownOn ? "checked" : ""} aria-label="Select this page"></th>${th("name", "Name")}${th("address", "Street address")}${th("city", "City")}${th("state", "State")}${th("zip", "ZIP")}${th("county", "County")}${th("type", "Type")}<th>Pin</th>${th("status", "Status")}</tr></thead><tbody>
    ${shown.map((r) => { const i = rows.indexOf(r), [c, t] = rowState(r); return `<tr><td><input type="checkbox" data-on="${i}" ${r.on ? "checked" : ""} aria-label="Select"></td>
      <td><input data-i="${i}" data-k="name" value="${esc(r.name)}" style="min-width:140px" ${r.found && imp.src === "onfile" ? "readonly" : ""}>${r.note ? `<div class="hint">${esc(r.note)}</div>` : ""}</td>
      <td><input data-i="${i}" data-k="address" value="${esc(r.address)}" style="min-width:180px" ${imp.src === "onfile" ? "readonly" : ""}></td><td><input data-i="${i}" data-k="city" value="${esc(r.city)}" style="width:110px" ${imp.src === "onfile" ? "readonly" : ""}></td>
      <td><input data-i="${i}" data-k="state" value="${esc(r.state || "")}" style="width:44px" maxlength="2" placeholder="TX" title="Two-letter state" ${imp.src === "onfile" ? "readonly" : ""}></td>
      <td><input data-i="${i}" data-k="zip" value="${esc(r.zip)}" style="width:70px" inputmode="numeric" ${imp.src === "onfile" ? "readonly" : ""}></td><td><input data-i="${i}" data-k="county" value="${esc(r.county)}" style="width:90px" ${imp.src === "onfile" ? "readonly" : ""}></td>
      <td>${r.ptype ? esc(r.ptype) : `<span class="hint">—</span>`}</td>
      <td>${r.lat != null ? `<a href="https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}" target="_blank" rel="noopener">${(+r.lat).toFixed(5)}, ${(+r.lng).toFixed(5)} ↗</a>` : "—"}</td>
      <td>${r.pid ? `<button class="link" data-prop="${esc(r.pid)}"><span class="pill ${c}">${esc(t)}</span></button>` : `<span class="pill ${c}">${esc(t)}</span>`}</td></tr>`; }).join("")}</tbody></table></div>
    ${list.length ? "" : `<div class="empty">Nothing here.</div>`}</section>`;
  const tb = $("impPreview");
  const keep = () => { imp.track = $("impTrack").value; imp.ptype = $("impType").value; imp.source = $("impSource").value; };
  ["impTrack", "impType", "impSource"].forEach((id) => $(id).onchange = keep);
  tb.querySelectorAll("[data-on]").forEach((c) => c.onchange = () => { keep(); rows[c.dataset.on].on = c.checked; drawPreview(); });
  $("impPageAll").onchange = (e) => { keep(); shown.forEach((r) => { r.on = e.target.checked; }); drawPreview(); };
  $("impAll").onclick = () => { keep(); list.forEach((r) => { r.on = true; }); drawPreview(); };
  $("impNone").onclick = () => { keep(); rows.forEach((r) => { r.on = false; }); drawPreview(); };
  $("impRemove").onclick = () => { keep(); const n = rows.filter((r) => r.on).length; imp.rows = rows.filter((r) => !r.on); toast(`${n} removed from this list (nothing deleted from the master list)`); drawPreview(); };
  tb.querySelectorAll("[data-impf]").forEach((b) => b.onclick = () => { keep(); imp.filter = b.dataset.impf; imp.page = 0; drawPreview(); });
  tb.querySelectorAll("[data-sort]").forEach((b) => b.onclick = () => { keep(); const k = b.dataset.sort; imp.sort = imp.sort.key === k ? (imp.sort.dir > 0 ? { key: k, dir: -1 } : { key: "", dir: 1 }) : { key: k, dir: 1 }; drawPreview(); });
  $("impSize").onchange = (e) => { keep(); impPageSize = +e.target.value; imp.page = 0; try { localStorage.setItem("hll_imp_page", String(impPageSize)); } catch {} drawPreview(); };
  if ($("impPrev")) { $("impPrev").onclick = () => { keep(); imp.page--; drawPreview(); }; $("impNext").onclick = () => { keep(); imp.page++; drawPreview(); }; }
  tb.querySelectorAll("input[data-i]:not([readonly])").forEach((el) => el.onchange = async () => { keep(); const r = rows[el.dataset.i]; r[el.dataset.k] = el.dataset.k === "state" ? (normState(el.value) || "") : el.value.trim(); r.approx = false; await checkExisting(); drawPreview(); });
  if ($("impGeo")) $("impGeo").onclick = () => { keep(); geocodeRows(); };
  if ($("impGo")) $("impGo").onclick = () => { keep(); runImport(); };
  $("impAssign").onclick = () => { keep(); runAssign(); };
}
async function runAssign() {
  if (imp.busy) return;
  const track = imp.track || "", prop_type = imp.ptype || "", source = (imp.source || "").trim() || imp.list;
  if (!track && !prop_type) { toast("Pick a track and/or a type above first."); return; }
  const rows = imp.rows.filter((r) => r.on && r.found && r.pid);
  if (!rows.length) return;
  imp.busy = true; let tracked = 0, typed = 0;
  for (let i = 0; i < rows.length; i += 50) {
    $("impProg").textContent = `Updating ${Math.min(i + 50, rows.length)} of ${rows.length}…`;
    try { const r = await send("import/assign", "POST", { ids: rows.slice(i, i + 50).map((x) => x.pid), track, prop_type, source }); tracked += r.tracked; typed += r.typed; }
    catch (er) { toast(er.message); break; }
  }
  rows.forEach((r) => { if (prop_type) r.ptype = prop_type; if (track && !(r.tracks || []).includes(track)) r.tracks = [...(r.tracks || []), track]; r.on = false; });
  imp.busy = false; drawPreview();
  $("impProg").textContent = [tracked && `${tracked} added to ${TRACKS[track].label}`, typed && `${typed} set to ${prop_type}`].filter(Boolean).join(" · ") || "Nothing changed.";
}
async function geocodeRows() {
  if (imp.busy) return; imp.busy = true;
  const todo = imp.rows.filter((r) => r.on && ((r.lat != null && !looksStreet(r.address) && !r.approx) || (looksStreet(r.address) && !r.zip)));
  let n = 0;
  for (const r of todo) {
    $("impProg").textContent = `Looking up ${++n} of ${todo.length}… (about 1 per second)`;
    try {
      const qs = r.lat != null && !looksStreet(r.address) ? `lat=${r.lat}&lng=${r.lng}` : `q=${encodeURIComponent([r.address, r.city, r.state || zipState(r.zip)].filter(Boolean).join(", "))}`;
      const g = await api("geocode?" + qs);
      if (!looksStreet(r.address)) {
        if (!r.name && r.address) r.name = r.address;
        r.address = g.address || r.address; r.approx = !g.exact;
        // No house number: keep the pin in the name so two pins on the same road stay separate properties.
        if (!g.exact && r.lat != null) r.name = `${r.name && !/^dropped pin$/i.test(r.name) ? r.name + " · " : ""}pin ${(+r.lat).toFixed(5)}, ${(+r.lng).toFixed(5)}`;
      }
      r.city = r.city || g.city; r.zip = r.zip || g.zip; r.state = r.state || g.state || zipState(r.zip); r.county = r.county || g.county;
      if (r.lat == null && g.lat != null) { r.lat = g.lat; r.lng = g.lng; }
    } catch {}
    await sleep(1100);
  }
  imp.busy = false; await checkExisting(); drawPreview();
  $("impProg").textContent = "Done. Rows marked “Nearest street” had no house number; check those against the map.";
  autoCounties();
}
async function runImport() {
  if (imp.busy) return;
  const rows = imp.rows.filter((r) => r.on && !r.found && rowState(r)[0] !== "bad");
  if (!rows.length) return;
  imp.busy = true;
  const track = imp.track || "", prop_type = imp.ptype || "", source = (imp.source ?? $("impSource").value).trim();
  const tot = { added: 0, merged: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i += 25) {
    $("impProg").textContent = `Importing ${Math.min(i + 25, rows.length)} of ${rows.length}…`;
    try {
      const r = await send("import/properties", "POST", { rows: rows.slice(i, i + 25), track, prop_type, source, list_name: imp.list });
      tot.added += r.added; tot.merged += r.merged; tot.skipped += r.skipped; tot.errors.push(...r.errors);
    } catch (er) { tot.errors.push(er.message); break; }
  }
  try { await send("import/properties", "POST", { rows: [], source, list_name: imp.list, log_import: { rows: rows.length, ...tot } }); } catch {}
  imp.busy = false; await checkExisting(); drawPreview();
  $("impProg").textContent = `Imported: ${tot.added} new, ${tot.merged} matched existing, ${tot.skipped} skipped.${tot.errors.length ? " Problems: " + tot.errors.slice(0, 3).join("; ") : ""}`;
  toast(`${tot.added} properties added`);
}

// ---------------- services & sales (overview) ----------------
const SVC = { curb: "Curb Appeal", watch: "Property Watch", homestead: "Homestead Trust", contracts: "Contract Drafting" };
const ST_LABEL = { requested: "Requested", quoted: "Quote sent", awaiting_payment: "Awaiting payment", paid: "Paid, to schedule", scheduled: "Scheduled", in_progress: "In progress",
  completed: "Completed", cancelled: "Cancelled", active: "Active subscription", past_due: "Past due", delivered: "Delivered", quote_requested: "Quote requested", waitlist: "Waitlist", won: "Won", lost: "Lost", refunded: "Refunded", test: "Test" };
const ST_PILL = { requested: "warn", quoted: "warn", awaiting_payment: "warn", paid: "bad", scheduled: "", in_progress: "", completed: "ok", cancelled: "mute", active: "ok", past_due: "bad", delivered: "ok", quote_requested: "warn", waitlist: "mute", refunded: "mute", test: "mute" };
// Which statuses the job drawer offers: field work (Curb Appeal, Property Watch) vs documents and plans.
const JOB_STATUSES = {
  field: ["requested", "quoted", "awaiting_payment", "paid", "scheduled", "in_progress", "completed", "cancelled", "refunded"],
  doc: ["awaiting_payment", "paid", "delivered", "cancelled", "refunded"],
  sub: ["awaiting_payment", "active", "past_due", "cancelled", "refunded"],
};
const when = (s) => (s ? new Date(s).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
function salesSection(x) {
  if (!x) return "";
  const svcRows = Object.entries(x.byService);
  return `<section class="card"><div class="head"><h2>Services &amp; sales</h2><a class="hint" href="#jobs">Open the Jobs tab →</a></div>
    <div class="kpis" style="margin:0 0 14px">
      <a class="kpi" href="#jobs"><b>${usd(x.month)}</b><span>Paid this month · ${x.monthN} payment${x.monthN === 1 ? "" : "s"}</span></a>
      <a class="kpi" href="#jobs"><b>${usd(x.last30)}</b><span>Last 30 days · ${usd(x.year)} this year</span></a>
      <a class="kpi" href="#jobs"><b>${x.subs}</b><span>Active subscriptions · ${usd(x.mrr)}/mo${x.pastDue ? ` · ${x.pastDue} past due` : ""}</span></a>
      <a class="kpi" href="#jobs"><b>${usd(x.invoices30)}</b><span>Subscription invoices paid (30 days) · ${x.invoices30N}</span></a>
      <a class="kpi" href="#jobs"><b>${x.openJobs}</b><span>Open jobs · ${x.needsSched.length} to schedule</span></a>
      <a class="kpi" href="#jobs"><b>${x.unpaid}</b><span>Awaiting payment · ${usd(x.unpaidAmt)}</span></a>
      <a class="kpi" href="#workers"><b>${usd(x.crewOwed)}</b><span>Crew pay owed · ${x.crewOwedN} job${x.crewOwedN === 1 ? "" : "s"}</span></a>
    </div>
    ${x.testN ? `<p class="hint" style="margin:-4px 0 12px">Not counted above: ${x.testN} test payment${x.testN === 1 ? "" : "s"} (${usd(x.testTotal)}) from test orders and Stripe test mode.</p>` : ""}
    <div class="two">
      <div><h3>Upcoming jobs</h3><div class="list">${x.upcoming.length ? x.upcoming.map((r) => `<div class="row"><button class="link" data-sr="${esc(r.id)}"><div class="t">${esc(when(r.appointment_at))} · ${esc(r.label)}</div>
        <div class="s">${esc([r.ref, r.name, r.property_address].filter(Boolean).join(" · "))}${r.test ? " · TEST" : ""}</div></button><span class="pill ${ST_PILL[r.status] || ""}">${esc(ST_LABEL[r.status] || r.status)}</span></div>`).join("") : `<div class="empty">Nothing scheduled.</div>`}
        ${x.needsSched.length ? `<h3 style="margin-top:14px">Paid or booked, needs a date</h3>${x.needsSched.map((r) => `<div class="row"><button class="link" data-sr="${esc(r.id)}"><div class="t">${esc(r.label)}</div>
          <div class="s">${esc([r.ref, r.name, r.answers.date1 ? "asked for " + fmtDate(r.answers.date1) : ""].filter(Boolean).join(" · "))}</div></button><span class="pill ${ST_PILL[r.status]}">${esc(ST_LABEL[r.status])}</span></div>`).join("")}` : ""}</div></div>
      <div><h3>Recent payments</h3><div class="list">${x.recentPays.length ? x.recentPays.map((p) => `<div class="row"><button class="link" data-sr="${esc(p.request_id)}"><div class="t">${usd(p.amount)} · ${esc(p.label || "")}</div>
        <div class="s">${esc([fmtDate(p.at), p.ref, p.name, p.kind === "invoice" ? "subscription invoice" : p.kind, p.method].filter(Boolean).join(" · "))}</div></button>${p.test ? `<span class="pill mute">Test</span>` : `<span class="pill ok">Paid</span>`}</div>`).join("") : `<div class="empty">No payments yet.</div>`}</div>
        <h3 style="margin-top:14px">Orders by service</h3>${svcRows.length ? svcRows.map(([k, st]) => `<div class="bar"><span><b>${esc(SVC[k] || k)}</b> · ${Object.entries(st).map(([a, n]) => `${esc(ST_LABEL[a] || a)} ${n}`).join(" · ")}</span><i>${Object.values(st).reduce((a, b) => a + b, 0)}</i></div>`).join("") : `<div class="empty">No orders yet.</div>`}</div>
    </div></section>`;
}

// ---------------- jobs ----------------
let jobFilter = "open";
const JOB_FILTERS = [["open", "Open"], ["schedule", "Needs a date"], ["upcoming", "Scheduled"], ["unpaid", "Unpaid"], ["subs", "Subscriptions"], ["done", "Completed"], ["closed", "Cancelled / refunded"], ["all", "All"], ["test", "Tests"]];
const OPEN_ST = ["requested", "quoted", "awaiting_payment", "paid", "scheduled", "in_progress", "quote_requested"];
function jobMatch(r, f) {
  if (f === "test") return r.test; if (r.test && f !== "all") return false;
  if (f === "all") return true;
  if (f === "open") return OPEN_ST.includes(r.status) && !(r.status === "paid" && !["curb", "watch"].includes(r.service)); // a paid document order is done
  if (f === "schedule") return ["curb", "watch"].includes(r.service) && !r.appointment_at && ["requested", "paid"].includes(r.status) && r.amount != null;
  if (f === "upcoming") return !!r.appointment_at && ["scheduled", "in_progress", "paid"].includes(r.status);
  if (f === "unpaid") return ["awaiting_payment", "quoted"].includes(r.status) || (r.status === "requested" && !r.paid_at && r.amount != null);
  if (f === "subs") return r.mode === "subscription";
  if (f === "done") return ["completed", "delivered"].includes(r.status) || (r.status === "paid" && !["curb", "watch"].includes(r.service) && r.mode !== "subscription");
  if (f === "closed") return ["cancelled", "refunded"].includes(r.status);
  return true;
}
async function jobs() {
  const { rows } = await api("jobs");
  const list = rows.filter((r) => jobMatch(r, jobFilter));
  $("view").innerHTML = `<section class="card"><div class="head"><h2>Jobs &amp; service orders</h2><span class="hint">${list.length} shown · click a row to update status, schedule, assign crew, or record a payment or refund</span></div>
    <div class="chips" style="margin-bottom:12px">${JOB_FILTERS.map(([k, l]) => `<button class="chip" data-jf="${k}" aria-pressed="${jobFilter === k}">${esc(l)} <span class="hint">${rows.filter((r) => jobMatch(r, k)).length}</span></button>`).join("")}</div>
    <div class="tablewrap"><table><thead><tr><th>Ref</th><th>Customer</th><th>Service</th><th>Property</th><th>When</th><th>Crew</th><th>Price · paid</th><th>Status</th></tr></thead><tbody>
    ${list.map((r) => `<tr class="click" data-sr="${esc(r.id)}"><td><b>${esc(r.ref)}</b><div class="hint">${fmtDate(r.created_at)}${r.test ? " · TEST" : ""}</div></td>
      <td>${esc(r.name)}<div class="hint">${esc(r.phone || r.email || "")}</div></td><td>${esc(r.label)}</td><td>${esc(r.property_address || "—")}</td>
      <td>${r.appointment_at ? esc(when(r.appointment_at)) : r.answers.date1 ? `<span class="hint">asked ${fmtDate(r.answers.date1)}</span>` : "—"}</td>
      <td>${esc(r.crew || "—")}${r.crew_pay ? `<div class="hint">pay ${usd(r.crew_pay)}</div>` : ""}</td>
      <td>${r.amount != null ? usd(r.amount) + (r.mode === "subscription" ? "/mo" : "") : "quote"}<div class="hint">${r.paid_total ? "paid " + usd(r.paid_total) : "unpaid"}</div></td>
      <td><span class="pill ${ST_PILL[r.status] || ""}">${esc(ST_LABEL[r.status] || r.status)}</span></td></tr>`).join("")}</tbody></table></div>
    ${list.length ? "" : `<div class="empty">Nothing here.</div>`}</section>`;
  $("view").querySelectorAll("[data-jf]").forEach((b) => b.onclick = () => { jobFilter = b.dataset.jf; jobs(); });
}
document.addEventListener("click", (e) => { const j = e.target.closest("[data-sr]"); if (j) { e.preventDefault(); openJob(j.dataset.sr); } });

async function openJob(id) {
  const { request: r, jobs: js, payments: ps, crew, origin } = await api("job-detail/" + id);
  const a = r.answers, x = r.extra, field = ["curb", "watch"].includes(r.service);
  const paid = ps.filter((p) => p.amount > 0).reduce((t, p) => t + p.amount, 0), refunded = -ps.filter((p) => p.amount < 0).reduce((t, p) => t + p.amount, 0);
  const net = Math.round((paid - refunded) * 100) / 100, hadCard = ps.some((p) => p.amount > 0 && (p.kind === "checkout" || p.kind === "invoice" || p.method === "card"));
  const stList = field ? JOB_STATUSES.field : r.mode === "subscription" ? JOB_STATUSES.sub : JOB_STATUSES.doc;
  const statusSel = `<select name="status">${[...new Set([...stList, r.status])].filter((k) => k !== "test").map((k) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${esc(k === "paid" && !field ? "Paid" : ST_LABEL[k] || k)}</option>`).join("")}</select>`;
  const apt = r.appointment_at ? new Date(r.appointment_at) : null;
  const aptD = apt ? apt.toLocaleDateString("en-CA") : (a.date1 || ""), aptT = apt ? apt.toTimeString().slice(0, 5) : (/^Afternoon/.test(a.window || "") ? "13:00" : "09:00");
  const details = r.service === "curb" ? [CURB[r.item]?.name && CURB[r.item].name + " package", a.lot, x.overgrown && "overgrown", ...(x.addOns || []).map((k) => CURB_ADDONS[k]?.label || k)].filter(Boolean).join(" · ")
    : r.service === "watch" ? `${x.estimate?.properties || "?"} properties · ${x.estimate?.visitsPerMonth || "?"} visits/month` : r.label;
  $("dBody").innerHTML = `<div><h2 id="dTitle">${esc(r.ref)} · ${esc(r.label)}</h2><p class="hint" style="margin:4px 0 0">${esc([r.name, r.phone, r.email, r.consent ? "OK to call/text" : "Email only", r.test ? "TEST" : ""].filter(Boolean).join(" · "))}</p></div>
    <section class="card"><div class="head"><h3>Order</h3><span class="pill ${ST_PILL[r.status] || ""}">${esc(r.status === "paid" && !field ? "Paid" : ST_LABEL[r.status] || r.status)}</span></div>
      <div class="hint" style="font-size:.95rem;line-height:1.7">${r.property_address ? `<b>${esc(r.property_address)}</b><br>` : ""}${esc(details)}<br>
      ${a.date1 ? `Asked for ${esc([a.date1, a.date2].filter(Boolean).map(fmtLong).join(" or "))}${a.window ? " · " + esc(a.window) : ""}${a.access ? " · " + esc(a.access) : ""}<br>` : ""}${a.notes ? `Customer notes: ${esc(a.notes)}<br>` : ""}
      Price ${r.amount != null ? usd(r.amount) + (r.mode === "subscription" ? "/month" : "") : "not set (quote)"} · paid ${usd(paid)}${refunded ? ` · refunded ${usd(refunded)}` : ""}${r.labor_cost ? ` · crew cost ${usd(r.labor_cost)}` : x.laborGuide ? ` · payout guide ${usd(x.laborGuide)}` : ""}</div>
      <p style="margin:10px 0 0"><a class="btn small" target="_blank" rel="noopener" href="${esc(origin)}/order/${esc(r.token)}">Customer page ↗</a>
        ${r.property_address ? `<a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.property_address)}">Map ↗</a>` : ""}
        ${r.service === "curb" && ["requested", "quoted", "test"].includes(r.status) && !r.paid_at ? `<a class="btn small" href="#quotes" data-q="${esc(r.id)}">Quote / re-price</a>` : ""}</p></section>
    ${field ? `<section class="card"><div class="head"><h3>Schedule and status</h3><span class="hint">No Saturdays</span></div>
      <form id="jForm" class="grid"><label>Date<input type="date" name="d" value="${esc(aptD)}" min="${today()}"></label><label>Time<input type="time" name="t" value="${esc(aptT)}" step="900"></label>
        <label>Status${statusSel}</label>
        <label>Actual crew cost ($)<input name="labor_cost" inputmode="decimal" value="${esc(r.labor_cost ?? "")}"></label>
        <label class="wide">Office notes (not shown to the customer)<textarea name="desk_notes">${esc(r.desk_notes || "")}</textarea></label>
        <div class="wide"><button class="btn gold">Save</button> ${r.appointment_at ? `<button class="btn small" type="button" id="jClear">Clear date</button>` : ""}
          <span class="hint">Setting a date moves a paid or requested job to Scheduled. The customer's page shows the date; tell them too.</span></div></form></section>
    <section class="card"><div class="head"><h3>Crew</h3><span class="hint">${crew.length} approved or active workers</span></div>
      <div class="list">${js.map((j) => `<div class="row"><div><div class="t">${esc(j.wname || "Worker")} · ${fmtDate(j.work_date)}${j.pay != null ? " · " + usd(j.pay) : ""}</div><div class="s">${esc([j.title, j.wphone].filter(Boolean).join(" · "))}</div></div>
        <div class="acts"><span class="pill ${j.paid_at ? "ok" : j.status === "done" ? "bad" : "mute"}">${j.paid_at ? "Paid " + fmtDate(j.paid_at) : j.status === "done" ? "Done, unpaid" : esc(j.status)}</span>
        ${j.status === "scheduled" ? `<button class="btn small" data-wj="${esc(j.id)}" data-st="done">Mark done</button>` : ""}${!j.paid_at && j.status === "done" ? `<button class="btn small" data-wj="${esc(j.id)}" data-paid="1">Mark paid</button>` : ""}</div></div>`).join("") || `<p class="hint">No crew assigned.</p>`}</div>
      ${crew.length ? `<form id="cForm" class="grid" style="margin-top:10px"><label>Worker<select name="worker_id">${crew.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</select></label>
        <label>Work date<input type="date" name="work_date" value="${esc(aptD)}" min="${today()}"></label><label>Pay ($)<input name="pay" inputmode="decimal" value="${esc(x.laborGuide ?? "")}"></label>
        <div class="wide"><button class="btn">Assign</button></div></form>` : `<p class="hint">Approve workers in “Workers &amp; crews” to assign them here.</p>`}</section>`
    : `<section class="card"><div class="head"><h3>Status and notes</h3></div>
      <form id="jForm" class="grid"><label>Status${statusSel}</label>
        <label class="wide">Office notes (not shown to the customer)<textarea name="desk_notes">${esc(r.desk_notes || "")}</textarea></label>
        <div class="wide"><button class="btn gold">Save</button></div></form></section>`}
    <section class="card" id="paySec"><div class="head"><h3>Payments and refunds</h3><span class="hint">Paid ${usd(paid)}${refunded ? ` · refunded ${usd(refunded)}` : ""}</span></div>
      <div class="list">${ps.map((p) => `<div class="row"><div><div class="t">${p.amount < 0 ? `Refund ${usd(-p.amount)}` : usd(p.amount)} · ${esc(p.kind === "invoice" ? "subscription invoice" : p.kind === "checkout" ? "paid online (Stripe)" : p.kind === "refund" ? "refund" : "recorded by hand")}${p.method ? " · " + esc(p.method) : ""}</div><div class="s">${esc([fmtDate(p.at), p.note, p.by].filter(Boolean).join(" · "))}</div></div>${p.test ? `<span class="pill mute">Test</span>` : p.amount < 0 ? `<span class="pill mute">Refund</span>` : ""}</div>`).join("") || `<p class="hint">No payments yet.</p>`}</div>
      <p style="margin:10px 0 0"><button class="btn small" type="button" data-paymode="pay">Record a payment</button> ${net > 0 ? `<button class="btn small" type="button" data-paymode="refund">Record a refund</button>` : ""}</p>
      <form id="pForm" class="grid" style="margin-top:10px" hidden><label>Amount received ($)<input name="amount" inputmode="decimal" value="${r.amount != null && r.amount > paid ? esc(r.amount - paid) : ""}"></label>
        <label>Method<select name="method"><option>cash</option><option>Zelle</option><option>check</option><option>card</option><option>Cash App</option><option>other</option></select></label>
        <label>Date<input type="date" name="date" value="${today()}"></label><label class="wide">Note (optional)<input name="note" placeholder="Invoice #, check #…"></label>
        <div class="wide"><button class="btn gold">Save payment</button> <span class="hint">Online card payments through Stripe are recorded automatically; use this for cash, Zelle and checks.</span></div></form>
      <form id="rForm" class="grid" style="margin-top:10px" hidden><label>Amount refunded ($)<input name="amount" inputmode="decimal" value="${esc(net)}"></label>
        <label>How it was refunded<select name="method">${hadCard ? `<option value="card">card (refunded in Stripe)</option>` : ""}<option>cash</option><option>Zelle</option><option>check</option><option>Cash App</option><option>other</option></select></label>
        <label>Date<input type="date" name="date" value="${today()}"></label><label class="wide">Reason (optional)<input name="note" placeholder="Customer asked to cancel, duplicate order…"></label>
        <label class="wide check"><input type="checkbox" name="mark" checked> Mark this order Refunded (the customer's page says so${field ? "" : " and the document links stop working"})</label>
        <div class="wide"><button class="btn gold">Save refund</button> <span class="hint">This records the refund here. ${hadCard ? "Card payments are refunded in your Stripe dashboard (Payments → the payment → Refund); do that first or after, it doesn't matter." : ""}</span></div></form></section>`;
  $("drawer").hidden = false;
  const reopen = () => { openJob(id); if (location.hash.startsWith("#jobs")) jobs(); };
  $("jForm").onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const body = { status: f.status, desk_notes: f.desk_notes }; if ("labor_cost" in f) body.labor_cost = f.labor_cost;
    if (f.d) { if (new Date(f.d + "T12:00:00Z").getUTCDay() === 6) { toast("No Saturday work (Shabbat). Pick another day."); return; }
      body.appointment_at = new Date(`${f.d}T${f.t || "09:00"}`).toISOString(); if (f.status === r.status && ["requested", "paid", "quoted"].includes(r.status)) delete body.status; }
    try { await send("service/" + id, "PATCH", body); toast("Saved"); reopen(); } catch (er) { toast(er.message); } };
  if ($("jClear")) $("jClear").onclick = async () => { try { await send("service/" + id, "PATCH", { appointment_at: "" }); toast("Date cleared"); reopen(); } catch (er) { toast(er.message); } };
  if ($("cForm")) $("cForm").onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    if (f.work_date && new Date(f.work_date + "T12:00:00Z").getUTCDay() === 6) { toast("No Saturday work (Shabbat). Pick another day."); return; }
    try { await send("job", "POST", { ...f, service_request_id: id, title: `${r.label}, ${r.property_address || r.ref}` }); toast("Crew assigned"); reopen(); } catch (er) { toast(er.message); } };
  $("dBody").querySelectorAll("[data-paymode]").forEach((b) => b.onclick = () => {
    const refund = b.dataset.paymode === "refund"; $("pForm").hidden = refund; $("rForm").hidden = !refund;
    (refund ? $("rForm") : $("pForm")).querySelector("input[name=amount]").focus(); });
  $("pForm").onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const amt = Number(String(f.amount).replace(/[$,\s]/g, ""));
    if (!(amt > 0)) { toast("Enter the amount received."); return; }
    try { await send("payment", "POST", { ...f, amount: amt, request_id: id }); toast("Payment recorded"); reopen(); } catch (er) { toast(er.message); } };
  $("rForm").onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const amt = Number(String(f.amount).replace(/[$,\s-]/g, ""));
    if (!(amt > 0)) { toast("Enter the amount refunded."); return; }
    if (amt > net + 0.005) { toast(`That's more than the ${usd(net)} paid on this order.`); return; }
    try {
      await send("payment", "POST", { amount: -amt, method: f.method, date: f.date, note: f.note ? "Refund: " + f.note : "Refund", request_id: id });
      if (f.mark) await send("service/" + id, "PATCH", { status: "refunded" });
      toast(f.mark ? "Refund recorded, order marked Refunded" : "Refund recorded"); reopen();
    } catch (er) { toast(er.message); } };
  $("dBody").querySelectorAll("[data-wj]").forEach((b) => b.onclick = async () => {
    const body = b.dataset.paid ? { paid_at: today(), pay_method: prompt("Paid how? (cash, Zelle, check…)", "cash") || "cash" } : { status: b.dataset.st };
    try { await send("job/" + b.dataset.wj, "PATCH", body); toast("Saved"); reopen(); } catch (er) { toast(er.message); } });
  const q = $("dBody").querySelector("[data-q]"); if (q) q.onclick = (e) => { e.preventDefault(); location.hash = "quotes"; openQuote(id); };
}

// ---------------- quotes (Curb Appeal) ----------------
const CADS = [["Dallas", "https://www.dallascad.org/SearchAddr.aspx"], ["Tarrant", "https://www.tad.org/"], ["Collin", "https://www.collincad.org/"], ["Denton", "https://www.dentoncad.com/"],
  ["Rockwall", "https://www.rockwallcad.com/"], ["Kaufman", "https://www.kaufman-cad.org/"], ["Ellis", "https://www.elliscad.com/"], ["Johnson", "https://www.johnsoncad.com/"]];
const first = (n) => String(n || "").trim().split(/\s+/)[0] || "there";
const fmtLong = (s) => (s ? new Date(String(s).slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "");
function quoteState(r) {
  const [c, t] = quoteState1(r);
  return r.status === "test" || r.extra.test ? [c, "TEST · " + t] : [c, t];
}
function quoteState1(r) {
  const q = r.extra.quoteDoc;
  if (r.status === "quoted" && q) {
    if (q.expires < today()) return ["bad", "Quote expired " + fmtDate(q.expires)];
    if (q.checkout_at) return ["warn", "Customer started payment"];
    if (q.approved_at) return ["ok", "Approved, send invoice"];
    return q.sent_at ? ["mute", "Sent " + fmtDate(q.sent_at) + ", waiting"] : ["warn", "Saved, not sent yet"];
  }
  return r.amount == null ? ["bad", "Needs a quote (over 2 acres)"] : ["mute", "Booked at " + usd(r.amount) + " (check lot size)"];
}
async function quotes() {
  const { rows } = await api("quotes");
  const need = rows.filter((r) => ["requested", "test"].includes(r.status) && r.amount == null);
  const rest = rows.filter((r) => !need.includes(r));
  const tr = (r) => { const [c, t] = quoteState(r); return `<tr class="click" data-quote="${esc(r.id)}"><td><b>${esc(r.ref)}</b><div class="hint">${fmtDate(r.created_at)}</div></td>
    <td>${esc(r.name)}<div class="hint">${esc(r.phone || r.email || "")}</div></td><td>${esc(r.property_address)}</td>
    <td>${esc(CURB[r.item]?.name || r.item)}<div class="hint">${esc(r.answers.lot || "")}${r.extra.overgrown ? " · overgrown" : ""}</div></td>
    <td>${r.amount != null ? usd(r.amount) : "—"}</td><td><span class="pill ${c}">${esc(t)}</span></td></tr>`; };
  const table = (list) => `<div class="tablewrap"><table><thead><tr><th>Ref</th><th>Customer</th><th>Property</th><th>Package · lot</th><th>Price</th><th>Status</th></tr></thead><tbody>${list.map(tr).join("")}</tbody></table></div>`;
  $("view").innerHTML = `<section class="card"><div class="head"><h2>Needs a quote</h2><span class="hint">Lots over 2 acres</span></div>${need.length ? table(need) : `<div class="empty">No quote requests waiting.</div>`}</section>
    <section class="card"><div class="head"><h2>Quotes sent and unpaid bookings</h2><span class="hint">Re-quote any unpaid booking if the lot size is different</span></div>${rest.length ? table(rest) : `<div class="empty">Nothing here.</div>`}</section>`;
}
document.addEventListener("click", (e) => { const q = e.target.closest("[data-quote]"); if (q) { e.preventDefault(); openQuote(q.dataset.quote); } });

async function openQuote(id) {
  const { request: r, origin } = await api("quote/" + id);
  const a = r.answers, x = r.extra, q = x.quoteDoc;
  const orderUrl = `${origin}/order/${r.token}`;
  const acres0 = q?.acres ?? ({ "Up to 1/4 acre": 0.25, "1/4 to 1/2 acre": 0.5, "1/2 to 1 acre": 1, "1 to 2 acres": 2 }[a.lot] ?? "");
  const addr = encodeURIComponent(r.property_address || "");
  $("dBody").innerHTML = `<div><h2 id="dTitle">Quote · ${esc(r.ref)}</h2><p class="hint" style="margin:4px 0 0">${esc([r.name, r.phone, r.email, r.consent ? "OK to call/text" : "Email only"].filter(Boolean).join(" · "))}</p></div>
    <section class="card"><div class="head"><h3>Request</h3><span class="pill ${quoteState(r)[0]}">${esc(quoteState(r)[1])}</span></div>
      <div class="hint" style="font-size:.95rem;line-height:1.7"><b>${esc(r.property_address)}</b><br>${esc(CURB[r.item]?.name || r.item)} · ${esc(a.lot || "lot size not given")}${x.overgrown ? " · overgrown" : ""}${(x.addOns || []).length ? " · " + esc(x.addOns.map((k) => CURB_ADDONS[k]?.label || k).join(", ")) : ""}<br>
      Dates: ${esc([[a.date1, a.date2].filter(Boolean).map(fmtLong).join(" or "), a.window, a.occupied, a.access].filter(Boolean).join(" · "))}${a.notes ? `<br>Notes: ${esc(a.notes)}` : ""}</div>
      <p style="margin:10px 0 0"><a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${addr}">Map / satellite ↗</a>
        <a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/search?q=${addr}+appraisal+district+acres">Search lot size ↗</a>
        ${CADS.map(([c, u]) => `<a class="btn small" target="_blank" rel="noopener" href="${u}">${c} CAD ↗</a>`).join(" ")}</p></section>
    <section class="card"><div class="head"><h3>Build the quote</h3><span class="hint">Over 2 acres: $${CURB_LOT.a2.price} + $${CURB_QUOTE.perAcreOver2}/extra acre · overgrown + $${CURB_QUOTE.overgrownPerAcreOver2}/extra acre</span></div>
      <form id="qForm" class="grid">
        <label>Package<select name="package">${Object.entries(CURB).map(([k, p]) => `<option value="${k}" ${k === (r.item) ? "selected" : ""}>${esc(p.name)} ($${p.price})</option>`).join("")}</select></label>
        <label>Lot size (acres)<input name="acres" inputmode="decimal" value="${esc(acres0)}" placeholder="e.g. 3.4"></label>
        <div class="wide checks"><label><input type="checkbox" name="overgrown" ${(q ? q.overgrown : x.overgrown) ? "checked" : ""}> Overgrown (over 12 in.)</label>
          ${Object.entries(CURB_ADDONS).map(([k, ad]) => `<label><input type="checkbox" name="ao" value="${k}" ${((q ? q.addOns : x.addOns) || []).includes(k) ? "checked" : ""}> ${esc(ad.label)}</label>`).join("")}</div>
        <div class="wide"><button class="btn small" type="button" id="qSuggest">Fill in suggested prices</button> <span class="hint">You can edit any line, add your own (extra haul-off, a discount as a negative amount) or delete one.</span></div>
        <div class="wide" id="qLines"></div>
        <div class="wide"><button class="btn small" type="button" id="qAdd">+ Add a line</button></div>
        <label>Crew payout guide ($)<input name="labor_guide" inputmode="decimal" value="${esc(q?.laborGuide ?? "")}"></label>
        <label>Valid for (days)<input name="valid_days" inputmode="numeric" value="${CURB_QUOTE.validDays}"></label>
        <label class="wide">Note to the customer (optional)<textarea name="note" placeholder="e.g. Price includes mowing the back pasture; we'll leave the tree line as is.">${esc(q?.note || "")}</textarea></label>
        <div class="wide" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><b style="font-size:1.25rem">Total <span id="qTotal">$0</span></b>
          <button class="btn gold">${q ? "Save updated quote" : "Save quote"}</button></div>
      </form></section>
    <section class="card" id="qSend" ${r.status === "quoted" ? "" : "hidden"}><div class="head"><h3>Send it</h3><span class="hint" id="qSent">${q?.sent_at ? "Last sent " + esc(fmtWhen(q.sent_at)) : "Not sent yet"}</span></div>
      <p class="hint">The customer's private page shows the quote with an <b>Approve and pay</b> button (secure Stripe checkout). Paid quotes move to "Paid, confirming your date".</p>
      <p><button class="btn gold" type="button" id="qGmail">Email it from Gmail</button> <button class="btn" type="button" id="qCopy">Copy email text</button> <button class="btn" type="button" id="qLink">Copy link</button>
        <a class="btn" target="_blank" rel="noopener" href="${esc(orderUrl)}">Preview customer page ↗</a></p></section>`;
  $("drawer").hidden = false;
  const f = $("qForm");
  let lines = q ? q.lines.map((l) => ({ ...l })) : [];
  const draw = () => {
    $("qLines").innerHTML = lines.map((l, i) => `<div style="display:grid;grid-template-columns:1fr 120px 36px;gap:8px;margin-bottom:6px"><input data-i="${i}" data-k="label" value="${esc(l.label)}" aria-label="Line description">
      <input data-i="${i}" data-k="amount" inputmode="decimal" value="${esc(l.amount)}" aria-label="Amount"><button class="btn small" type="button" data-del="${i}" aria-label="Remove line">&times;</button></div>`).join("") || `<p class="hint">No lines yet. Enter the acres and click “Fill in suggested prices”.</p>`;
    $("qTotal").textContent = usd(lines.reduce((t, l) => t + (Number(l.amount) || 0), 0));
  };
  const readOpts = () => ({ pkg: f.elements.package.value, acres: f.elements.acres.value, overgrown: f.elements.overgrown.checked, addOns: [...f.querySelectorAll("[name=ao]:checked")].map((c) => c.value) });
  $("qLines").addEventListener("input", (e) => { const i = e.target.dataset.i; if (i == null) return; lines[i][e.target.dataset.k] = e.target.dataset.k === "amount" ? e.target.value.replace(/[$,\s]/g, "") : e.target.value; $("qTotal").textContent = usd(lines.reduce((t, l) => t + (Number(l.amount) || 0), 0)); });
  $("qLines").addEventListener("click", (e) => { const d = e.target.dataset.del; if (d != null) { lines.splice(+d, 1); draw(); } });
  $("qSuggest").onclick = () => { const o = readOpts(); if (!(Number(o.acres) > 0)) { toast("Enter the lot size in acres first."); f.elements.acres.focus(); return; }
    const s = curbQuoteSuggest(o); lines = s.lines.map((l) => ({ ...l })); f.elements.labor_guide.value = s.laborGuide; draw(); };
  $("qAdd").onclick = () => { lines.push({ label: "", amount: "" }); draw(); $("qLines").querySelector(`[data-i="${lines.length - 1}"]`).focus(); };
  draw();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const o = readOpts(), body = { package: o.pkg, acres: o.acres, overgrown: o.overgrown, addOns: o.addOns, lines: lines.map((l) => ({ label: l.label, amount: Number(l.amount) })),
      labor_guide: f.elements.labor_guide.value, valid_days: f.elements.valid_days.value, note: f.elements.note.value };
    if (lines.some((l) => !String(l.label).trim() || !isFinite(Number(l.amount)) || l.amount === "")) { toast("Every line needs a description and an amount."); return; }
    try { await send("quote/" + id, "POST", body); toast("Quote saved. Now send it."); openQuote(id); } catch (er) { toast(er.message); }
  };
  if (r.status !== "quoted" || !q) return;
  const subject = `Your Curb Appeal quote: ${String(r.property_address || "").split(",")[0]} (Ref ${r.ref})`;
  const text = `Hi ${first(r.name)},

Thanks for your Curb Appeal request for ${r.property_address}. Here's your quote:

${q.lines.map((l) => `- ${l.label}: ${usd(l.amount)}`).join("\n")}
Total: ${usd(q.total)}
${q.note ? "\n" + q.note + "\n" : ""}
To approve and pay securely, open your private booking page:
${orderUrl}

This quote is good through ${fmtLong(q.expires)}. Once you approve, we'll confirm your date (you asked for ${[a.date1, a.date2].filter(Boolean).map(fmtLong).join(" or ")}). We don't schedule work on Saturdays.

Questions? Call or text 214-702-1519.

Harvey Searcy
House Lot & Land Sales Co. LLC
214-702-1519`;
  const mark = async (via) => { try { await send(`quote/${id}/sent`, "POST", { via }); $("qSent").textContent = "Last sent " + fmtWhen(new Date().toISOString()); } catch (er) { toast(er.message); } };
  $("qGmail").onclick = () => {
    const u = "https://mail.google.com/mail/?authuser=houselotandland@gmail.com&view=cm&fs=1&to=" + encodeURIComponent(r.email || "") + "&su=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
    open(u, "_blank", "noopener"); mark("email"); toast("Gmail opened with the quote. Review it and click Send.");
  };
  $("qCopy").onclick = async () => { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${text}`); mark("email"); toast("Email text copied"); };
  $("qLink").onclick = async () => { await navigator.clipboard.writeText(orderUrl); toast("Link copied"); };
}

// ---------------- W-9 requests (secure third-party link; tax IDs never touch this site) ----------------
let w9Link = null, texting = false;
async function w9Section(w) {
  if (w9Link === null) { try { const st = await api("settings"); w9Link = st.w9_link || ""; texting = !!st.texting; } catch { w9Link = ""; } }
  const st = w.w9 || "not requested", pill = st === "received" ? "ok" : st === "requested" ? "warn" : "bad";
  return `<section class="card"><div class="head"><h3>W-9 (tax form)</h3><span class="pill ${pill}">${esc(st)}${w.w9_at && st !== "not requested" ? " · " + fmtDate(w.w9_at) : ""}</span></div>
    ${w9Link ? `${w.__aff ? `<p class="hint" style="margin-top:0">Required before any referral payout.</p>` : ""}<p class="hint" style="margin-top:0">Sends your secure W-9 link: <a href="${esc(w9Link)}" target="_blank" rel="noopener">${esc(w9Link.replace(/^https:\/\//, "").slice(0, 60))} ↗</a> · <button class="btn small" type="button" id="w9Change">Change link</button></p>
      <p>${w.email ? `<button class="btn gold" type="button" id="w9Mail">Email W-9 request${w.lang === "es" ? " (Spanish)" : ""}</button>` : `<span class="hint">No email on file. </span>`}
        ${w.consent ? `<button class="btn" type="button" id="w9Gw" ${texting ? "" : 'disabled title="Texting gateway not connected yet"'}>Text via phone gateway</button>` : ""}
        <button class="btn" type="button" id="w9Text">Copy text message</button>
        ${st !== "received" ? `<button class="btn" type="button" id="w9Got">Mark W-9 received</button>` : `<button class="btn small" type="button" id="w9Reset">Request again</button>`}</p>
      <p class="hint">${w.consent ? (texting ? "OK to text: “Text via phone gateway” sends it from the business phone right away." : "OK to text. The phone gateway isn't connected to the site yet; copy the message for now.") : "No text consent on file: email only."} When the worker submits, the W-9 service notifies you; check it there, then click “Mark W-9 received”.</p>`
    : `<div class="note"><b>Set up your secure W-9 link once</b>, then every worker gets it with one click.<br>
      Recommended: TaxBandits “W-9 SmartCollect Link” (workers e-sign on TaxBandits; it checks the tax ID with the IRS and carries over to your 1099-NECs). Sign in at taxbandits.com → Form W-9 → Request W-9 → SmartCollect Link → copy the link. Any other secure W-9 service link works too.</div>
      <form id="w9Set" class="grid"><label class="wide">Secure W-9 link<input name="w9_link" placeholder="https://…" autocomplete="off"></label><div class="wide"><button class="btn gold">Save link</button></div></form>`}
  </section>`;
}
function w9Message(w) {
  const first = String(w.name || "").trim().split(/\s+/)[0] || "";
  if (w.__aff) { // affiliates: same secure link, worded for a referral payout
    if (w.lang === "es") return { subject: "Formulario W-9 para su pago por referidos, House Lot & Land", text: `Hola ${first},

Gracias por referirnos clientes a House Lot & Land. Antes de enviarle un pago necesitamos su Formulario W-9. Por favor llénelo y fírmelo en este enlace seguro:
${w9Link}

Toma unos 5 minutos. No envíe su número de Seguro Social ni su número de identificación fiscal por correo electrónico ni por mensaje de texto; escríbalo solo en el formulario seguro.

¿Preguntas? Llame o envíe un mensaje al 214-702-1519.

Harvey Searcy
House Lot & Land Sales Co. LLC
214-702-1519`, sms: `House Lot & Land: Hola ${first}, para recibir su pago de referidos complete su W-9 (formulario seguro, 5 min): ${w9Link} No envíe su número de Seguro Social por texto. Preguntas: 214-702-1519` };
    return { subject: "W-9 for your House Lot & Land referral payout", text: `Hi ${first},

Thanks for referring sellers to House Lot & Land. Before we can send you a payout we need your Form W-9. Please fill it out and sign it through this secure link:
${w9Link}

It takes about 5 minutes. Please don't send your Social Security or tax ID number by email or text; enter it only on the secure form.

Questions? Call or text 214-702-1519.

Harvey Searcy
House Lot & Land Sales Co. LLC
214-702-1519`, sms: `House Lot & Land: Hi ${first}, to receive your referral payout please complete your W-9 (secure form, about 5 min): ${w9Link} Please don't text your SSN. Questions: 214-702-1519` };
  }
  if (w.lang === "es") return { subject: "Formulario W-9 para House Lot & Land Sales Co. LLC", text: `Hola ${first},

Gracias por su interés en trabajar con House Lot & Land. Antes de su primer trabajo necesitamos su Formulario W-9 (requerido para contratistas independientes). Por favor llénelo y fírmelo en este enlace seguro:
${w9Link}

Toma unos 5 minutos. No envíe su número de Seguro Social ni su número de identificación fiscal por correo electrónico ni por mensaje de texto; escríbalo solo en el formulario seguro.

¿Preguntas? Llame o envíe un mensaje al 214-702-1519.

Harvey Searcy
House Lot & Land Sales Co. LLC
214-702-1519`, sms: `House Lot & Land: Hola ${first}, por favor complete su W-9 antes de su primer trabajo (formulario seguro, 5 min): ${w9Link} No envíe su número de Seguro Social por texto. Preguntas: 214-702-1519` };
  return { subject: "W-9 for House Lot & Land Sales Co. LLC", text: `Hi ${first},

Thanks for your interest in working with House Lot & Land. Before your first job we need your Form W-9 (required for independent contractors). Please fill it out and sign it through this secure link:
${w9Link}

It takes about 5 minutes. Please don't send your Social Security or tax ID number by email or text; enter it only on the secure form.

Questions? Call or text 214-702-1519.

Harvey Searcy
House Lot & Land Sales Co. LLC
214-702-1519`, sms: `House Lot & Land: Hi ${first}, please complete your W-9 before your first job (secure form, about 5 min): ${w9Link} Please don't text your SSN. Questions: 214-702-1519` };
}
function wireW9(w, refresh) {
  const mark = async (v, msg) => { try { await send((w.__aff ? "aff/affiliate/" : "worker/") + w.id, "PATCH", { w9: v }); toast(msg); refresh(); } catch (er) { toast(er.message); } };
  const f = $("w9Set");
  if (f) f.onsubmit = async (e) => { e.preventDefault(); try { await send("settings", "PUT", { w9_link: e.target.w9_link.value.trim() }); w9Link = e.target.w9_link.value.trim(); toast("W-9 link saved"); refresh(); } catch (er) { toast(er.message); } };
  const ch = $("w9Change"); if (ch) ch.onclick = () => { w9Link = ""; refresh(); };
  const m = $("w9Mail"); if (m) m.onclick = () => { const x = w9Message(w);
    open("https://mail.google.com/mail/?authuser=houselotandland@gmail.com&view=cm&fs=1&to=" + encodeURIComponent(w.email) + "&su=" + encodeURIComponent(x.subject) + "&body=" + encodeURIComponent(x.text), "_blank", "noopener");
    if (w.w9 !== "received") mark("requested", "Gmail opened. Review and click Send. Marked W-9 requested."); };
  const tx = $("w9Text"); if (tx) tx.onclick = async () => { await navigator.clipboard.writeText(w9Message(w).sms); if (w.w9 !== "received") mark("requested", "Text copied. Marked W-9 requested."); else toast("Text copied"); };
  const gw = $("w9Gw"); if (gw) gw.onclick = async () => { gw.disabled = true; try { const r = await send("text", "POST", { template: "w9_request", id: w.id, kind: w.__aff ? "affiliate" : undefined }); toast(r.message); refresh(); } catch (er) { toast(er.message); gw.disabled = false; } };
  const got = $("w9Got"); if (got) got.onclick = () => mark("received", "W-9 marked received");
  const rs = $("w9Reset"); if (rs) rs.onclick = () => mark("not requested", "Reset. Send the request again.");
}


// ---------------- affiliates (private referral partners, $2,500 per closed deal; src/affiliates.js) ----------------
let affFilter = "";
const RF_PILL = { open: "", closed: "bad", paid: "ok", void: "mute" };
const RF_LABEL = { open: "Open", closed: "Closed, unpaid", paid: "Paid", void: "Void" };
const rfWho = (r) => r.aff_name || (r.other_name ? `${r.other_name} (not an affiliate)` : "—");
function affForm(a) {
  a = a || { status: "active", on_site: 1, lang: "en" };
  return `<form id="affForm" class="grid">
    <label>Name<input name="name" value="${esc(a.name || "")}" required placeholder="First and last name"></label><label>Phone<input name="phone" value="${esc(a.phone || "")}"></label>
    <label>Email<input name="email" value="${esc(a.email || "")}"></label><label>City<input name="city" value="${esc(a.city || "")}"></label>
    <label>Company (optional)<input name="company" value="${esc(a.company || "")}"></label>
    ${a.id ? `<label>Status<select name="status">${["active", "inactive"].map((x) => `<option ${x === a.status ? "selected" : ""}>${x}</option>`).join("")}</select></label>` : ""}
    <label>Language<select name="lang"><option value="en" ${a.lang !== "es" ? "selected" : ""}>English</option><option value="es" ${a.lang === "es" ? "selected" : ""}>Spanish</option></select></label>
    <label>Pay method<input name="pay_method" value="${esc(a.pay_method || "")}" placeholder="Zelle to 214-…"></label>
    <label>Agreement signed<input type="date" name="agreement_at" value="${esc((a.agreement_at || "").slice(0, 10))}"></label>
    <label class="wide" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="on_site" ${a.on_site ? "checked" : ""} style="width:auto"> Show this name in the “Who referred you?” list on the homepage</label>
    <label class="wide" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="licensed" ${a.licensed ? "checked" : ""} style="width:auto"> Licensed real estate agent (pay the fee to their sponsoring broker)</label>
    <label class="wide">Sponsoring broker (licensed agents only)<input name="broker" value="${esc(a.broker || "")}"></label>
    ${a.id ? "" : `<label class="wide" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="consent" style="width:auto"> They agreed that House Lot &amp; Land may call or text them</label>`}
    <label class="wide">Notes<textarea name="notes">${esc(a.notes || "")}</textarea></label>
    <div class="wide"><button class="btn gold">${a.id ? "Save affiliate" : "Add affiliate"}</button></div></form>`;
}
const readAff = (f) => { const o = Object.fromEntries(new FormData(f)); for (const k of ["on_site", "licensed", "consent"]) if (f.elements[k]) o[k] = f.elements[k].checked; return o; };
async function affiliates() {
  const s = await api("aff/summary" + (affFilter ? "?status=" + affFilter : ""));
  const owed = s.affiliates.reduce((a, x) => a + (x.owed || 0), 0);
  const opts = s.affiliates.filter((a) => a.status === "active").map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
  $("view").innerHTML = `<section class="card"><div class="head"><h2>Affiliates</h2><div class="acts"><button class="btn small gold" id="newAff">Add an affiliate</button></div></div>
    <p class="hint" style="margin-top:0">Private referral partners (not advertised). ${usd(s.payout)} per deal we close from their referral. Active affiliates marked “show” appear in the “Who referred you?” list at the end of the homepage cash-offer form. Get a W-9 before paying.${owed ? ` <b style="color:var(--bad)">Owed now: ${usd(owed)}</b>` : ""}</p>
    <div id="affNew"></div>
    <div class="list">${s.affiliates.map((a) => `<div class="row"><button class="link" data-aff="${esc(a.id)}"><div class="t">${esc(a.name)} <span class="pill ${a.status === "active" ? "ok" : "mute"}">${esc(a.status)}</span>${a.on_site ? "" : ` <span class="pill mute">hidden from site</span>`}${a.licensed ? ` <span class="pill">Licensed</span>` : ""}</div>
      <div class="s">${esc([a.ref, a.company, a.city, a.phone, a.email].filter(Boolean).join(" · "))}</div></button>
      <div class="s" style="text-align:right">${a.refs} referrals · ${a.closed} closed${a.owed ? `<br><b style="color:var(--bad)">Owed ${usd(a.owed)}</b>` : ""}${a.paid_ytd ? `<br>Paid ${usd(a.paid_ytd)} this year` : ""}<br>W-9: ${esc(a.w9)}</div></div>`).join("") || `<div class="empty">No affiliates yet. Add your first one above.</div>`}</div></section>
    <section class="card"><div class="head"><h2>Referrals</h2><button class="btn small" id="newRf">Add a referral by hand</button></div>
    <div id="rfNew"></div>
    <div class="chips" style="margin-bottom:12px">${["", "open", "closed", "paid", "void", "other"].map((x) => `<button class="chip" data-rff="${x}" aria-pressed="${affFilter === x}">${x === "other" ? "Non-affiliate" : x ? RF_LABEL[x] : "All"}</button>`).join("")}</div>
    <div class="tablewrap"><table><thead><tr><th>Referral</th><th>Property</th><th>Seller</th><th>Referred by</th><th>Deal</th><th>Status</th></tr></thead><tbody>
    ${s.referrals.map((r) => `<tr class="click" data-rf="${esc(r.id)}"><td><b>${esc(r.ref)}</b><div class="hint">${fmtDate(r.created_at)}${r.lead_ref ? " · " + esc(r.lead_ref) : ""}</div></td>
      <td>${esc(r.property_address || "")}</td><td>${esc(r.seller_name || "")}<div class="hint">${esc(r.seller_phone || "")}</div></td>
      <td>${esc(rfWho(r))}</td><td>${(r.deals || []).map((d) => `${esc(TRACKS[d.track]?.label || d.track)}: ${esc(d.stage)}`).join("<br>") || `<span class="hint">Not in master list yet</span>`}</td>
      <td><span class="pill ${RF_PILL[r.status]}">${RF_LABEL[r.status]}</span>${r.status === "closed" && r.payout ? `<div class="hint" style="color:var(--bad)">Owe ${usd(r.payout)}</div>` : ""}</td></tr>`).join("")
      || `<tr><td colspan="6"><div class="empty">No referrals here yet.</div></td></tr>`}</tbody></table></div></section>`;
  $("view").querySelectorAll("[data-rff]").forEach((b) => b.onclick = () => { affFilter = b.dataset.rff; affiliates(); });
  $("newAff").onclick = () => { $("affNew").innerHTML = `<section class="card" style="margin:0 0 12px">${affForm(null)}</section>`; $("newAff").disabled = true;
    $("affForm").onsubmit = async (e) => { e.preventDefault(); try { const r = await send("aff/affiliate", "POST", readAff(e.target)); toast("Affiliate added"); await affiliates(); openAffiliate(r.id); } catch (er) { toast(er.message); } }; };
  $("newRf").onclick = () => { $("rfNew").innerHTML = `<form id="rfForm" class="grid card" style="margin:0 0 12px">
      <label>Referred by<select name="affiliate_id"><option value="">Other (type a name)</option>${opts}</select></label><label>Other referrer's name<input name="other_name"></label>
      <label class="wide">Property address<input name="property_address" required placeholder="Street, city, TX ZIP"></label>
      <label>Seller name<input name="seller_name"></label><label>Seller phone<input name="seller_phone"></label>
      <label class="wide">Notes<input name="notes"></label><div class="wide"><button class="btn gold">Save referral</button></div></form>`; $("newRf").disabled = true;
    $("rfForm").onsubmit = async (e) => { e.preventDefault(); try { const r = await send("aff/referral", "POST", Object.fromEntries(new FormData(e.target))); toast("Referral saved"); await affiliates(); openReferral(r.id); } catch (er) { toast(er.message); } }; };
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-aff]"); if (a) { e.preventDefault(); openAffiliate(a.dataset.aff); }
  const r = e.target.closest("[data-rf]"); if (r) { e.preventDefault(); openReferral(r.dataset.rf); }
});
const affRefresh = () => { if (location.hash.startsWith("#affiliates")) affiliates(); };
async function openReferral(id) {
  const { referral: r, lead, deals, affiliates: affs } = await api("aff/referral/" + id);
  const act = async (action, body, msg) => { try { await send(`aff/referral/${id}/${action}`, "POST", body); toast(msg); openReferral(id); affRefresh(); } catch (er) { toast(er.message); } };
  const g = (k, v) => v ? `<div><span class="hint">${k}</span><br>${v}</div>` : "";
  $("dBody").innerHTML = `<div><h2 id="dTitle">${esc(r.property_address || "Referral")}</h2><p class="hint" style="margin:4px 0 0">${esc(r.ref)} · ${esc(r.source === "office" ? "added by hand" : "from the website form")} ${esc(fmtWhen(r.created_at))} <span class="pill ${RF_PILL[r.status]}">${RF_LABEL[r.status]}</span></p></div>
    ${r.status === "void" ? `<div class="note">Void: ${esc(r.void_reason || "")}</div>` : ""}
    <section class="card"><div class="head"><h3>Seller</h3>${r.property_id ? `<button class="btn small" data-prop="${esc(r.property_id)}">Open property</button>` : ""}</div>
      <div class="grid">${g("Name", esc(r.seller_name || lead?.name || ""))}${g("Phone", esc(r.seller_phone || lead?.phone || ""))}${g("Email", esc(lead?.email || ""))}
        ${g("Lead", lead ? `${esc(lead.ref)} · ${esc(lead.status)}` : "")}${g("Timeline", esc(lead?.timeline || ""))}${g("Type", esc(lead?.property_type || ""))}
        ${lead?.details ? `<div class="wide"><span class="hint">Details</span><br>${esc(lead.details)}</div>` : ""}</div>
      <p class="hint">${deals.length ? "In the master list: " + deals.map((d) => `${esc(TRACKS[d.track]?.label || d.track)} (${esc(d.stage)})`).join(", ") : "Not matched to the master list yet (it appears once the lead reaches the Deal Desk, or add the property)."}</p></section>
    <section class="card"><div class="head"><h3>Referred by</h3>${r.affiliate_id ? `<button class="btn small" data-aff="${esc(r.affiliate_id)}">Open affiliate</button>` : ""}</div>
      <p style="margin-top:0"><b>${esc(rfWho(r))}</b>${r.affiliate_id ? ` · ${esc(r.aff_ref)} · W-9: <b>${esc(r.aff_w9)}</b>${r.aff_licensed ? ` · Licensed: pay broker ${esc(r.aff_broker || "?")}` : ""}` : ""}</p>
      ${r.status !== "paid" ? `<form id="rfAssign" class="grid"><label>Change to<select name="affiliate_id"><option value="">Other (type a name)</option>${affs.map((a) => `<option value="${esc(a.id)}" ${a.id === r.affiliate_id ? "selected" : ""}>${esc(a.name)}${a.status !== "active" ? " (inactive)" : ""}</option>`).join("")}</select></label>
        <label>Other name<input name="other_name" value="${esc(r.other_name || "")}"></label><div class="wide"><button class="btn small">Update referrer</button></div></form>` : ""}</section>
    <section class="card"><div class="head"><h3>Payout</h3><span class="hint">${r.affiliate_id ? usd(r.payout) : "Non-affiliate: no payout"}</span></div>
      ${r.status === "open" ? `<form id="rfClosed" class="grid"><label>Deal closed on<input type="date" name="date" value="${today()}" max="${today()}"></label><div class="wide"><button class="btn gold">Deal closed${r.affiliate_id ? `: ${usd(r.payout)} now owed` : ""}</button></div></form>
        <form id="rfVoid" class="grid" style="margin-top:12px"><label class="wide">Void (no deal, duplicate, wrong referrer…)<input name="reason" placeholder="Reason"></label><div class="wide"><button class="btn small">Void referral</button></div></form>` : ""}
      ${r.status === "closed" ? `<p>Closed ${esc(fmtDate(r.closed_on))}.${r.affiliate_id && r.aff_w9 !== "received" ? ` <b style="color:var(--bad)">W-9 not received yet.</b>` : ""}</p>
        ${r.affiliate_id ? `<form id="rfPaid" class="grid"><label>Paid on<input type="date" name="date" value="${today()}" max="${today()}"></label><label>How<select name="method"><option>Zelle</option><option>Check</option><option>Cash</option><option>Wire</option><option>Other</option></select></label>
          <label>Amount ($)<input name="amount" value="${esc(r.payout)}" inputmode="decimal"></label><label class="wide">Note (check number, confirmation…)<input name="note"></label><div class="wide"><button class="btn gold">Record payout</button></div></form>` : ""}
        <p><button class="btn small" id="rfReopen">Reopen</button></p>` : ""}
      ${r.status === "paid" ? `<p>Paid ${usd(r.payout)} by ${esc(r.pay_method)} on ${esc(fmtDate(r.paid_on))}${r.pay_note ? " · " + esc(r.pay_note) : ""}.</p>` : ""}
      ${r.status === "void" ? `<button class="btn" id="rfReopen">Reopen</button>` : ""}</section>
    <section class="card"><form id="rfNotes"><label>Notes<textarea name="note">${esc(r.notes || "")}</textarea></label><button class="btn small" style="margin-top:6px">Save notes</button></form></section>`;
  $("drawer").hidden = false;
  const on = (fid, fn) => { const f = $(fid); if (f) f.onsubmit = (e) => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))); }; };
  on("rfAssign", (f) => act("assign", f, "Referrer updated"));
  on("rfClosed", (f) => act("closed", f, "Marked closed"));
  on("rfVoid", (f) => act("void", f, "Voided"));
  on("rfPaid", (f) => { if (r.aff_w9 !== "received" && !confirm("No W-9 on file for this affiliate. Record the payout anyway?")) return; act("paid", f, "Payout recorded"); });
  on("rfNotes", (f) => act("notes", f, "Notes saved"));
  const ro = $("rfReopen"); if (ro) ro.onclick = () => act("reopen", {}, "Reopened");
}
async function openAffiliate(id) {
  const { affiliate: a, referrals } = await api("aff/affiliate/" + id);
  $("dBody").innerHTML = `<div><h2 id="dTitle">${esc(a.name)}</h2><p class="hint" style="margin:4px 0 0">${esc([a.ref, "added " + fmtDate(a.created_at), a.consent ? "OK to text" : "No text consent"].filter(Boolean).join(" · "))}</p></div>
    <section class="card">${affForm(a)}</section>
    ${await w9Section({ ...a, __aff: true })}
    <section class="card"><div class="head"><h3>Referrals</h3><span class="hint">${referrals.length}</span></div>
      <div class="list">${referrals.map((r) => `<div class="row"><button class="link" data-rf="${esc(r.id)}"><div class="t">${esc(r.property_address || "")}</div><div class="s">${esc(r.ref)} · ${fmtDate(r.created_at)} · ${esc(r.seller_name || "")}</div></button>
        <span class="pill ${RF_PILL[r.status]}">${RF_LABEL[r.status]}${r.status === "closed" ? " · " + usd(r.payout) : ""}</span></div>`).join("") || `<p class="hint">No referrals yet.</p>`}</div></section>`;
  $("drawer").hidden = false;
  $("affForm").onsubmit = async (e) => { e.preventDefault(); try { await send("aff/affiliate/" + id, "PATCH", readAff(e.target)); toast("Saved"); openAffiliate(id); affRefresh(); } catch (er) { toast(er.message); } };
  wireW9({ ...a, __aff: true }, () => { openAffiliate(id); affRefresh(); });
}

// ---------------- links ----------------
async function links() {
  $("view").innerHTML = LINKS.map(([h, items]) => `<section class="card"><div class="head"><h2>${esc(h)}</h2></div><div class="links">${items.map(([n, u, d]) =>
    `<a class="linkcard" href="${esc(u)}" ${/^https?:/.test(u) ? 'target="_blank" rel="noopener"' : ""}><b>${esc(n)}${/^https?:/.test(u) ? " ↗" : ""}</b><span>${esc(d)}</span></a>`).join("")}</div></section>`).join("");
}

route();
setInterval(shabbatBanner, 60000);
