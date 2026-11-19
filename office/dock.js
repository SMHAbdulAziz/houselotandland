// The dock: Assistant, Messages and Tasks on every back office page (server: src/teamwork.js).
// Each person sees only their own assistant chat, their channels and direct messages, and their tasks.
// The owner can review everyone's conversations on the Settings tab.
const H = () => window.HLL;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const when = (s) => { if (!s) return ""; const d = new Date(s), t = new Date(); const same = d.toDateString() === t.toDateString();
  return same ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const todayCT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
// Light markdown for assistant replies: escape first, then **bold**, `code`, lists and line breaks.
function md(s) {
  const lines = esc(s).split("\n"); let out = "", list = null;
  const inline = (x) => x.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/(^|\s)(#[a-z]+(?:\/[\w-]+)?)\b/g, '$1<a href="$2">$2</a>');
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) { if (!list) { out += "<ul>"; list = true; } out += `<li>${inline(m[1])}</li>`; continue; }
    if (list) { out += "</ul>"; list = null; }
    out += l.trim() ? `<p>${inline(l)}</p>` : "";
  }
  return out + (list ? "</ul>" : "");
}

const S = { open: false, tab: "assistant", unread: 0, tasksDue: 0, closed: false, chan: null, chans: null, members: [], me: "", owner: false, emailMode: "all",
  asst: null, busy: false, taskScope: "mine", timer: null, threadTimer: null };

function build() {
  const root = document.createElement("div");
  root.id = "dock";
  root.innerHTML = `
    <button class="dk-launch" id="dkLaunch" type="button" aria-expanded="false" aria-controls="dkPanel">✦ Assistant<span class="dk-badge" id="dkBadge" hidden></span></button>
    <section class="dk-panel" id="dkPanel" role="dialog" aria-label="Assistant, messages and tasks" hidden>
      <header class="dk-head">
        <nav class="dk-tabs" role="tablist">
          <button type="button" role="tab" data-dk="assistant">✦ Assistant</button>
          <button type="button" role="tab" data-dk="messages">Messages<span class="dk-n" id="dkNMsg" hidden></span></button>
          <button type="button" role="tab" data-dk="tasks">Tasks<span class="dk-n" id="dkNTask" hidden></span></button>
        </nav>
        <button type="button" class="dk-x" id="dkClose" aria-label="Close">×</button>
      </header>
      <div class="dk-shabbat" id="dkShabbat" hidden>Closed for Shabbat: you can read, and asking, posting and task changes open again after sunset Saturday.</div>
      <div class="dk-body" id="dkBody"></div>
    </section>`;
  document.body.appendChild(root);
  $("#dkLaunch").onclick = () => toggle(!S.open);
  $("#dkClose").onclick = () => toggle(false);
  root.querySelectorAll("[data-dk]").forEach((b) => b.onclick = () => show(b.dataset.dk));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.open && !document.querySelector(".drawer:not([hidden])")) toggle(false); });
}
function toggle(on) {
  S.open = on; $("#dkPanel").hidden = !on; $("#dkLaunch").setAttribute("aria-expanded", on);
  try { sessionStorage.setItem("hll_dock", on ? S.tab : ""); } catch {}
  if (on) show(S.tab); else clearInterval(S.threadTimer);
}
function show(tab) {
  S.tab = tab; clearInterval(S.threadTimer);
  document.querySelectorAll("#dock [data-dk]").forEach((b) => b.setAttribute("aria-selected", b.dataset.dk === tab));
  try { sessionStorage.setItem("hll_dock", tab); } catch {}
  ({ assistant: assistantView, messages: messagesView, tasks: tasksView })[tab]();
}
function badge() {
  const n = S.unread + S.tasksDue, b = $("#dkBadge");
  b.hidden = !n; b.textContent = n > 99 ? "99+" : n;
  const nm = $("#dkNMsg"), nt = $("#dkNTask");
  nm.hidden = !S.unread; nm.textContent = S.unread; nt.hidden = !S.tasksDue; nt.textContent = S.tasksDue;
  $("#dkShabbat").hidden = !S.closed;
  document.title = (S.unread ? `(${S.unread}) ` : "") + document.title.replace(/^\(\d+\)\s*/, "");
}
async function poll() {
  try { const j = await H().api("chat/unread"); S.unread = j.unread; S.tasksDue = j.tasksDue; S.closed = j.closed; badge();
    if (S.open && S.tab === "messages" && !S.chan) listView(true); } catch {}
}
const pageCtx = () => ({ hash: location.hash || "#overview", title: ($("#view h2") || {}).textContent || ($("#tabs a[aria-current=page]") || {}).textContent || "" });

// ---------------- Assistant ----------------
async function assistantView() {
  const body = $("#dkBody");
  body.innerHTML = `<div class="dk-asst">
      <div class="dk-note">Private to you. ${S.owner ? "You can review everyone's conversations in Settings." : "Harvey (owner) can review conversations for security."} <button type="button" class="dk-link" id="dkNew">New chat</button></div>
      <div class="dk-log" id="dkLog" aria-live="polite"><p class="dk-hint">Loading…</p></div>
      <form class="dk-ask" id="dkAsk"><textarea id="dkQ" rows="2" placeholder="Ask anything: what's due today, find a property, how do I…" aria-label="Ask the assistant"></textarea><button class="dk-send" type="submit">Ask</button></form>
    </div>`;
  $("#dkNew").onclick = async () => { await H().send("assistant/new", "POST", {}); S.asst = null; assistantView(); };
  $("#dkAsk").onsubmit = (e) => { e.preventDefault(); ask($("#dkQ").value); };
  $("#dkQ").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask($("#dkQ").value); } };
  try { const j = await H().api("assistant"); S.asst = j; renderLog(); }
  catch (e) { $("#dkLog").innerHTML = `<p class="dk-err">${esc(e.message)}</p>`; }
  $("#dkQ").focus();
}
function renderLog() {
  const log = $("#dkLog"); if (!log) return;
  const msgs = S.asst.messages.filter((m) => m.role !== "system");
  const starters = ["What needs my attention today?", "Show my follow-ups due", "What are my open tasks?", "Catch me up on team messages", `How do I use the ${pageCtx().title || "this"} page?`];
  log.innerHTML = (!S.asst.ready ? `<p class="dk-err">The assistant isn't connected yet.${S.owner ? " Turn it on in Settings → Assistant." : " Ask Harvey to turn it on."}</p>` : "") +
    (msgs.length ? "" : `<div class="dk-hello"><b>Hi${H().me().name ? " " + esc(H().me().name.split(" ")[0]) : ""}.</b> I can find things, show what's due, explain any page, set up tasks and draft messages. I suggest; you click to make changes.<div class="dk-chips">${starters.map((s) => `<button type="button" class="dk-chip">${esc(s)}</button>`).join("")}</div></div>`) +
    msgs.map((m) => `<div class="dk-msg ${m.role}">${m.role === "user" ? `<p>${esc(m.content)}</p>` : md(m.content)}
      ${(m.actions || []).length ? `<div class="dk-acts">${m.actions.map((a, i) => `<button type="button" class="dk-act" data-mid="${esc(m.id)}" data-i="${i}" ${a.done ? "disabled" : ""}>${a.done ? "✓ " : ""}${esc(a.label)}</button>`).join("")}</div>` : ""}</div>`).join("") +
    (S.busy ? `<div class="dk-msg assistant dk-typing"><span></span><span></span><span></span></div>` : "");
  log.querySelectorAll(".dk-chip").forEach((c) => c.onclick = () => ask(c.textContent));
  log.querySelectorAll(".dk-act").forEach((b) => b.onclick = () => runAction(b.dataset.mid, +b.dataset.i, b));
  log.querySelectorAll("a[href^='#']").forEach((a) => a.onclick = () => { if (innerWidth < 700) toggle(false); });
  log.scrollTop = log.scrollHeight;
}
async function ask(q) {
  q = String(q || "").trim(); if (!q || S.busy) return;
  if (S.closed) { H().toast("Closed for Shabbat. The assistant opens again after sunset Saturday."); return; }
  $("#dkQ").value = ""; S.busy = true;
  S.asst.messages.push({ role: "user", content: q }); renderLog();
  try { const j = await H().send("assistant", "POST", { message: q, page: pageCtx() }); S.asst.messages.push(j.message); }
  catch (e) { S.asst.messages.push({ role: "assistant", content: "⚠ " + e.message, actions: [] }); }
  S.busy = false; renderLog();
}
async function runAction(mid, i, btn) {
  const m = S.asst.messages.find((x) => x.id === mid), a = m && m.actions[i]; if (!a) return;
  btn.disabled = true;
  try {
    let result = "done";
    if (a.type === "navigate") { location.hash = a.hash; if (innerWidth < 700) toggle(false); }
    else if (a.type === "open_property") { await H().openProperty(a.property_id); }
    else if (a.type === "update_deal") { const b = {}; if (a.stage) b.stage = a.stage; if (a.next_touch) b.next_touch = a.next_touch; await H().send("deal/" + a.deal_id, "PATCH", b); H().toast("Deal updated"); }
    else if (a.type === "add_note") { await H().send("activity", "POST", { property_id: a.property_id, deal_id: a.deal_id, summary: a.summary, kind: a.kind || "note", next_touch: a.next_touch }); H().toast("Note saved"); }
    else if (a.type === "create_task") { await H().send("tasks", "POST", { title: a.title, assignee: a.assignee, due: a.due, notes: a.notes, property_id: a.property_id }); H().toast("Task created"); poll(); }
    else if (a.type === "complete_task") { await H().send("task/" + a.task_id, "PATCH", { status: "done" }); H().toast("Task done"); poll(); }
    else if (a.type === "send_message") {
      let cid;
      if (a.to.includes("@")) cid = (await H().send("chat/dm", "POST", { email: a.to })).channel.id;
      else cid = "ch_" + a.to.replace(/^#/, "").toLowerCase();
      await H().send("chat/" + encodeURIComponent(cid), "POST", { body: a.body }); H().toast("Message sent"); result = "sent";
    }
    a.done = new Date().toISOString();
    H().send("assistant/action/" + mid, "POST", { index: i, result }).catch(() => {});
    if (["update_deal", "add_note"].includes(a.type) && $("#drawer").hidden) H().route();
    renderLog();
  } catch (e) { btn.disabled = false; H().toast(e.message); }
}

// ---------------- Messages ----------------
async function messagesView() { S.chan ? threadView(S.chan) : listView(); }
async function listView(quiet) {
  clearInterval(S.threadTimer);
  const body = $("#dkBody");
  if (!quiet) body.innerHTML = `<p class="dk-hint" style="padding:14px">Loading…</p>`;
  let j; try { j = await H().api("chat"); } catch (e) { body.innerHTML = `<p class="dk-err" style="padding:14px">${esc(e.message)}</p>`; return; }
  S.chans = j.channels; S.members = j.members; S.me = j.me; S.owner = j.owner; S.emailMode = j.email_mode;
  if (S.tab !== "messages" || S.chan) return;
  const nameOf = (e) => (S.members.find((p) => p.email === e) || {}).name || e;
  const dot = (e) => (S.members.find((p) => p.email === e) || {}).online ? `<i class="dk-on" title="Online"></i>` : "";
  const others = S.members.filter((p) => p.email !== S.me);
  body.innerHTML = `<div class="dk-list">
      <div class="dk-row-head"><b>Channels</b>${S.owner ? `<button type="button" class="dk-link" id="dkAddCh">+ Channel</button>` : ""}</div>
      ${S.chans.filter((c) => c.kind === "channel").map((c) => item(c, "# " + esc(c.name), c.topic)).join("")}
      <div class="dk-row-head"><b>Direct messages</b></div>
      ${S.chans.filter((c) => c.kind === "dm").map((c) => { const o = c.members.find((e) => e !== S.me) || S.me; return item(c, dot(o) + esc(nameOf(o)), ""); }).join("") || `<p class="dk-hint">No direct messages yet.</p>`}
      <label class="dk-new">Message someone <select id="dkDm"><option value="">Choose a teammate…</option>${others.map((p) => `<option value="${esc(p.email)}">${esc(p.name)}${p.online ? " • online" : ""} (${esc(p.roleLabel)})</option>`).join("")}</select></label>
      <label class="dk-new">Email me about new messages when I'm away
        <select id="dkMode"><option value="all">All messages</option><option value="dms_mentions">Only direct messages and @mentions</option><option value="off">Never</option></select></label>
      <p class="dk-hint">Emails go out about once an hour to the address you sign in with. ${S.owner ? "" : "Harvey (owner) can review messages for security."}</p>
    </div>`;
  function item(c, title, sub) {
    return `<button type="button" class="dk-item ${c.unread ? "unread" : ""}" data-cid="${esc(c.id)}"><span class="dk-it">${title}${c.unread ? `<span class="dk-n">${c.unread}</span>` : ""}</span>
      <span class="dk-sub">${esc((c.last_body || sub || "").slice(0, 70))}</span>${c.last_at ? `<span class="dk-when">${when(c.last_at)}</span>` : ""}</button>`;
  }
  body.querySelectorAll("[data-cid]").forEach((b) => b.onclick = () => threadView(b.dataset.cid));
  $("#dkMode").value = S.emailMode;
  $("#dkMode").onchange = async (e) => { try { await H().send("chat/prefs", "PUT", { email_mode: e.target.value }); H().toast("Email setting saved"); } catch (er) { H().toast(er.message); } };
  $("#dkDm").onchange = async (e) => { if (!e.target.value) return; try { const r = await H().send("chat/dm", "POST", { email: e.target.value }); threadView(r.channel.id); } catch (er) { H().toast(er.message); } };
  const add = $("#dkAddCh");
  if (add) add.onclick = async () => { const name = prompt("Channel name (for example: acquisitions, field-crew)"); if (!name) return;
    try { const r = await H().send("chat/channel", "POST", { name }); threadView(r.id); } catch (er) { H().toast(er.message); } };
}
async function threadView(cid, keepScroll) {
  S.chan = cid;
  const body = $("#dkBody");
  let j; try { j = await H().api("chat/" + encodeURIComponent(cid)); } catch (e) { S.chan = null; H().toast(e.message); return listView(); }
  if (S.tab !== "messages" || S.chan !== cid) return;
  const nameOf = (e) => (S.members.find((p) => p.email === e) || {}).name || e;
  const ch = j.channel, title = ch.kind === "channel" ? "# " + ch.name : (ch.members || []).filter((e) => e !== S.me).map(nameOf).join(", ") || "Notes to self";
  const old = $("#dkThread"), atBottom = !old || old.scrollHeight - old.scrollTop - old.clientHeight < 40, draft = ($("#dkMsg") || {}).value || "";
  const myFirst = (nameOf(S.me) || "").split(/\s+/)[0].toLowerCase();
  body.innerHTML = `<div class="dk-chat">
      <div class="dk-thead"><button type="button" class="dk-link" id="dkBack">‹ All</button><b>${esc(title)}</b>${ch.topic ? `<span class="dk-sub">${esc(ch.topic)}</span>` : ""}</div>
      <div class="dk-thread" id="dkThread">${j.messages.length ? j.messages.map((m) => `<div class="dk-m ${m.author === S.me ? "mine" : ""}">
          <div class="dk-mh"><b>${esc(nameOf(m.author))}</b> <span class="dk-when">${when(m.at)}${m.edited_at && !m.deleted ? " · edited" : ""}</span>
            ${!m.deleted && (m.author === S.me || S.owner) ? `<button type="button" class="dk-del" data-del="${esc(m.id)}" title="Delete" aria-label="Delete message">×</button>` : ""}</div>
          <div class="dk-mb">${m.deleted ? `<i class="dk-hint">Message deleted</i>` : esc(m.body).replace(/@([\w.+-]+(?:@[\w.-]+)?)/g, (x, k) => `<mark class="${k.toLowerCase() === myFirst || k.toLowerCase() === S.me ? "me" : ""}">@${k}</mark>`).replace(/\n/g, "<br>")}</div>
          ${m.property_id && m.address ? `<button type="button" class="dk-link" data-prop="${esc(m.property_id)}">Open ${esc(m.address)}</button>` : ""}</div>`).join("") : `<p class="dk-hint">No messages yet. Say hello.</p>`}</div>
      ${j.member ? `<form class="dk-ask" id="dkPost"><textarea id="dkMsg" rows="2" placeholder="Message ${esc(title)} (use @Name to notify someone)" aria-label="Message"></textarea><button class="dk-send" type="submit">Send</button></form>`
        : `<p class="dk-hint" style="padding:10px 14px">You're viewing this conversation as the owner (read only).</p>`}
    </div>`;
  const th = $("#dkThread"); if (atBottom || !keepScroll) th.scrollTop = th.scrollHeight;
  $("#dkBack").onclick = () => { S.chan = null; listView(); };
  body.querySelectorAll("[data-prop]").forEach((b) => b.onclick = () => H().openProperty(b.dataset.prop));
  body.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { if (!confirm("Delete this message?")) return; await H().send("chat/msg/" + b.dataset.del, "DELETE"); threadView(cid, true); });
  const f = $("#dkPost");
  if (f) {
    const ta = $("#dkMsg"); ta.value = draft; if (!keepScroll) ta.focus();
    const go = async () => { const v = ta.value.trim(); if (!v) return; if (S.closed) return H().toast("Closed for Shabbat. Posting opens again after sunset Saturday.");
      ta.disabled = true; try { await H().send("chat/" + encodeURIComponent(cid), "POST", { body: v }); ta.value = ""; await threadView(cid); } catch (e) { H().toast(e.message); } ta.disabled = false; ta.focus(); };
    f.onsubmit = (e) => { e.preventDefault(); go(); };
    ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } };
  }
  clearInterval(S.threadTimer);
  S.threadTimer = setInterval(() => { if (S.open && S.tab === "messages" && S.chan === cid && document.visibilityState === "visible" && !($("#dkMsg") || {}).value) threadView(cid, true); }, 10000);
  poll();
}

// ---------------- Tasks ----------------
async function tasksView() {
  const body = $("#dkBody");
  const scope = S.taskScope;
  let j; try { j = await H().api("tasks?" + (scope === "done" ? "done=1" : "scope=" + scope)); } catch (e) { body.innerHTML = `<p class="dk-err" style="padding:14px">${esc(e.message)}</p>`; return; }
  S.members = j.members; const me = H().me(), owner = me.owner;
  const nameOf = (e) => (S.members.find((p) => p.email === e) || {}).name || e;
  const t0 = todayCT();
  body.innerHTML = `<div class="dk-tasks">
      <div class="dk-scopes" role="group" aria-label="Which tasks">
        ${[["mine", "Mine"], ["assigned", "I assigned"], ...(owner ? [["all", "Everyone's"]] : []), ["done", "Done"]].map(([k, l]) => `<button type="button" class="dk-chip ${scope === k ? "on" : ""}" data-scope="${k}">${l}</button>`).join("")}
      </div>
      <form class="dk-tform" id="dkTF">
        <input name="title" placeholder="New task…" maxlength="200" required aria-label="Task">
        <div class="dk-trow"><select name="assignee" aria-label="Assign to">${S.members.map((p) => `<option value="${esc(p.email)}" ${p.email === me.email ? "selected" : ""}>${p.email === me.email ? "Me" : esc(p.name)}</option>`).join("")}</select>
          <input name="due" type="date" aria-label="Due date"><button class="dk-send" type="submit">Add</button></div>
        <input name="notes" placeholder="Notes (optional)" maxlength="2000" aria-label="Notes">
      </form>
      <div class="dk-tlist">${j.tasks.length ? j.tasks.map((k) => `<div class="dk-task ${k.status}">
          <input type="checkbox" data-done="${esc(k.id)}" ${k.status === "done" ? "checked" : ""} ${scope === "done" ? "disabled" : ""} aria-label="Mark done">
          <div><b>${esc(k.title)}</b>${k.notes ? `<div class="dk-sub">${esc(k.notes)}</div>` : ""}
            <div class="dk-sub">${k.due ? `<span class="${k.due < t0 && k.status !== "done" ? "dk-late" : ""}">Due ${esc(k.due)}</span> · ` : ""}${k.assignee === me.email ? "You" : esc(nameOf(k.assignee))}${k.created_by && k.created_by !== k.assignee ? ` · from ${k.created_by === me.email ? "you" : esc(nameOf(k.created_by))}` : ""}
            ${k.property_id ? ` · <button type="button" class="dk-link" data-prop="${esc(k.property_id)}">${esc(k.address || "Property")}</button>` : ""}</div></div>
          ${k.created_by === me.email || owner ? `<button type="button" class="dk-del" data-tdel="${esc(k.id)}" aria-label="Delete task">×</button>` : ""}</div>`).join("") : `<p class="dk-hint">${scope === "done" ? "Nothing finished yet." : "No open tasks here."}</p>`}</div>
    </div>`;
  body.querySelectorAll("[data-scope]").forEach((b) => b.onclick = () => { S.taskScope = b.dataset.scope; tasksView(); });
  body.querySelectorAll("[data-prop]").forEach((b) => b.onclick = () => H().openProperty(b.dataset.prop));
  body.querySelectorAll("[data-done]").forEach((c) => c.onchange = async () => { try { await H().send("task/" + c.dataset.done, "PATCH", { status: c.checked ? "done" : "open" }); poll(); setTimeout(tasksView, 400); } catch (e) { c.checked = !c.checked; H().toast(e.message); } });
  body.querySelectorAll("[data-tdel]").forEach((b) => b.onclick = async () => { if (!confirm("Delete this task?")) return; await H().send("task/" + b.dataset.tdel, "DELETE"); tasksView(); });
  $("#dkTF").onsubmit = async (e) => { e.preventDefault(); const f = e.target;
    try { await H().send("tasks", "POST", { title: f.title.value, assignee: f.assignee.value, due: f.due.value, notes: f.notes.value }); H().toast(f.assignee.value === me.email ? "Task added" : "Task assigned and sent as a message"); poll(); tasksView(); }
    catch (er) { H().toast(er.message); } };
}

function start() {
  if (document.getElementById("dock") || !H() || !H().me().email) return;
  S.owner = H().me().owner;
  build(); poll();
  S.timer = setInterval(() => document.visibilityState === "visible" && poll(), 30000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && poll());
  let last = ""; try { last = sessionStorage.getItem("hll_dock") || ""; } catch {}
  if (last) { S.tab = last; toggle(true); }
}
window.addEventListener("hll:ready", start);
if (window.HLL && window.HLL.me().email) start();
// Other pages can open the dock on a tab: window.HLLDock.open("messages")
window.HLLDock = { open: (tab) => { if (tab) S.tab = tab; toggle(true); } };
