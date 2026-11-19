// Team members and what each may do in the back office. Enforced here, on the server, for every /api/office call;
// the page only hides what a person can't use. Harvey (role "owner") manages the team on the Team tab.
// Sign-in stays with Cloudflare Access (one-time PIN); the Access policy may let anyone request a PIN, because only
// active members in the `team` table get past this check. Until an owner row exists, everyone Access lets in is owner
// (how the back office worked before teams), so adding the first owner row is what turns roles on.

export const TRACK_KEYS = ["wholesale", "subto", "creative", "funding", "services"];

// Permission keys. Track access is separate (member.tracks).
export const PERMS = {
  deals: "See deals and properties on their tracks",
  "deals.edit": "Edit deals, properties and notes; change stages and follow-ups; add a track",
  "deals.delete": "Delete deals and properties",
  contacts: "See owners' phone numbers and emails",
  "contacts.edit": "Add and edit contacts, record consent and do-not-contact",
  email: "Draft owner emails (opens Gmail)",
  text: "Text sellers through the business line (consent rules still apply)",
  add: "Add properties",
  import: "Import lists (Google Maps, files)",
  jobs: "Service orders: status, schedule, notes",
  crew: "Workers and crews: roster, W-9s, job assignments, crew pay",
  payments: "Record payments and refunds; see revenue",
  quotes: "Curb Appeal quotes",
  affiliates: "Affiliates, referrals and payouts",
  settings: "Business settings (mailing address)",
  team: "Manage the team",
};

export const ROLES = {
  owner: { label: "Owner", tracks: TRACK_KEYS, perms: Object.keys(PERMS) },
  acquisitions: { label: "Acquisitions", tracks: ["wholesale", "subto", "creative", "funding"],
    perms: ["deals", "deals.edit", "contacts", "contacts.edit", "email", "add"] },
  wholesale: { label: "Wholesaling associate", tracks: ["wholesale"],
    perms: ["deals", "deals.edit", "contacts", "contacts.edit", "email", "add"] },
  field: { label: "Field operations", tracks: [], perms: ["jobs", "crew"] },
  admin: { label: "Office admin / bookkeeping", tracks: TRACK_KEYS,
    perms: ["deals", "contacts", "jobs", "crew", "payments", "quotes", "affiliates"] },
  data: { label: "Data entry / lead sourcing", tracks: TRACK_KEYS, perms: ["deals", "add", "import"] },
};

const SCHEMA = `CREATE TABLE IF NOT EXISTS team (
  email TEXT PRIMARY KEY, name TEXT, role TEXT NOT NULL, tracks TEXT, perms TEXT, active INTEGER DEFAULT 1,
  notes TEXT, added_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_seen TEXT)`;
let ready = false;
async function ensure(db) { if (!ready) { await db.prepare(SCHEMA).run(); ready = true; } }

const arr = (s) => { try { const v = JSON.parse(s || "null"); return Array.isArray(v) ? v : null; } catch { return null; } };

/** The signed-in person's membership: {email, name, role, tracks:Set, perms:Set, owner} or null (not on the team). */
export async function member(db, email) {
  await ensure(db);
  email = String(email || "").toLowerCase();
  const owners = (await db.prepare("SELECT COUNT(*) AS n FROM team WHERE role = 'owner' AND active = 1").first()).n;
  if (!owners) return full(email, "Owner (no team set up yet)"); // before the first owner row: unchanged behavior
  const r = await db.prepare("SELECT * FROM team WHERE email = ? AND active = 1").bind(email).first();
  if (!r) return null;
  const preset = ROLES[r.role] || ROLES.data;
  const tracks = r.role === "owner" ? TRACK_KEYS : (arr(r.tracks) || preset.tracks).filter((k) => TRACK_KEYS.includes(k));
  const perms = r.role === "owner" ? Object.keys(PERMS) : (arr(r.perms) || preset.perms).filter((k) => PERMS[k] && k !== "team");
  db.prepare("UPDATE team SET last_seen = ? WHERE email = ? AND (last_seen IS NULL OR last_seen < ?)")
    .bind(new Date().toISOString(), email, new Date(Date.now() - 120e3).toISOString()).run().catch(() => {});
  return { email, name: r.name || "", role: r.role, roleLabel: preset.label, tracks: new Set(tracks), perms: new Set(perms), owner: r.role === "owner" };
}
function full(email, roleLabel) { return { email, name: "", role: "owner", roleLabel, tracks: new Set(TRACK_KEYS), perms: new Set(Object.keys(PERMS)), owner: true }; }

export const can = (u, p) => !!(u && u.perms && u.perms.has(p));
export const trackOk = (u, track) => !!(u && u.tracks && u.tracks.has(track));
/** SQL fragment limiting deals (alias d) to the member's tracks. */
export function trackSql(u, alias = "d") {
  if (u.owner || u.tracks.size === TRACK_KEYS.length) return { sql: "1 = 1", vals: [] };
  if (!u.tracks.size) return { sql: "0 = 1", vals: [] };
  const t = [...u.tracks];
  return { sql: `${alias}.track IN (${t.map(() => "?").join(",")})`, vals: t };
}
/** May this member open the property? It must have a deal on one of their tracks; a property with no deals is open to
 *  people who add or import properties (so they can finish what they started). */
export async function propertyOk(db, u, pid) {
  if (u.owner) return true;
  const rows = (await db.prepare("SELECT track FROM deals WHERE property_id = ?").bind(pid).all()).results;
  if (!rows.length) return can(u, "add") || can(u, "import");
  return rows.some((r) => trackOk(u, r.track));
}
/** Remove phone numbers, emails and mailing addresses for members without the contacts permission. */
export function scrubContact(u, c) {
  if (!c || can(u, "contacts")) return c;
  return { ...c, phone: null, phone_key: null, email: null, phones: null, emails: null, mailing: null, cphone: null, cemail: null, consent_json: null };
}

/** What the page needs to know about the signed-in person. */
export function me(u) {
  return { email: u.email, name: u.name, role: u.role, roleLabel: u.roleLabel, owner: u.owner, tracks: [...u.tracks], perms: [...u.perms] };
}

/** /api/office/team… (owner only). */
export async function teamApi(db, m, seg, b, u, t, json) {
  await ensure(db);
  if (!can(u, "team")) return json({ ok: false, message: "Only the owner manages the team." }, 403);
  const clean = (s, n = 200) => String(s ?? "").trim().slice(0, n);
  if (m === "GET" && !seg[1]) {
    const rows = (await db.prepare("SELECT * FROM team ORDER BY active DESC, role = 'owner' DESC, name, email").all()).results
      .map((r) => ({ ...r, tracks: arr(r.tracks) || (ROLES[r.role] || ROLES.data).tracks, perms: arr(r.perms) || (ROLES[r.role] || ROLES.data).perms, custom: !!(r.tracks || r.perms) }));
    return json({ ok: true, members: rows, roles: ROLES, perms: PERMS, trackKeys: TRACK_KEYS, me: u.email });
  }
  if ((m === "POST" && !seg[1]) || (m === "PATCH" && seg[1])) {
    const email = (m === "POST" ? clean(b.email, 120) : decodeURIComponent(seg[1])).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, message: "Enter their email address (the one they'll sign in with)." }, 400);
    const cur = await db.prepare("SELECT * FROM team WHERE email = ?").bind(email).first();
    if (m === "POST" && cur && cur.active) return json({ ok: false, message: "That person is already on the team." }, 409);
    const role = b.role !== undefined ? clean(b.role, 20) : cur && cur.role;
    if (!ROLES[role]) return json({ ok: false, message: "Pick a role." }, 400);
    if (cur && cur.role === "owner" && (role !== "owner" || b.active === false)) {
      const n = (await db.prepare("SELECT COUNT(*) AS n FROM team WHERE role = 'owner' AND active = 1").first()).n;
      if (n <= 1) return json({ ok: false, message: "The team needs at least one owner." }, 400);
    }
    // Tracks and permissions: null means "the role's defaults"; a list overrides them for this person.
    const listOr = (v, keys) => v === null ? null : Array.isArray(v) ? JSON.stringify([...new Set(v.filter((k) => keys.includes(k)))]) : undefined;
    let tracks = listOr(b.tracks, TRACK_KEYS), perms = listOr(b.perms, Object.keys(PERMS).filter((k) => k !== "team"));
    if (role === "owner") { tracks = null; perms = null; }
    if (cur && b.role !== undefined && b.role !== cur.role && b.tracks === undefined) tracks = null; // role changed: back to its defaults
    if (cur && b.role !== undefined && b.role !== cur.role && b.perms === undefined) perms = null;
    const name = b.name !== undefined ? clean(b.name, 80) : cur && cur.name;
    const notes = b.notes !== undefined ? clean(b.notes, 1000) : cur && cur.notes;
    const active = b.active === undefined ? 1 : b.active ? 1 : 0;
    if (cur) {
      await db.prepare("UPDATE team SET name = ?, role = ?, tracks = ?, perms = ?, active = ?, notes = ?, updated_at = ? WHERE email = ?")
        .bind(name || null, role, tracks === undefined ? cur.tracks : tracks, perms === undefined ? cur.perms : perms, active, notes || null, t, email).run();
    } else {
      await db.prepare("INSERT INTO team (email, name, role, tracks, perms, active, notes, added_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)")
        .bind(email, name || null, role, tracks ?? null, perms ?? null, notes || null, u.email, t, t).run();
    }
    await db.prepare("INSERT INTO activities (id, at, kind, summary, by, source) VALUES (?, ?, 'team', ?, ?, 'office')")
      .bind("a_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16), t,
        `${cur ? (active ? "Team member updated" : "Team member deactivated") : "Team member added"}: ${name || email} (${ROLES[role].label})`, u.email).run();
    return json({ ok: true });
  }
  if (m === "DELETE" && seg[1]) {
    const email = decodeURIComponent(seg[1]).toLowerCase();
    const cur = await db.prepare("SELECT * FROM team WHERE email = ?").bind(email).first();
    if (!cur) return json({ ok: true });
    if (cur.role === "owner") {
      const n = (await db.prepare("SELECT COUNT(*) AS n FROM team WHERE role = 'owner' AND active = 1").first()).n;
      if (n <= 1) return json({ ok: false, message: "The team needs at least one owner." }, 400);
    }
    await db.prepare("DELETE FROM team WHERE email = ?").bind(email).run();
    await db.prepare("INSERT INTO activities (id, at, kind, summary, by, source) VALUES (?, ?, 'team', ?, ?, 'office')")
      .bind("a_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16), t, `Team member removed: ${cur.name || email}`, u.email).run();
    return json({ ok: true });
  }
  return json({ ok: false, message: "Not found." }, 404);
}
