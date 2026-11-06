// Back office app (served only behind Cloudflare Access; data from /api/office/*).
import { TRACKS, CLOSED_STAGES } from "/js/hub-keys.js";
import { shabbatStatus, fmtTime } from "/js/shabbat.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usd = (n) => (n == null || n === "" || !isFinite(n) ? "—" : "$" + Math.round(Number(n)).toLocaleString());
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const addDays = (n) => { const d = new Date(today() + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = (s) => (s ? new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
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
const TYPES = ["Single-family", "Duplex to fourplex", "Apartment complex", "RV park", "Mobile home park", "Land", "Commercial", "Other"];

// ---------------- Shabbat ----------------
function shabbatBanner() {
  const st = shabbatStatus(), b = $("shabbat");
  b.hidden = !st.closed;
  if (st.closed) b.textContent = `Closed for Shabbat. You can look things up, but changes are paused until ${fmtTime(st.opensAt)}.`;
  document.body.classList.toggle("closed", st.closed);
  return st.closed;
}

// ---------------- router ----------------
const VIEWS = { overview, deals, add, workers, links };
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
      <a class="kpi" href="#workers"><b>${wk.applied || 0}</b><span>Worker applications to review</span></a>
      <a class="kpi" href="#workers"><b>${(wk.active || 0) + (wk.approved || 0)}</b><span>Approved and active workers</span></a>
      <a class="kpi" href="https://claude.ai/artifact/5MAcErFcTQZoe6VCGzbjHs" target="_blank" rel="noopener"><b>${s.openSvc}</b><span>Open service orders ↗</span></a>
    </section>
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
async function deals() {
  const p = new URLSearchParams(Object.entries(dealFilter).filter(([, v]) => v));
  const { rows } = await api("deals?" + p);
  const tr = TRACKS[dealFilter.track];
  $("view").innerHTML = `<section class="card">
    <div class="head"><h2>Deals</h2><span class="hint">${rows.length} shown${dealFilter.q ? ` for “${esc(dealFilter.q)}”` : ""}</span></div>
    <div class="chips" style="margin-bottom:8px">${[["", "All tracks"], ...Object.entries(TRACKS).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button class="chip" data-t="${k}" aria-pressed="${dealFilter.track === k}">${esc(l)}</button>`).join("")}
      <button class="chip" data-open aria-pressed="${dealFilter.open === "1"}">Open only</button></div>
    ${tr ? `<div class="chips" style="margin-bottom:12px">${["", ...tr.stages].map((st) => `<button class="chip" data-st="${esc(st)}" aria-pressed="${dealFilter.stage === st}">${esc(st || "Any stage")}</button>`).join("")}</div>` : ""}
    <div class="tablewrap"><table><thead><tr><th>Property</th><th>Track · stage</th><th>Owner</th><th>Also on</th><th>Asking / value</th><th>Next touch</th></tr></thead>
    <tbody>${rows.map((d) => `<tr class="click" data-prop="${esc(d.property_id)}"><td><b>${esc(label(d))}</b><div class="hint">${esc([d.prop_type, d.city, d.county && d.county + " Co."].filter(Boolean).join(" · "))}</div></td>
      <td><span class="pill">${esc(TRACKS[d.track]?.label)}</span> ${esc(d.stage)}${d.ref ? `<div class="hint">${esc(d.ref)}</div>` : ""}</td>
      <td>${esc(d.cname || "—")}${d.cphone ? `<div class="hint">${esc(d.cphone)}</div>` : ""}${d.opt_out ? ` <span class="pill bad">Do not contact</span>` : d.litigator ? ` <span class="pill bad">Mail only</span>` : ""}</td>
      <td>${(d.tracks || "").split(",").filter((t) => t && t !== d.track).map((t) => `<span class="pill mute">${esc(TRACKS[t]?.label || t)}</span>`).join(" ") || "—"}</td>
      <td>${d.asking ? usd(d.asking) : "—"}${d.value ? `<div class="hint">value ${usd(d.value)}</div>` : ""}</td>
      <td>${d.next_touch ? `<span class="pill ${!CLOSED_STAGES.has(d.stage) && d.next_touch < today() ? "bad" : "mute"}">${fmtDate(d.next_touch)}</span>` : "—"}</td></tr>`).join("")}</tbody></table></div>
    ${rows.length ? "" : `<div class="empty">No deals match. Try “All tracks”, turn off “Open only”, or add a property.</div>`}</section>`;
  $("view").querySelectorAll("[data-t]").forEach((b) => b.onclick = () => { dealFilter.track = b.dataset.t; dealFilter.stage = ""; deals(); });
  $("view").querySelectorAll("[data-st]").forEach((b) => b.onclick = () => { dealFilter.stage = b.dataset.st; deals(); });
  $("view").querySelector("[data-open]").onclick = () => { dealFilter.open = dealFilter.open ? "" : "1"; deals(); };
}

// ---------------- property drawer ----------------
document.addEventListener("click", (e) => {
  const p = e.target.closest("[data-prop]"); if (p) { e.preventDefault(); openProperty(p.dataset.prop); }
  const w = e.target.closest("[data-worker]"); if (w) { e.preventDefault(); openWorker(w.dataset.worker); }
});
$("dClose").onclick = () => ($("drawer").hidden = true);
$("drawer").addEventListener("click", (e) => { if (e.target.id === "drawer") $("drawer").hidden = true; });
addEventListener("keydown", (e) => { if (e.key === "Escape") $("drawer").hidden = true; });

async function openProperty(id) {
  const { property: p, deals: ds, contacts, activities } = await api("property/" + id);
  const missing = Object.keys(TRACKS).filter((k) => !ds.some((d) => d.track === k));
  $("dBody").innerHTML = `
    <div><h2 id="dTitle">${esc(label(p))}</h2><p class="hint" style="margin:4px 0 0">${esc([p.name && p.address ? p.name : "", p.city, p.zip, p.county && p.county + " County", p.prop_type].filter(Boolean).join(" · "))}</p></div>
    <section class="card"><div class="head"><h3>Tracks</h3><span class="hint">One deal per track</span></div>
      <div style="display:grid;gap:10px">${ds.map(dealCard).join("") || `<p class="hint">Not on any track yet.</p>`}</div>
      ${missing.length ? `<div class="acts" style="margin-top:10px"><span class="hint">Add to:</span>${missing.map((k) => `<button class="btn small" data-addtrack="${k}">${esc(TRACKS[k].label)}</button>`).join("")}</div>` : ""}</section>
    <section class="card"><div class="head"><h3>Owners and contacts</h3></div>
      <div class="list">${contacts.map((c) => `<div class="row"><div><div class="t">${esc(c.name || "Unnamed")} <span class="pill mute">${esc(c.role)}</span></div>
        <div class="s">${esc([c.phone, c.email, c.lang === "es" ? "Spanish" : ""].filter(Boolean).join(" · ") || "No phone or email")}${c.mailing ? "<br>Mail: " + esc(c.mailing) : ""}</div></div>
        <div class="acts">${c.opt_out ? `<span class="pill bad">Do not contact</span>` : c.consent ? `<span class="pill ok">Consent on file</span>` : `<span class="pill mute">No consent</span>`}${c.litigator ? ` <span class="pill bad">TCPA litigator: mail only</span>` : ""}
          <button class="btn small" data-dnc="${esc(c.id)}" data-v="${c.opt_out ? 0 : 1}">${c.opt_out ? "Allow contact" : "Do not contact"}</button></div></div>`).join("") || `<p class="hint">No contact yet.</p>`}</div>
      <details style="margin-top:10px"><summary class="hint" style="cursor:pointer">Add a contact</summary>
        <form id="addContact" class="grid" style="margin-top:10px"><label>Name<input name="name"></label><label>Phone<input name="phone" inputmode="tel"></label><label>Email<input name="email" type="email"></label>
        <label>Role<select name="role"><option>owner</option><option>co-owner</option><option>heir</option><option>executor</option><option>spouse</option><option>broker</option><option>agent</option><option>tenant</option><option>other</option></select></label>
        <div class="wide"><button class="btn gold">Add contact</button></div></form></details></section>
    <section class="card"><div class="head"><h3>Property details</h3></div>
      <form id="propForm" class="grid">
        ${[["name", "Name (parks, complexes)"], ["address", "Street address"], ["city", "City"], ["zip", "ZIP"], ["county", "County"]].map(([k, l]) => `<label>${l}<input name="${k}" value="${esc(p[k] ?? "")}"></label>`).join("")}
        <label>Type<select name="prop_type">${["", ...TYPES].map((t) => `<option ${p.prop_type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
        ${[["units", "Units / sites"], ["beds", "Beds"], ["baths", "Baths"], ["sqft", "Sq ft"], ["acres", "Acres"]].map(([k, l]) => `<label>${l}<input name="${k}" inputmode="decimal" value="${esc(p[k] ?? "")}"></label>`).join("")}
        <div class="wide"><button class="btn">Save details</button></div></form></section>
    <section class="card"><div class="head"><h3>History</h3></div>
      <form id="logForm" class="grid"><label>Type<select name="kind"><option value="call">Call</option><option value="text">Text</option><option value="email">Email</option><option value="mail">Mail</option><option value="visit">Visit</option><option value="note" selected>Note</option></select></label>
        <label>Deal<select name="deal_id"><option value="">Property (all tracks)</option>${ds.map((d) => `<option value="${esc(d.id)}">${esc(TRACKS[d.track].label)}</option>`).join("")}</select></label>
        <label>Next touch<input name="next_touch" type="date" value="${addDays(3)}"></label>
        <label class="wide">What happened<textarea name="summary" required></textarea></label><div class="wide"><button class="btn gold">Log it</button></div></form>
      <div class="log" style="margin-top:12px">${activities.map((a) => `<div><time>${esc(fmtWhen(a.at))}</time><span class="pill mute">${esc(a.kind)}</span> ${esc(a.summary)}${a.by ? ` <span class="hint">· ${esc(a.by)}</span>` : ""}</div>`).join("") || `<div class="hint">Nothing logged yet.</div>`}</div></section>`;
  $("drawer").hidden = false;
  const body = $("dBody");
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
  $("addContact").onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    try { const r = await send("contact", "POST", { ...fd, property_id: id }); toast(r.merged ? "Matched an existing contact and linked it" : "Contact added"); openProperty(id); } catch (er) { toast(er.message); } };
  $("propForm").onsubmit = async (e) => { e.preventDefault();
    try { await send("property/" + id, "PATCH", Object.fromEntries(new FormData(e.target))); toast("Saved"); openProperty(id); }
    catch (er) { toast(er.message); if (er.data && er.data.existing) openProperty(er.data.existing); } };
  $("logForm").onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    try { await send("activity", "POST", { ...fd, property_id: id, deal_id: fd.deal_id || null, contact_id: contacts[0] && contacts[0].id }); toast("Logged"); openProperty(id); } catch (er) { toast(er.message); } };
}
function dealCard(d) {
  const tr = TRACKS[d.track];
  return `<form class="deal" data-deal="${esc(d.id)}"><div class="acts" style="justify-content:space-between"><b>${esc(tr.label)}</b>
      <span class="hint">${esc([d.ref, d.source].filter(Boolean).join(" · "))}</span></div>
    <div class="grid"><label>Stage<select name="stage">${tr.stages.map((s) => `<option ${s === d.stage ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label>Next touch<input type="date" name="next_touch" value="${esc(d.next_touch || "")}"></label>
      <label>Asking ($)<input name="asking" inputmode="decimal" value="${esc(d.asking ?? "")}"></label><label>Value / ARV ($)<input name="value" inputmode="decimal" value="${esc(d.value ?? "")}"></label>
      <label class="wide">Notes<textarea name="notes">${esc(d.notes || "")}</textarea></label></div>
    <div class="acts"><button class="btn small gold">Save</button>${dashLink(d)}</div></form>`;
}
function dashLink(d) {
  const L = { wholesale: LINKS[0][1][0], subto: LINKS[0][1][1], creative: LINKS[0][1][2] }[d.track];
  return L ? `<a class="btn small" href="${L[1]}" target="_blank" rel="noopener">Open ${esc(L[0])} ↗</a>` : "";
}

// ---------------- add property ----------------
async function add() {
  $("view").innerHTML = `<section class="card"><div class="head"><h2>Add a property</h2><span class="hint">If the address or owner is already on file, it's matched instead of duplicated.</span></div>
    <form id="addForm" class="grid">
      <label class="wide">Street address<input name="address" placeholder="1234 Pecan Dr" autocomplete="off"></label>
      <label>Name (for parks or complexes)<input name="name"></label><label>City<input name="city"></label><label>ZIP<input name="zip" inputmode="numeric"></label><label>County<input name="county"></label>
      <label>Type<select name="prop_type">${TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label><label>Units / sites<input name="units" inputmode="numeric"></label>
      <label>Owner name<input name="cname"></label><label>Owner phone<input name="cphone" inputmode="tel"></label><label>Owner email<input name="cemail" type="email"></label>
      <label>Track<select name="track">${Object.entries(TRACKS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</select></label>
      <label>Source<input name="source" placeholder="Driving for dollars, referral…"></label>
      <label class="wide">Notes<textarea name="notes"></textarea></label>
      <div class="wide"><button class="btn gold">Add property</button></div></form><p id="addMsg" class="hint"></p></section>`;
  $("addForm").onsubmit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try {
      const r = await send("property", "POST", { property: { address: f.address, name: f.name, city: f.city, zip: f.zip, county: f.county, prop_type: f.prop_type, units: f.units },
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
    <p class="hint" style="margin-top:0">Independent contractors only for now. Ask for W-9s through a secure method (not email or this site); 1099-NEC is generally required once you pay someone $2,000 or more in 2026. Check with your CPA.</p>
    <div class="chips" style="margin-bottom:12px">${["", ...W_STATUS].map((s) => `<button class="chip" data-ws="${s}" aria-pressed="${wFilter === s}">${esc(s ? s[0].toUpperCase() + s.slice(1) : "All")}</button>`).join("")}</div>
    <div class="list">${rows.map((w) => `<div class="row"><button class="link" data-worker="${esc(w.id)}"><div class="t">${esc(w.name)} <span class="pill ${W_PILL[w.status]}">${esc(w.status)}</span></div>
      <div class="s">${esc([w.ref, w.kind === "crew" ? "Crew" : "Contractor", w.city, w.phone].filter(Boolean).join(" · "))}<br>${esc((w.trades || []).join(", "))}</div></button>
      <div class="s" style="text-align:right">${w.jobs} jobs${w.owed ? `<br><b style="color:var(--bad)">Owed ${usd(w.owed)}</b>` : ""}${w.paid_ytd ? `<br>Paid ${usd(w.paid_ytd)} this year` : ""}<br>W-9: ${esc(w.w9)}</div></div>`).join("") || `<div class="empty">No workers yet. Share the apply page or add one.</div>`}</div></section>`;
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
    <section class="card"><div class="head"><h3>Jobs and pay</h3><span class="hint">No Saturday dates</span></div>
      <form id="jobForm" class="grid"><label class="wide">Service order<select name="service_request_id"><option value="">Other job (type a title)</option>${svc.map((s) => `<option value="${esc(s.id)}">${esc(s.ref)} · ${esc(s.label)} · ${esc(s.property_address || "")}${s.crew ? " · crew: " + esc(s.crew) : ""}</option>`).join("")}</select></label>
        <label>Title<input name="title" placeholder="Curb Appeal Refresh, 123 Main"></label><label>Date<input type="date" name="work_date" min="${today()}"></label><label>Pay ($)<input name="pay" inputmode="decimal"></label>
        <div class="wide"><button class="btn gold">Assign job</button></div></form>
      <div class="list" style="margin-top:10px">${jobs.map((j) => `<div class="row"><div><div class="t">${esc(j.title || j.slabel || "Job")}</div><div class="s">${esc([fmtDate(j.work_date), j.sref, j.property_address, j.pay != null ? usd(j.pay) : ""].filter(Boolean).join(" · "))}</div></div>
        <div class="acts"><span class="pill ${j.paid_at ? "ok" : j.status === "done" ? "bad" : "mute"}">${j.paid_at ? "Paid " + fmtDate(j.paid_at) : j.status === "done" ? "Done, unpaid" : esc(j.status)}</span>
        ${j.status === "scheduled" ? `<button class="btn small" data-job="${esc(j.id)}" data-st="done">Mark done</button>` : ""}${!j.paid_at && j.status === "done" ? `<button class="btn small" data-job="${esc(j.id)}" data-paid="1">Mark paid</button>` : ""}</div></div>`).join("") || `<p class="hint">No jobs yet.</p>`}</div></section>`;
  $("drawer").hidden = false;
  $("wForm").onsubmit = async (e) => { e.preventDefault(); try { await send("worker/" + id, "PATCH", readW(e.target)); toast("Saved"); openWorker(id); } catch (er) { toast(er.message); } };
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

// ---------------- links ----------------
async function links() {
  $("view").innerHTML = LINKS.map(([h, items]) => `<section class="card"><div class="head"><h2>${esc(h)}</h2></div><div class="links">${items.map(([n, u, d]) =>
    `<a class="linkcard" href="${esc(u)}" ${/^https?:/.test(u) ? 'target="_blank" rel="noopener"' : ""}><b>${esc(n)}${/^https?:/.test(u) ? " ↗" : ""}</b><span>${esc(d)}</span></a>`).join("")}</div></section>`).join("");
}

route();
setInterval(shabbatBanner, 60000);
