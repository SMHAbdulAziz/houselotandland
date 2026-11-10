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
export function propertyKey({ address, city, zip, name } = {}) {
  const st = normStreet(address);
  const c = String(city || "").toLowerCase().replace(/[^a-z ]/g, "").trim();
  if (/^\d/.test(st)) return zip5(zip) ? `${st}|${zip5(zip)}` : `${st}|${c}`;
  const n = String(name || address || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return n ? `name:${n}|${c}` : "";
}
/**
 * One-line address -> parts. "3917 Holliday Rd, Dallas, TX 75211, USA" -> { address: "3917 Holliday Rd", city: "Dallas", zip: "75211", state: "TX" }.
 * Shared by the back office (imports) and the Worker (repairs and server-side imports).
 */
export function splitAddr(s) {
  const parts = String(s || "").split(",").map((x) => x.trim()).filter(Boolean).filter((x) => !/^(USA|United States)$/i.test(x));
  const o = { address: parts[0] || "", city: "", zip: "", state: "" };
  const last = parts[parts.length - 1] || "", zm = last.match(/\b(\d{5})(?:-\d{4})?\b/), sm = last.match(/\b([A-Z]{2})\b/);
  if (zm) o.zip = zm[1];
  if (sm && parts.length >= 2) o.state = sm[1];
  if (parts.length >= 3) o.city = parts[parts.length - 2]; else if (parts.length === 2 && !zm && !/^[A-Z]{2}$/.test(parts[1])) o.city = parts[1];
  if (parts.length === 2 && zm) o.city = parts[1].replace(/\b[A-Z]{2}\b\s*\d{5}.*$/, "").trim();
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
