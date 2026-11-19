// Teamwork in the back office (Nov 19, 2026): the Assistant, team Messages and Tasks, shown in the dock on every page.
//
// - Assistant: each member's own conversation (assistant_msgs). It looks things up only through officeCall, so it sees
//   exactly what that person may see, and it never changes anything itself: it proposes actions (open a page, update a
//   deal, log a note, create or finish a task, send a message) that run only when the person clicks them, through the
//   same permission-checked API. The owner can review every member's assistant chats and messages (Settings).
// - Messages: channels everyone on the team is in (#general first) and direct messages between two people. @Name
//   notifies. People who are away get an email digest from the hourly "Website leads" scheduled task, which reads the
//   chat_email_queue view and records what it sent in chat_prefs.emailed_through.
// - Tasks: title, assignee, due date, optional property; assigning someone else also sends them a direct message.
// Shabbat: asking the assistant, posting, and creating or changing tasks wait until sunset Saturday; reading works.

import { can, trackOk, ROLES, TRACK_KEYS } from "./team.js";
import { shabbatStatus, closedMessage } from "../js/shabbat.js";
import { TRACKS } from "../js/hub-keys.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS assistant_msgs (id TEXT PRIMARY KEY, email TEXT NOT NULL, conv INTEGER NOT NULL DEFAULT 1, role TEXT NOT NULL,
    content TEXT NOT NULL, actions TEXT, page TEXT, model TEXT, at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS assistant_msgs_email ON assistant_msgs (email, at)`,
  `CREATE TABLE IF NOT EXISTS chat_channels (id TEXT PRIMARY KEY, name TEXT, kind TEXT NOT NULL, members TEXT, topic TEXT,
    created_by TEXT, created_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL,
    mentions TEXT, property_id TEXT, at TEXT NOT NULL, edited_at TEXT, deleted INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS chat_messages_channel ON chat_messages (channel_id, at)`,
  `CREATE TABLE IF NOT EXISTS chat_reads (email TEXT NOT NULL, channel_id TEXT NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY (email, channel_id))`,
  `CREATE TABLE IF NOT EXISTS chat_prefs (email TEXT PRIMARY KEY, email_mode TEXT NOT NULL DEFAULT 'all', emailed_through TEXT)`,
  `CREATE TABLE IF NOT EXISTS team_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, notes TEXT, assignee TEXT, due TEXT,
    status TEXT NOT NULL DEFAULT 'open', property_id TEXT, deal_id TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, done_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS team_tasks_assignee ON team_tasks (assignee, status)`,
  // What the hourly scheduled task emails: unread messages for active members who are away (not seen in 15 minutes),
  // not yet emailed, by their email setting (all / dms_mentions / off).
  `CREATE VIEW IF NOT EXISTS chat_email_queue AS
    SELECT t.email AS to_email, COALESCE(NULLIF(t.name, ''), t.email) AS to_name, m.id, m.at, m.body, m.author,
      COALESCE(NULLIF(a.name, ''), m.author) AS author_name, c.kind, c.name AS channel, c.id AS channel_id
    FROM team t JOIN chat_messages m JOIN chat_channels c ON c.id = m.channel_id
      LEFT JOIN chat_reads r ON r.email = t.email AND r.channel_id = c.id
      LEFT JOIN chat_prefs pf ON pf.email = t.email
      LEFT JOIN team a ON a.email = m.author
    WHERE t.active = 1 AND m.deleted = 0 AND m.author <> t.email AND c.archived = 0
      AND (c.kind = 'channel' OR EXISTS (SELECT 1 FROM json_each(c.members) j WHERE j.value = t.email))
      AND m.at > COALESCE(r.read_at, '') AND m.at > COALESCE(pf.emailed_through, '')
      AND (t.last_seen IS NULL OR t.last_seen < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes'))
      AND COALESCE(pf.email_mode, 'all') <> 'off'
      AND (COALESCE(pf.email_mode, 'all') = 'all' OR c.kind = 'dm' OR m.mentions LIKE '%"' || t.email || '"%')`,
];
let ready = false;
async function ensure(db, t) {
  if (ready) return;
  for (const q of SCHEMA) await db.prepare(q).run();
  await db.prepare("INSERT OR IGNORE INTO chat_channels (id, name, kind, topic, created_by, created_at) VALUES ('ch_general', 'general', 'channel', 'Team-wide notes and updates', 'system', ?)").bind(t).run();
  ready = true;
}

const id = (p) => p + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const clean = (v, max = 500) => (v == null ? "" : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max));
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? String(s) : null);
const todayCT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const nowCT = () => new Date().toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
const ONLINE_MS = 3 * 60e3;

async function members(db) {
  return (await db.prepare("SELECT email, name, role, active, last_seen FROM team WHERE active = 1 ORDER BY name, email").all()).results
    .map((r) => ({ email: r.email, name: r.name || r.email.split("@")[0], role: r.role, roleLabel: (ROLES[r.role] || {}).label || r.role,
      online: !!r.last_seen && Date.now() - Date.parse(r.last_seen) < ONLINE_MS, last_seen: r.last_seen }));
}
const canSee = (u, ch) => ch && (ch.kind === "channel" || (parse(ch.members) || []).includes(u.email) || u.owner);
const isMember = (u, ch) => ch && (ch.kind === "channel" || (parse(ch.members) || []).includes(u.email));
const dmId = (a, b) => "dm_" + [a, b].sort().join("|").replace(/[^a-z0-9@.|_+-]/gi, "").slice(0, 180);

/** Messages: post into a channel the person belongs to; returns the message. */
async function postMessage(db, u, ch, body, t, extra = {}) {
  const team = await members(db);
  const mentions = [];
  for (const mm of body.matchAll(/@([\w.+-]+(?:@[\w.-]+)?)/g)) {
    const k = mm[1].toLowerCase();
    const hit = team.find((p) => p.email === k || p.email.split("@")[0] === k || (p.name || "").split(/\s+/)[0].toLowerCase() === k);
    if (hit && !mentions.includes(hit.email)) mentions.push(hit.email);
  }
  const msg = { id: id("m"), channel_id: ch.id, author: u.email, body, mentions: JSON.stringify(mentions), property_id: extra.property_id || null, at: t };
  await db.prepare("INSERT INTO chat_messages (id, channel_id, author, body, mentions, property_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(msg.id, msg.channel_id, msg.author, msg.body, msg.mentions, msg.property_id, msg.at).run();
  await markRead(db, u.email, ch.id, t);
  return msg;
}
async function markRead(db, email, cid, t) {
  await db.prepare("INSERT INTO chat_reads (email, channel_id, read_at) VALUES (?, ?, ?) ON CONFLICT(email, channel_id) DO UPDATE SET read_at = MAX(read_at, excluded.read_at)").bind(email, cid, t).run();
}
async function openDm(db, u, other, t) {
  const cid = dmId(u.email, other);
  await db.prepare("INSERT OR IGNORE INTO chat_channels (id, name, kind, members, created_by, created_at) VALUES (?, NULL, 'dm', ?, ?, ?)")
    .bind(cid, JSON.stringify([u.email, other].sort()), u.email, t).run();
  return await db.prepare("SELECT * FROM chat_channels WHERE id = ?").bind(cid).first();
}
/** Channels this person is in, with unread counts and the last message. */
async function myChannels(db, u) {
  const rows = (await db.prepare(`SELECT c.*, r.read_at,
      (SELECT COUNT(*) FROM chat_messages m WHERE m.channel_id = c.id AND m.deleted = 0 AND m.author <> ? AND m.at > COALESCE(r.read_at, '')) AS unread,
      (SELECT m.at FROM chat_messages m WHERE m.channel_id = c.id AND m.deleted = 0 ORDER BY m.at DESC LIMIT 1) AS last_at,
      (SELECT m.body FROM chat_messages m WHERE m.channel_id = c.id AND m.deleted = 0 ORDER BY m.at DESC LIMIT 1) AS last_body
    FROM chat_channels c LEFT JOIN chat_reads r ON r.email = ? AND r.channel_id = c.id
    WHERE c.archived = 0 AND (c.kind = 'channel' OR EXISTS (SELECT 1 FROM json_each(c.members) j WHERE j.value = ?))
    ORDER BY c.kind = 'channel' DESC, COALESCE(last_at, c.created_at) DESC`).bind(u.email, u.email, u.email).all()).results;
  return rows.map((c) => ({ ...c, members: parse(c.members) }));
}

// ---------------- tasks ----------------
const TASK_STATUS = ["open", "doing", "done", "cancelled"];
const taskOk = (u, tk) => u.owner || tk.assignee === u.email || tk.created_by === u.email;
async function createTask(db, u, b, t) {
  const title = clean(b.title, 200);
  if (!title) return { ok: false, message: "Give the task a title." };
  const team = await members(db);
  const assignee = clean(b.assignee, 120).toLowerCase() || u.email;
  if (!team.some((p) => p.email === assignee)) return { ok: false, message: "Pick someone on the team." };
  const tk = { id: id("tk"), title, notes: clean(b.notes, 2000) || null, assignee, due: isoDate(b.due), property_id: clean(b.property_id, 60) || null, deal_id: clean(b.deal_id, 60) || null };
  await db.prepare("INSERT INTO team_tasks (id, title, notes, assignee, due, status, property_id, deal_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)")
    .bind(tk.id, tk.title, tk.notes, tk.assignee, tk.due, tk.property_id, tk.deal_id, u.email, t, t).run();
  if (assignee !== u.email) { // let them know (and email them if they're away)
    const ch = await openDm(db, u, assignee, t);
    await postMessage(db, u, ch, `📋 New task for you: ${title}${tk.due ? ` (due ${tk.due})` : ""}${tk.notes ? `\n${tk.notes}` : ""}`, t, { property_id: tk.property_id });
  }
  return { ok: true, task: tk };
}

// ---------------- the assistant ----------------
const PAGES = [
  ["overview", "Overview", () => true, "pipelines by track, follow-ups due, recent activity, services and sales (with payments), affiliate counts"],
  ["deals", "Deals", (u) => can(u, "deals") || can(u, "add") || can(u, "import"), "every deal on your tracks; filter by track, stage, Follow-up due, No next touch, No owner, No asking price, Form submitted; sort columns; select rows to set stage or next touch in bulk; click a row to open the property drawer (tracks, owners/contacts, values, history, notes)"],
  ["add", "Add property", (u) => can(u, "add"), "add a property with its first track; it matches existing properties instead of duplicating"],
  ["import", "Import list", (u) => can(u, "import"), "import a shared Google Maps list, pasted addresses or a file; preview, then add or assign a track/type"],
  ["jobs", "Jobs", (u) => can(u, "jobs"), "service orders (Curb Appeal, Property Watch, Homestead Trust, contracts); schedule field work (never Saturdays), assign crews, record payments/refunds if allowed"],
  ["quotes", "Quotes", (u) => can(u, "quotes"), "Curb Appeal quotes for lots over 2 acres"],
  ["workers", "Workers & crews", (u) => can(u, "crew"), "crew roster, applications, W-9 requests, insurance, jobs and crew pay"],
  ["affiliates", "Affiliates", (u) => can(u, "affiliates"), "referral partners, referrals and $2,500 payouts"],
  ["links", "Dashboards & links", (u) => u.owner, "links to the owner's dashboards (Deal Desk, Sub-To Pipeline, Creative Finance Tracker)"],
  ["team", "Team", (u) => can(u, "team"), "add people, roles, tracks and permissions"],
  ["settings", "Settings", (u) => can(u, "settings"), "automatic searches (BatchData spending), business details, connections, team conversation review"],
];

const TOOLS = [
  { name: "overview", need: () => true, description: "Counts by track and stage, follow-ups due today or earlier (up to 40), and recent activity the person can see.", params: {} },
  { name: "find", need: (u) => can(u, "deals") || can(u, "add") || can(u, "import"), description: "Search properties (and contacts, if allowed) by address, name, city, ZIP, phone or ref code.", params: { q: "search text" } },
  { name: "list_deals", need: (u) => can(u, "deals") || can(u, "add") || can(u, "import"), description: "Open deals, optionally by track (" + TRACK_KEYS.join(", ") + "), stage, search text, or only follow-ups due (due_only true). Returns up to 30.", params: { track: "optional", stage: "optional", q: "optional", due_only: "optional true/false" } },
  { name: "property", need: (u) => can(u, "deals") || can(u, "add") || can(u, "import"), description: "One property with its deals, contacts (if allowed) and the latest history. Use the property id from find or list_deals.", params: { id: "property id" } },
  { name: "jobs", need: (u) => can(u, "jobs"), description: "Service orders. filter: open, needs_date, scheduled, unpaid, all.", params: { filter: "optional" } },
  { name: "workers", need: (u) => can(u, "crew"), description: "Crew roster and applicants with status and W-9 status.", params: {} },
  { name: "tasks", need: () => true, description: "Team tasks: mine (assigned to me), assigned (I assigned to others), or all (owner only).", params: { scope: "mine | assigned | all" } },
  { name: "team", need: () => true, description: "Who is on the team: names, emails, roles, and who is online now.", params: {} },
  { name: "catch_up", need: () => true, description: "The latest team messages in the person's channels and direct messages (newest 30), with unread counts.", params: {} },
];

const ACTIONS = {
  navigate: { need: () => true, req: ["hash"] },
  open_property: { need: (u) => can(u, "deals") || can(u, "add") || can(u, "import"), req: ["property_id"] },
  update_deal: { need: (u) => can(u, "deals.edit"), req: ["deal_id"] },
  add_note: { need: (u) => can(u, "deals.edit") || can(u, "email"), req: ["property_id", "summary"] },
  create_task: { need: () => true, req: ["title"] },
  complete_task: { need: () => true, req: ["task_id"] },
  send_message: { need: () => true, req: ["to", "body"] },
};

function systemPrompt(u, page, toolsOn) {
  const pages = PAGES.filter(([, , ok]) => ok(u)).map(([k, label, , what]) => `- ${label} (#${k}): ${what}`).join("\n");
  const tracks = [...u.tracks].map((k) => `${k} (${(TRACKS[k] || {}).label || k}: stages ${((TRACKS[k] || {}).stages || []).join(", ")})`).join("; ") || "none";
  return `You are the House Lot & Land back office assistant, a teammate inside houselotandland.org/office. House Lot & Land Sales Co. LLC is a North Texas real estate company (wholesaling, subject-to, creative/seller finance, private money funding, property services) owned by Harvey Searcy.

You are helping ${u.name || u.email} (${u.email}), role: ${u.roleLabel}${u.owner ? " (the owner)" : ""}. Their tracks: ${tracks}. Their permissions: ${[...u.perms].join(", ") || "none"}.
Now: ${nowCT()} (Central). They are on: ${page.title || page.hash || "the back office"}${page.hash ? ` (${page.hash})` : ""}.

Your job: help them get work done and keep the team coordinated. Find things, explain where to click, summarize what needs attention (follow-ups due, open jobs, unread messages, tasks), suggest the next step, draft notes and messages, and set up tasks for the right person. Be brief and concrete: short sentences, lists only when there are several items, real names, addresses and dates from the data.

Pages they can use:
${pages}

Rules:
- Use the tools to look things up; never guess or invent addresses, people, numbers or dates. The tools only show what this person is allowed to see; if something isn't there, say you can't see it and suggest asking Harvey.
- You never change anything yourself. To do something, propose it as an action button (below); it runs only if they click it, under their own permissions. Propose only what they asked for or clearly need, at most 4 actions.
- Each person's conversation with you is private to them; never reveal another person's chats or messages. The owner can review all conversations for security.
- For deep analysis of one deal (offer numbers, exit strategy, reading documents and photos), Harvey's dashboards have the Deal Advisor; team members can ask Harvey or post the deal in Messages. You handle navigation, coordination, follow-ups, tasks and messages.
- Company rules: closed Friday sunset to Saturday sunset (Shabbat) for all business; no Curb Appeal work on Saturdays; never call or text anyone without recorded consent (texts only through the back office); offers and agreements go out only by Harvey's click; never give legal advice; never collect SSNs, tax IDs or account numbers.
${toolsOn}

To propose actions, end your reply with one fenced block exactly like this (JSON array, nothing after it):
\`\`\`hll-actions
[{"type":"navigate","hash":"#deals","label":"Open Deals"}]
\`\`\`
Action types: navigate {hash, label}; open_property {property_id, label}; update_deal {deal_id, stage?, next_touch? (YYYY-MM-DD), label}; add_note {property_id, deal_id?, summary, kind? (note|call|text|email|mail|visit), next_touch?, label}; create_task {title, assignee (email), due? (YYYY-MM-DD), notes?, property_id?, label}; complete_task {task_id, label}; send_message {to (a teammate's email or a channel name like "general"), body, label}.`;
}

/** Run one tool for member u through the permission-checked API. Returns a compact JSON-able result. */
async function runTool(u, name, args, get, db) {
  const tool = TOOLS.find((x) => x.name === name);
  if (!tool || !tool.need(u)) return { error: "That isn't available to this person." };
  const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] != null && o[k] !== "").map((k) => [k, o[k]]));
  const dealRow = (r) => pick(r, ["id", "property_id", "track", "stage", "ref", "next_touch", "asking", "value", "address", "city", "state", "zip", "name", "contact_name", "cname", "cphone", "source"]);
  const call = async (p, q) => { const r = await get(p, q); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || "Not allowed."); return j; };
  try {
    if (name === "overview") {
      const s = await call("summary");
      return { deals_by_track_stage: s.deals, follow_ups_due: (s.due || []).slice(0, 40).map(dealRow), recent_activity: (s.recent || []).slice(0, 12).map((a) => pick(a, ["at", "kind", "summary", "by", "address", "property_id"])),
        open_service_orders: s.openSvc, quotes_needed: s.quoteNeeded, new_loan_apps: s.newLoans, affiliates: s.aff };
    }
    if (name === "find") {
      const s = await call("search", "?q=" + encodeURIComponent(clean(args.q, 80)));
      return { properties: (s.props || []).slice(0, 15).map((p) => pick(p, ["id", "address", "name", "city", "state", "zip", "tracks"])), contacts: (s.contacts || []).slice(0, 10).map((c) => pick(c, ["id", "name", "phone", "email"])) };
    }
    if (name === "list_deals") {
      const q = new URLSearchParams({ open: "1" });
      if (args.track && TRACKS[args.track]) q.set("track", args.track);
      if (args.stage) q.set("stage", clean(args.stage, 40));
      if (args.q) q.set("q", clean(args.q, 80));
      let rows = (await call("deals", "?" + q)).rows || [];
      if (args.due_only === true || args.due_only === "true") rows = rows.filter((r) => r.next_touch && r.next_touch <= todayCT());
      return { count: rows.length, deals: rows.slice(0, 30).map(dealRow) };
    }
    if (name === "property") {
      const s = await call("property/" + encodeURIComponent(clean(args.id, 60)));
      return { property: pick(s.property, ["id", "address", "name", "city", "state", "zip", "county", "prop_type", "beds", "baths", "sqft", "acres", "units"]),
        deals: s.deals.map(dealRow), contacts: s.contacts.map((c) => pick(c, ["id", "name", "role", "phone", "email", "consent", "opt_out"])),
        history: s.activities.slice(0, 12).map((a) => pick(a, ["at", "kind", "summary", "by"])) };
    }
    if (name === "jobs") {
      const f = clean(args.filter, 20) || "open", s = await call("jobs");
      const closed = ["completed", "delivered", "cancelled", "refunded"];
      const rows = (s.rows || []).filter((r) => !r.test && (f === "all" || (f === "unpaid" ? !r.paid_at && !closed.includes(r.status)
        : f === "scheduled" ? r.status === "scheduled" : f === "needs_date" ? !r.appointment_at && ["curb", "watch"].includes(r.service) && !closed.includes(r.status) : !closed.includes(r.status))));
      return { count: rows.length, jobs: rows.slice(0, 25).map((r) => pick(r, ["id", "ref", "service", "label", "status", "name", "property_address", "appointment_at", "crew", "amount", "paid_at"])) };
    }
    if (name === "workers") {
      const s = await call("workers");
      return { workers: (s.rows || s.workers || []).slice(0, 40).map((w) => pick(w, ["id", "name", "status", "kind", "city", "w9", "phone"])) };
    }
    if (name === "tasks") {
      const scope = ["mine", "assigned", "all"].includes(args.scope) ? args.scope : "mine";
      return await taskList(db, u, scope);
    }
    if (name === "team") return { members: (await members(db)).map((p) => pick(p, ["email", "name", "roleLabel", "online"])) };
    if (name === "catch_up") {
      const chans = await myChannels(db, u);
      const ids = chans.map((c) => c.id);
      const msgs = ids.length ? (await db.prepare(`SELECT channel_id, author, body, at FROM chat_messages WHERE deleted = 0 AND channel_id IN (${ids.map(() => "?").join(",")}) ORDER BY at DESC LIMIT 30`).bind(...ids).all()).results : [];
      const label = (cid) => { const c = chans.find((x) => x.id === cid); return c.kind === "channel" ? "#" + c.name : "DM with " + c.members.filter((e) => e !== u.email).join(", "); };
      return { unread: chans.filter((c) => c.unread).map((c) => ({ where: label(c.id), unread: c.unread })), latest: msgs.map((m) => ({ where: label(m.channel_id), from: m.author, at: m.at, body: m.body.slice(0, 400) })) };
    }
  } catch (e) { return { error: e.message }; }
  return { error: "Unknown tool." };
}

async function taskList(db, u, scope) {
  const where = scope === "all" && u.owner ? "1 = 1" : scope === "assigned" ? "created_by = ? AND assignee <> ?" : "assignee = ?";
  const vals = scope === "all" && u.owner ? [] : scope === "assigned" ? [u.email, u.email] : [u.email];
  const rows = (await db.prepare(`SELECT k.*, p.address FROM team_tasks k LEFT JOIN properties p ON p.id = k.property_id WHERE ${where} AND k.status IN ('open','doing')
    ORDER BY COALESCE(k.due, '9999'), k.created_at LIMIT 100`).bind(...vals).all()).results;
  return { scope, tasks: rows };
}

/** Pull the ```hll-actions block out of a reply and keep only valid actions this person may run. */
function takeActions(u, text) {
  const m = text.match(/```hll-actions\s*([\s\S]*?)```/);
  if (!m) return { text: text.trim(), actions: [] };
  let list = [];
  try { list = JSON.parse(m[1]); } catch {}
  const actions = (Array.isArray(list) ? list : []).filter((a) => a && ACTIONS[a.type] && ACTIONS[a.type].need(u) && ACTIONS[a.type].req.every((k) => clean(a[k])))
    .slice(0, 4).map((a) => {
      const o = { type: a.type, label: clean(a.label, 80) || a.type.replace("_", " ") };
      for (const k of ["hash", "property_id", "deal_id", "stage", "next_touch", "summary", "kind", "title", "assignee", "due", "notes", "task_id", "to", "body"]) if (a[k] != null && a[k] !== "") o[k] = clean(a[k], k === "body" || k === "summary" || k === "notes" ? 2000 : 200);
      if (o.hash && !/^#[a-z]+(\/[\w-]+)?$/.test(o.hash)) o.hash = "#overview";
      return o;
    });
  return { text: text.replace(m[0], "").trim(), actions };
}

/** Which model answers: Anthropic when ANTHROPIC_API_KEY is set (Settings picks the model), else Cloudflare Workers AI. */
async function assistantSettings(db, env) {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'assistant'").first().catch(() => null);
  const s = parse(row && row.value) || {};
  const anthropic = !!env.ANTHROPIC_API_KEY;
  const provider = s.provider === "workers-ai" || !anthropic ? (env.AI ? "workers-ai" : (anthropic ? "anthropic" : "none")) : "anthropic";
  return { provider, anthropic_available: anthropic, workers_ai_available: !!env.AI,
    model: provider === "anthropic" ? (ANTHROPIC_MODELS.includes(s.model) ? s.model : "claude-haiku-5-5") : (WORKERS_MODELS.includes(s.model) ? s.model : WORKERS_MODELS[0]) };
}
export const ANTHROPIC_MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"];
export const WORKERS_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"];

/** One assistant turn: model ↔ tools until it answers (at most 5 rounds). */
async function think(env, cfg, u, system, history, get, db) {
  const tools = TOOLS.filter((x) => x.need(u));
  if (env.ASSISTANT_MOCK) return await mockThink(u, history, (n, a) => runTool(u, n, a, get, db));
  if (cfg.provider === "anthropic") {
    const msgs = history.map((h) => ({ role: h.role, content: h.content }));
    const toolDefs = tools.map((x) => ({ name: x.name, description: x.description, input_schema: { type: "object", properties: Object.fromEntries(Object.entries(x.params).map(([k, d]) => [k, { type: k === "due_only" ? "boolean" : "string", description: d }])) } }));
    for (let round = 0; round < 5; round++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: cfg.model, max_tokens: 1500, system, messages: msgs, tools: toolDefs }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && j.error.message) || `The assistant service answered ${r.status}.`);
      const uses = (j.content || []).filter((c) => c.type === "tool_use");
      if (!uses.length || j.stop_reason !== "tool_use") return (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
      msgs.push({ role: "assistant", content: j.content });
      const results = [];
      for (const tu of uses) results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(await runTool(u, tu.name, tu.input || {}, get, db)).slice(0, 12000) });
      msgs.push({ role: "user", content: results });
    }
    return "I looked up a lot and ran out of steps. Could you narrow the question?";
  }
  if (cfg.provider === "workers-ai") {
    // Text protocol: the model asks for a tool with a line "TOOL {json}" and gets the result back.
    const guide = `\n\nTools (to use one, reply with ONLY one line: TOOL {"name":"<tool>","args":{...}} and wait for the result; then answer normally):\n` +
      tools.map((x) => `- ${x.name}: ${x.description} args: ${JSON.stringify(x.params)}`).join("\n");
    const msgs = [{ role: "system", content: system + guide }, ...history.map((h) => ({ role: h.role, content: h.content }))];
    for (let round = 0; round < 5; round++) {
      const out = await env.AI.run(cfg.model, { messages: msgs, max_tokens: 1200 });
      const text = String((out && (out.response ?? out.result?.response)) || "").trim();
      const m = text.match(/^\s*TOOL\s*(\{[\s\S]*\})\s*$/m);
      if (!m) return text;
      let call = {};
      try { call = JSON.parse(m[1]); } catch { return text; }
      const res = await runTool(u, call.name, call.args || {}, get, db);
      msgs.push({ role: "assistant", content: text }, { role: "user", content: `TOOL RESULT ${call.name}: ${JSON.stringify(res).slice(0, 10000)}` });
    }
    return "I looked up a lot and ran out of steps. Could you narrow the question?";
  }
  throw new Error("The assistant isn't connected yet. Harvey can turn it on in Settings.");
}

// Local tests only (ASSISTANT_MOCK=1 in .dev.vars): answers from the tools without a model.
async function mockThink(u, history, tool) {
  const q = history[history.length - 1].content.toLowerCase();
  if (q.includes("follow")) {
    const r = await tool("list_deals", { due_only: true });
    const first = (r.deals || [])[0];
    return `You have ${r.count || 0} follow-ups due.${first ? ` First up: ${first.address}.` : ""}\n\`\`\`hll-actions\n${JSON.stringify([{ type: "navigate", hash: "#deals", label: "Open Deals" }, ...(first ? [{ type: "open_property", property_id: first.property_id, label: "Open " + first.address }] : [])])}\n\`\`\``;
  }
  if (q.includes("task")) return `Here's a task for that.\n\`\`\`hll-actions\n[{"type":"create_task","title":"Call the seller back","assignee":"${u.email}","due":"${todayCT()}","label":"Create task"},{"type":"update_deal","deal_id":"x","stage":"Lead","label":"Not allowed for some"}]\n\`\`\``;
  const r = await tool("overview", {});
  return `Mock assistant for ${u.email}: ${JSON.stringify(r.deals_by_track_stage || []).length} bytes of pipeline data.`;
}

/** /api/office/assistant…, /api/office/chat…, /api/office/tasks, /api/office/task/<id>. */
export async function teamworkApi(env, u, m, seg, b, url, json, get) {
  const db = env.DB, t = new Date().toISOString();
  await ensure(db, t);
  const write = m !== "GET";
  const sh = shabbatStatus();
  if (write && sh.closed && !(seg[0] === "chat" && (seg[1] === "read" || seg[1] === "prefs")))
    return json({ ok: false, message: "Closed for Shabbat. " + closedMessage(sh) }, 503);

  // ---------- assistant ----------
  if (seg[0] === "assistant") {
    if (m === "GET" && !seg[1]) {
      const cfg = await assistantSettings(db, env);
      const conv = (await db.prepare("SELECT MAX(conv) AS c FROM assistant_msgs WHERE email = ?").bind(u.email).first()).c || 1;
      const rows = (await db.prepare("SELECT id, role, content, actions, at FROM assistant_msgs WHERE email = ? AND conv = ? ORDER BY at LIMIT 200").bind(u.email, conv).all()).results;
      return json({ ok: true, messages: rows.map((r) => ({ ...r, actions: parse(r.actions) || [] })), ready: cfg.provider !== "none", provider: cfg.provider, owner: u.owner });
    }
    if (m === "POST" && seg[1] === "new") { // start over: the old conversation stays on file for the owner's review
      const conv = (await db.prepare("SELECT MAX(conv) AS c FROM assistant_msgs WHERE email = ?").bind(u.email).first()).c || 0;
      await db.prepare("INSERT INTO assistant_msgs (id, email, conv, role, content, at) VALUES (?, ?, ?, 'system', 'New conversation', ?)").bind(id("am"), u.email, conv + 1, t).run();
      return json({ ok: true });
    }
    if (m === "POST" && seg[1] === "action" && seg[2]) { // remember that an action button was used
      const row = await db.prepare("SELECT * FROM assistant_msgs WHERE id = ? AND email = ?").bind(seg[2], u.email).first();
      if (!row) return json({ ok: false, message: "Not found." }, 404);
      const acts = parse(row.actions) || [], i = Number(b.index);
      if (acts[i]) { acts[i].done = t; acts[i].result = clean(b.result, 200); }
      await db.prepare("UPDATE assistant_msgs SET actions = ? WHERE id = ?").bind(JSON.stringify(acts), row.id).run();
      return json({ ok: true });
    }
    if (m === "POST" && !seg[1]) {
      const text = clean(b.message, 4000);
      if (!text) return json({ ok: false, message: "Type a question first." }, 400);
      const cfg = await assistantSettings(db, env);
      const conv = (await db.prepare("SELECT MAX(conv) AS c FROM assistant_msgs WHERE email = ?").bind(u.email).first()).c || 1;
      const page = { hash: clean(b.page && b.page.hash, 80), title: clean(b.page && b.page.title, 120) };
      await db.prepare("INSERT INTO assistant_msgs (id, email, conv, role, content, page, at) VALUES (?, ?, ?, 'user', ?, ?, ?)").bind(id("am"), u.email, conv, text, page.hash, t).run();
      const past = (await db.prepare("SELECT role, content FROM assistant_msgs WHERE email = ? AND conv = ? AND role IN ('user','assistant') ORDER BY at DESC LIMIT 16").bind(u.email, conv).all()).results.reverse();
      while (past.length && past[0].role !== "user") past.shift();
      const toolsOn = `Tools you can use for this person: ${TOOLS.filter((x) => x.need(u)).map((x) => x.name).join(", ")}.`;
      let reply;
      try { reply = await think(env, cfg, u, systemPrompt(u, page, toolsOn), past, get, db); }
      catch (e) { return json({ ok: false, message: e.message || "The assistant couldn't answer just now." }, 502); }
      const { text: answer, actions } = takeActions(u, reply || "I don't have an answer for that.");
      const mid = id("am");
      await db.prepare("INSERT INTO assistant_msgs (id, email, conv, role, content, actions, model, at) VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?)")
        .bind(mid, u.email, conv, answer, JSON.stringify(actions), cfg.model, new Date().toISOString()).run();
      return json({ ok: true, message: { id: mid, role: "assistant", content: answer, actions } });
    }
    // Owner review of every member's assistant conversations (security and maintenance).
    if (seg[1] === "review") {
      if (!u.owner) return json({ ok: false, message: "Only the owner can review conversations." }, 403);
      if (m === "GET" && !seg[2]) {
        const rows = (await db.prepare(`SELECT email, COUNT(*) AS n, MAX(at) AS last_at FROM assistant_msgs WHERE role IN ('user','assistant') GROUP BY email ORDER BY last_at DESC`).all()).results;
        return json({ ok: true, people: rows });
      }
      const who = decodeURIComponent(seg[2] || "").toLowerCase();
      if (m === "GET") {
        const rows = (await db.prepare("SELECT id, conv, role, content, actions, page, model, at FROM assistant_msgs WHERE email = ? ORDER BY at LIMIT 2000").bind(who).all()).results;
        return json({ ok: true, email: who, messages: rows.map((r) => ({ ...r, actions: parse(r.actions) || [] })) });
      }
      if (m === "DELETE") {
        await db.prepare("DELETE FROM assistant_msgs WHERE email = ?").bind(who).run();
        await db.prepare("INSERT INTO activities (id, at, kind, summary, by, source) VALUES (?, ?, 'settings', ?, ?, 'office')").bind(id("a"), t, `Assistant history deleted for ${who}`, u.email).run();
        return json({ ok: true });
      }
    }
    if (seg[1] === "settings") {
      if (!u.owner) return json({ ok: false, message: "Only the owner can change this." }, 403);
      if (m === "GET") return json({ ok: true, ...(await assistantSettings(db, env)), anthropic_models: ANTHROPIC_MODELS, workers_models: WORKERS_MODELS });
      if (m === "PUT") {
        const provider = ["anthropic", "workers-ai"].includes(b.provider) ? b.provider : "workers-ai";
        const model = [...ANTHROPIC_MODELS, ...WORKERS_MODELS].includes(b.model) ? b.model : null;
        await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('assistant', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(JSON.stringify({ provider, model }), t).run();
        await db.prepare("INSERT INTO activities (id, at, kind, summary, by, source) VALUES (?, ?, 'settings', ?, ?, 'office')").bind(id("a"), t, `Assistant set to ${provider}${model ? " (" + model + ")" : ""}`, u.email).run();
        return json({ ok: true, ...(await assistantSettings(db, env)) });
      }
    }
    return json({ ok: false, message: "Not found." }, 404);
  }

  // ---------- messages ----------
  if (seg[0] === "chat") {
    if (m === "GET" && seg[1] === "unread") { // light poll for the badge (also keeps "online" fresh)
      const chans = await myChannels(db, u);
      const tasks = (await db.prepare("SELECT COUNT(*) AS n FROM team_tasks WHERE assignee = ? AND status IN ('open','doing') AND (due IS NULL OR due <= ?)").bind(u.email, todayCT()).first()).n;
      return json({ ok: true, unread: chans.reduce((s, c) => s + c.unread, 0), tasksDue: tasks, closed: sh.closed });
    }
    if (m === "GET" && !seg[1]) {
      const prefs = await db.prepare("SELECT email_mode FROM chat_prefs WHERE email = ?").bind(u.email).first();
      return json({ ok: true, channels: await myChannels(db, u), members: await members(db), me: u.email, owner: u.owner, email_mode: (prefs && prefs.email_mode) || "all" });
    }
    if (m === "PUT" && seg[1] === "prefs") {
      const mode = ["all", "dms_mentions", "off"].includes(b.email_mode) ? b.email_mode : "all";
      await db.prepare("INSERT INTO chat_prefs (email, email_mode) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET email_mode = excluded.email_mode").bind(u.email, mode).run();
      return json({ ok: true, email_mode: mode });
    }
    if (m === "POST" && seg[1] === "dm") {
      const other = clean(b.email, 120).toLowerCase();
      if (other === u.email || !(await members(db)).some((p) => p.email === other)) return json({ ok: false, message: "Pick someone on the team." }, 400);
      return json({ ok: true, channel: await openDm(db, u, other, t) });
    }
    if (seg[1] === "channel") { // owner: create or archive a channel
      if (!u.owner) return json({ ok: false, message: "Only the owner can add or archive channels." }, 403);
      if (m === "POST") {
        const name = clean(b.name, 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
        if (!name) return json({ ok: false, message: "Name the channel." }, 400);
        const cid = "ch_" + name;
        await db.prepare("INSERT OR IGNORE INTO chat_channels (id, name, kind, topic, created_by, created_at) VALUES (?, ?, 'channel', ?, ?, ?)").bind(cid, name, clean(b.topic, 200) || null, u.email, t).run();
        await db.prepare("UPDATE chat_channels SET archived = 0 WHERE id = ?").bind(cid).run();
        return json({ ok: true, id: cid });
      }
      if (m === "PATCH" && seg[2]) {
        if (seg[2] === "ch_general") return json({ ok: false, message: "#general stays." }, 400);
        await db.prepare("UPDATE chat_channels SET archived = ? , topic = COALESCE(?, topic) WHERE id = ? AND kind = 'channel'").bind(b.archived ? 1 : 0, b.topic != null ? clean(b.topic, 200) : null, seg[2]).run();
        return json({ ok: true });
      }
    }
    if (seg[1] === "msg" && seg[2]) { // edit or delete your own message (the owner can delete any)
      const msg = await db.prepare("SELECT * FROM chat_messages WHERE id = ?").bind(seg[2]).first();
      if (!msg) return json({ ok: false, message: "Not found." }, 404);
      if (m === "PATCH" && msg.author === u.email) { const body = clean(b.body, 4000); if (!body) return json({ ok: false, message: "Write something." }, 400);
        await db.prepare("UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ?").bind(body, t, msg.id).run(); return json({ ok: true }); }
      if (m === "DELETE" && (msg.author === u.email || u.owner)) { await db.prepare("UPDATE chat_messages SET deleted = 1, edited_at = ? WHERE id = ?").bind(t, msg.id).run(); return json({ ok: true }); }
      return json({ ok: false, message: "You can change only your own messages." }, 403);
    }
    if (m === "GET" && seg[1] === "review") { // owner: every conversation a member is part of
      if (!u.owner) return json({ ok: false, message: "Only the owner can review conversations." }, 403);
      const who = clean(url.searchParams.get("email"), 120).toLowerCase();
      const rows = (await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.channel_id = c.id AND m.deleted = 0) AS n,
          (SELECT MAX(at) FROM chat_messages m WHERE m.channel_id = c.id) AS last_at
        FROM chat_channels c WHERE c.kind = 'dm' AND EXISTS (SELECT 1 FROM json_each(c.members) j WHERE j.value = ?) ORDER BY last_at DESC`).bind(who).all()).results;
      return json({ ok: true, channels: rows.map((c) => ({ ...c, members: parse(c.members) })) });
    }
    if (seg[1] === "read" && seg[2] && m === "POST") { await markRead(db, u.email, seg[2], t); return json({ ok: true }); }
    if (seg[1]) {
      const ch = await db.prepare("SELECT * FROM chat_channels WHERE id = ?").bind(decodeURIComponent(seg[1])).first();
      if (!canSee(u, ch)) return json({ ok: false, message: "That conversation isn't yours." }, 403);
      if (m === "GET") {
        const before = clean(url.searchParams.get("before"), 40);
        const rows = (await db.prepare(`SELECT m.*, p.address FROM chat_messages m LEFT JOIN properties p ON p.id = m.property_id WHERE m.channel_id = ? ${before ? "AND m.at < ?" : ""} ORDER BY m.at DESC LIMIT 60`)
          .bind(...[ch.id, ...(before ? [before] : [])]).all()).results.reverse();
        if (isMember(u, ch)) await markRead(db, u.email, ch.id, t);
        return json({ ok: true, channel: { ...ch, members: parse(ch.members) }, messages: rows.map((r) => r.deleted ? { ...r, body: "" } : r), member: isMember(u, ch) });
      }
      if (m === "POST") {
        if (!isMember(u, ch)) return json({ ok: false, message: "You can read this conversation but not post in it." }, 403);
        const body = clean(b.body, 4000);
        if (!body) return json({ ok: false, message: "Write a message first." }, 400);
        return json({ ok: true, message: await postMessage(db, u, ch, body, t, { property_id: clean(b.property_id, 60) || null }) });
      }
    }
    return json({ ok: false, message: "Not found." }, 404);
  }

  // ---------- tasks ----------
  if (seg[0] === "tasks") {
    if (m === "GET") {
      const scope = url.searchParams.get("scope") || "mine";
      const done = url.searchParams.get("done") === "1";
      if (done) {
        const rows = (await db.prepare(`SELECT k.*, p.address FROM team_tasks k LEFT JOIN properties p ON p.id = k.property_id WHERE (k.assignee = ? OR k.created_by = ? OR ?) AND k.status IN ('done','cancelled') ORDER BY k.done_at DESC LIMIT 50`)
          .bind(u.email, u.email, u.owner ? 1 : 0).all()).results;
        return json({ ok: true, tasks: rows, members: await members(db) });
      }
      return json({ ok: true, ...(await taskList(db, u, scope)), members: await members(db) });
    }
    if (m === "POST") { const r = await createTask(db, u, b, t); return json(r, r.ok ? 200 : 400); }
  }
  if (seg[0] === "task" && seg[1]) {
    const tk = await db.prepare("SELECT * FROM team_tasks WHERE id = ?").bind(seg[1]).first();
    if (!tk) return json({ ok: false, message: "Not found." }, 404);
    if (!taskOk(u, tk)) return json({ ok: false, message: "Only the person it's assigned to, whoever made it, or the owner can change this task." }, 403);
    if (m === "PATCH") {
      const set = [], vals = [];
      if (b.status && TASK_STATUS.includes(b.status)) { set.push("status = ?", "done_at = ?"); vals.push(b.status, b.status === "done" || b.status === "cancelled" ? t : null); }
      if ("title" in b && clean(b.title, 200)) { set.push("title = ?"); vals.push(clean(b.title, 200)); }
      if ("notes" in b) { set.push("notes = ?"); vals.push(clean(b.notes, 2000) || null); }
      if ("due" in b) { set.push("due = ?"); vals.push(isoDate(b.due)); }
      if ("assignee" in b) {
        const a = clean(b.assignee, 120).toLowerCase();
        if (!(await members(db)).some((p) => p.email === a)) return json({ ok: false, message: "Pick someone on the team." }, 400);
        set.push("assignee = ?"); vals.push(a);
        if (a !== tk.assignee && a !== u.email) await postMessage(db, u, await openDm(db, u, a, t), `📋 Task handed to you: ${tk.title}${tk.due ? ` (due ${tk.due})` : ""}`, t);
      }
      if (!set.length) return json({ ok: true });
      await db.prepare(`UPDATE team_tasks SET ${set.join(", ")}, updated_at = ? WHERE id = ?`).bind(...vals, t, tk.id).run();
      if (b.status === "done" && tk.created_by && tk.created_by !== u.email && tk.created_by !== "system")
        await postMessage(db, u, await openDm(db, u, tk.created_by, t), `✅ Done: ${tk.title}`, t);
      return json({ ok: true });
    }
    if (m === "DELETE") { await db.prepare("DELETE FROM team_tasks WHERE id = ?").bind(tk.id).run(); return json({ ok: true }); }
  }
  return json({ ok: false, message: "Not found." }, 404);
}
