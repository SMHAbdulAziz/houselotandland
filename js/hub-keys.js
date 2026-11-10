// Matching keys for the master list (D1 "hub" tables). Shared by the Worker, the back office and
// import scripts, so the same address or phone always produces the same key and nothing is duplicated.

const SUFFIX = {
  street: "st", st: "st", drive: "dr", dr: "dr", road: "rd", rd: "rd", avenue: "ave", ave: "ave", av: "ave",
  lane: "ln", ln: "ln", boulevard: "blvd", blvd: "blvd", court: "ct", ct: "ct", place: "pl", pl: "pl",
  highway: "hwy", hwy: "hwy", parkway: "pkwy", pkwy: "pkwy", trail: "trl", trl: "trl", circle: "cir", cir: "cir",
  terrace: "ter", ter: "ter", way: "way", freeway: "fwy", fwy: "fwy", expressway: "expy", expy: "expy",
  "farm-to-market": "fm", "farm to market": "fm", fm: "fm", business: "bus", bus: "bus", bnd: "bnd", bend: "bnd",
  north: "n", south: "s", east: "e", west: "w", n: "n", s: "s", e: "e", w: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
};

/** Normalized street line: "1228 English Street" -> "1228 english st". Drops unit/suite numbers. */
export function normStreet(s) {
  let t = String(s || "").toLowerCase().replace(/farm[\s-]+to[\s-]+market(\s+road)?/g, "fm").replace(/[.,#]/g, " ");
  t = t.replace(/\b(apt|unit|suite|ste|lot|space|spc)\b.*$/, "");
  return t.split(/\s+/).filter(Boolean).map((w) => SUFFIX[w] || w).join(" ").trim();
}
export function zip5(z) {
  const m = String(z || "").match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : "";
}
/**
 * Property key. Street + ZIP when the ZIP is known, else street + city. A property with no street
 * (an RV park listing known only by name) uses its name + city.
 */
export function propertyKey({ address, city, zip, name, state } = {}) {
  const st = normStreet(address);
  const c = String(city || "").toLowerCase().replace(/[^a-z ]/g, "").trim();
  // ZIP codes are unique nationwide. City-based keys add the state outside Texas (Texas keys keep their original form).
  const s2 = normState(state) || zipState(zip), sfx = s2 && s2 !== "TX" ? `|${s2.toLowerCase()}` : "";
  if (/^\d/.test(st)) return zip5(zip) ? `${st}|${zip5(zip)}` : `${st}|${c}${sfx}`;
  const n = String(name || address || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return n ? `name:${n}|${c}${sfx}` : "";
}
/** US states, DC and Puerto Rico: code -> name. */
export const US_STATES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico" };
/** "tx", "Texas" -> "TX"; anything else -> "". */
export function normState(s) {
  const t = String(s || "").trim(); if (!t) return "";
  const u = t.toUpperCase(); if (US_STATES[u]) return u;
  const hit = Object.entries(US_STATES).find(([, n]) => n.toLowerCase() === t.toLowerCase());
  return hit ? hit[0] : "";
}
// State from the first three ZIP digits (USPS ranges). A best guess for when no state was given; always editable.
const ZIP3 = [[5, 5, "NY"], [6, 9, "PR"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"], [55, 55, "MA"], [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"],
  [150, 196, "PA"], [197, 199, "DE"], [200, 200, "DC"], [201, 201, "VA"], [202, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"],
  [300, 319, "GA"], [398, 399, "GA"], [320, 349, "FL"], [350, 369, "AL"], [370, 385, "TN"], [386, 397, "MS"], [400, 427, "KY"], [430, 459, "OH"], [460, 479, "IN"], [480, 499, "MI"],
  [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"],
  [700, 714, "LA"], [716, 729, "AR"], [733, 733, "TX"], [730, 749, "OK"], [750, 799, "TX"], [885, 885, "TX"], [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
  [850, 865, "AZ"], [870, 884, "NM"], [889, 898, "NV"], [900, 961, "CA"], [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"]];
export function zipState(zip) {
  const z = zip5(zip); if (!z) return "";
  const n = +z.slice(0, 3), hit = ZIP3.find(([a, b]) => n >= a && n <= b);
  return hit ? hit[2] : "";
}
/**
 * One-line address -> parts. "3917 Holliday Rd, Dallas, TX 75211, USA" -> { address: "3917 Holliday Rd", city: "Dallas", zip: "75211", state: "TX" }.
 * Shared by the back office (imports) and the Worker (repairs and server-side imports).
 */
export function splitAddr(s) {
  const parts = String(s || "").split(",").map((x) => x.trim()).filter(Boolean).filter((x) => !/^(USA|United States)$/i.test(x));
  const o = { address: parts[0] || "", city: "", zip: "", state: "" };
  const last = parts[parts.length - 1] || "", zm = last.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zm) o.zip = zm[1];
  if (parts.length >= 2) o.state = normState(last.replace(/\d{5}(-\d{4})?/, "").trim()) || zipState(o.zip);
  if (parts.length >= 3) o.city = parts[parts.length - 2]; else if (parts.length === 2 && !zm && !/^[A-Z]{2}$/.test(parts[1])) o.city = parts[1];
  if (parts.length === 2 && zm) o.city = parts[1].replace(/\b[A-Z]{2}\b\s*\d{5}.*$/, "").replace(/\s*\d{5}(-\d{4})?$/, "").trim();
  if (normState(o.city) && parts.length === 2) o.city = "";
  if (/^[A-Z]{2}$/.test(o.city)) o.city = "";
  return o;
}
/** Last 10 digits of a US phone, or "" when it isn't a phone number. */
export function phoneKey(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}
export function emailKey(e) {
  const t = String(e || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : "";
}
export function fmtPhone(p) {
  const k = phoneKey(p);
  return k ? `(${k.slice(0, 3)}) ${k.slice(3, 6)}-${k.slice(6)}` : String(p || "").trim();
}

// Deal tracks and the stages each one uses (each dashboard keeps its own stage names).
export const TRACKS = {
  wholesale: { label: "Wholesale", stages: ["Lead", "Analyzing", "Offer sent", "Under contract", "Marketing", "Assigned", "Closed", "Dead"] }, // same as the Deal Desk
  subto: { label: "Sub-To", stages: ["New", "Contacted", "Appointment", "Offer sent", "Under contract", "Closed", "Dead"] },
  creative: { label: "Creative finance", stages: ["New lead", "Contacted", "Terms requested", "Underwriting", "Offer out", "Under contract", "Closed", "Dead"] },
  funding: { label: "Funding", stages: ["New", "Reviewing", "Docs requested", "With lender", "Approved", "Funded", "Declined", "Withdrawn"] },
  services: { label: "Services", stages: ["Requested", "Scheduled", "In progress", "Completed", "Cancelled"] },
};
export const CLOSED_STAGES = new Set(["Closed", "Dead", "Assigned", "Funded", "Declined", "Withdrawn", "Completed", "Cancelled"]);
