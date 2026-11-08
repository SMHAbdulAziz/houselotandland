// House Lot & Land service catalog: prices, packages and document questionnaires.
// Used by the service pages (to show prices and build forms) and by the Worker (src/services.js), which always
// recomputes the price from this file, so a visitor can't change what they pay.
// PRICES ARE DRAFTS FOR HARVEY'S APPROVAL (Nov 2026). Change them here only.

export const STATES_EXCLUDED_WATCH = []; // Property Watch: North Texas field work, quoted case by case outside it.

/* ---------------- Homestead Trust (Texas) ---------------- */
export const HOMESTEAD = {
  price: 349,
  addOns: {
    recording: { label: "We record the deed for you (county recording fees billed at cost)", price: 75 },
    rush: { label: "Rush: documents ready within 1 business day", price: 49 },
  },
  includes: [
    "Revocable living trust agreement written to qualify your home for the Texas homestead exemption (Tax Code §11.13(j))",
    "Deed transferring your home into the trust, ready to sign before a notary and record",
    "Certification of trust (Property Code §114.086) to show title companies and lenders",
    "Step-by-step signing, notary, recording and appraisal-district instructions",
  ],
};

/* ---------------- Curb Appeal packages ---------------- */
// Labor guide = target crew payout (what Harvey pays the worker), shown on the Deal Desk only.
export const CURB = {
  refresh: {
    name: "Refresh", price: 299, laborGuide: 140, hours: "3-4 crew hours",
    items: ["Mow, edge and string-trim front and back yard", "Weed and tidy front flower beds", "Pressure wash front walkway and porch", "Blow off driveway, walks and porch", "Bag and haul yard debris (up to 10 bags)"],
  },
  showcase: {
    name: "Showcase", price: 599, laborGuide: 280, hours: "1 crew day",
    items: ["Everything in Refresh", "Trim shrubs and small trees (up to 8 ft)", "Fresh mulch in front beds (up to 3 cubic yards included)", "Pressure wash driveway, walks, porch and front of house (1 story)", "Clean gutters (1 story)", "Wipe down front door, light fixtures and mailbox"],
  },
  makeover: {
    name: "Full Makeover", price: 1199, laborGuide: 560, hours: "2 crew days",
    items: ["Everything in Showcase", "Paint front door and touch up front trim", "New house numbers and doormat", "Plant 2 flats of seasonal color", "Replace or repaint mailbox", "One trailer load of haul-off (junk, limbs, old fencing)"],
  },
};
// Lot size: package prices cover up to 1/4 acre. Mowing, trimming and blowing cover the whole lot, so the price
// steps up by size; over 2 acres is quoted after we review the property. "overgrown" = grass over 12 inches.
export const CURB_LOT = {
  q1: { label: "Up to 1/4 acre", price: 0, overgrown: 79 },
  q2: { label: "1/4 to 1/2 acre", price: 99, overgrown: 79 },
  a1: { label: "1/2 to 1 acre", price: 199, overgrown: 149 },
  a2: { label: "1 to 2 acres", price: 349, overgrown: 249 },
  big: { label: "Over 2 acres", price: null, overgrown: null }, // custom quote
};
export const CURB_LABOR_SHARE = 0.47; // crew payout guide for lot and overgrown charges (Deal Desk only)
export const CURB_ADDONS = {
  backyard: { label: "Backyard beds and shrubs too", price: 149 },
  fence: { label: "Pressure wash wood fence (up to 100 ft)", price: 129 },
  windows: { label: "Exterior window washing (1 story)", price: 119 },
};
// Work we don't do (needs a Texas license or specialty insurance).
export const CURB_EXCLUDED = ["Irrigation repair", "Electrical work", "Pesticide or herbicide application for hire", "Tree work near power lines", "Roof work"];

/* ---------------- Contract Drafting (Texas real estate documents) ---------------- */
export const CONTRACT_PLANS = {
  single: { name: "Pay per document", price: null, note: "$29 or $49 per document" },
  starter: { name: "Starter", price: 19, interval: "month", docs: 3, note: "Up to 3 documents a month" },
  investor: { name: "Investor", price: 49, interval: "month", docs: 0, note: "Unlimited documents" },
};

const F = (name, label, type = "text", extra = {}) => ({ name, label, type, ...extra });
const PARTY = (p, l) => [F(p + "_name", l + " full legal name", "text", { required: true }), F(p + "_address", l + " mailing address", "text")];
const PROP = [F("property_address", "Property street address, city, ZIP", "text", { required: true }), F("county", "County", "text", { required: true }), F("legal_description", "Legal description (from the deed or appraisal district; optional)", "textarea")];

export const DOCS = {
  loi: { title: "Letter of Intent to Purchase", price: 29, blurb: "A non-binding offer letter that sets out price and key terms before a contract.",
    fields: [...PARTY("buyer", "Buyer"), ...PARTY("seller", "Seller"), ...PROP.slice(0, 2), F("price", "Offered price ($)", "money", { required: true }), F("earnest", "Earnest money ($)", "money"), F("close_days", "Days to close after contract", "number"), F("inspection_days", "Inspection / option period (days)", "number"), F("expires", "Offer good until", "date", { required: true }), F("other_terms", "Other terms", "textarea")] },
  assignment: { title: "Assignment of Purchase Contract", price: 49, blurb: "Assign your rights under a purchase contract to another buyer for an assignment fee.",
    fields: [...PARTY("assignor", "Assignor (you)"), ...PARTY("assignee", "Assignee (new buyer)"), F("seller_name", "Seller name in the original contract", "text", { required: true }), F("contract_date", "Date of the original contract", "date", { required: true }), ...PROP.slice(0, 2), F("fee", "Assignment fee ($)", "money", { required: true }), F("fee_timing", "When the fee is paid", "select", { options: ["At closing, through the title company", "Non-refundable deposit now, balance at closing", "In full when this assignment is signed"] }), F("deposit", "Non-refundable deposit ($, if any)", "money"), F("title_company", "Title company", "text")] },
  memorandum: { title: "Memorandum of Contract", price: 29, blurb: "A short notice for the county records that a purchase contract exists.",
    fields: [...PARTY("buyer", "Buyer"), ...PARTY("seller", "Seller"), ...PROP, F("contract_date", "Contract date", "date", { required: true }), F("expires", "Contract expiration or closing deadline", "date")] },
  release: { title: "Mutual Release of Purchase Contract", price: 29, blurb: "Both sides cancel a purchase contract and agree what happens to earnest money.",
    fields: [...PARTY("buyer", "Buyer"), ...PARTY("seller", "Seller"), ...PROP.slice(0, 2), F("contract_date", "Contract date", "date", { required: true }), F("earnest_to", "Earnest money goes to", "select", { options: ["Buyer", "Seller", "Split as stated below", "No earnest money was deposited"] }), F("earnest_split", "Split details (if split)", "text"), F("title_company", "Title company holding earnest money", "text")] },
  option: { title: "Option to Purchase Agreement", price: 49, blurb: "Buy the right (not the obligation) to purchase a property at a set price within a set time.",
    fields: [...PARTY("optionee", "Buyer of the option (optionee)"), ...PARTY("owner", "Owner (optionor)"), ...PROP, F("option_fee", "Option fee ($)", "money", { required: true }), F("credit_fee", "Is the option fee credited to the price at closing?", "select", { options: ["Yes", "No"] }), F("price", "Purchase price if exercised ($)", "money", { required: true }), F("expires", "Option expires on", "date", { required: true }), F("close_days", "Days to close after exercise", "number")] },
  vacate: { title: "Notice to Vacate (Texas)", price: 29, blurb: "Written notice to vacate before filing an eviction, under Texas Property Code §24.005.",
    fields: [...PARTY("landlord", "Landlord"), F("tenant_names", "Tenant name(s) and all adult occupants", "text", { required: true }), ...PROP.slice(0, 2), F("reason", "Reason", "select", { options: ["Nonpayment of rent", "Lease violation", "Lease ended / holding over", "Other"] }), F("amount_due", "Amount due, if nonpayment ($)", "money"), F("notice_days", "Days to vacate (at least 3 unless the lease says otherwise)", "number", { required: true }), F("delivery", "How the notice is delivered", "select", { options: ["Personal delivery to the tenant or a person 16+ at the premises", "Mail (first class, registered or certified)", "Affixed to the inside of the main entry door", "Affixed to the outside of the main entry door (only if allowed by §24.005)"] })] },
  billofsale: { title: "Bill of Sale (personal property)", price: 29, blurb: "Transfer appliances, furniture, equipment or a manufactured home's contents with a sale.",
    fields: [...PARTY("seller", "Seller"), ...PARTY("buyer", "Buyer"), F("items", "Items sold (one per line)", "textarea", { required: true }), F("price", "Price ($)", "money", { required: true }), F("as_is", "Sold as-is?", "select", { options: ["Yes, as-is with no warranties", "No, seller gives the warranties written below"] }), F("warranty", "Warranty terms (if any)", "textarea")] },
  note: { title: "Promissory Note (business purpose)", price: 49, blurb: "A written promise to repay a business loan between investors, partners or companies.",
    fields: [...PARTY("borrower", "Borrower"), ...PARTY("lender", "Lender"), F("principal", "Amount borrowed ($)", "money", { required: true }), F("rate", "Annual interest rate (%)", "number", { required: true }), F("payments", "Repayment", "select", { options: ["One lump sum at maturity", "Monthly interest only, principal at maturity", "Monthly principal and interest"] }), F("maturity", "Maturity date", "date", { required: true }), F("late_fee", "Late fee ($, optional)", "money"), F("purpose", "Business purpose of the loan", "text", { required: true })] },
  contractor: { title: "Independent Contractor Agreement", price: 49, blurb: "Hire a worker or crew for a property job as an independent contractor.",
    fields: [...PARTY("company", "Hiring company or person"), ...PARTY("contractor", "Contractor"), F("work", "Work to be done", "textarea", { required: true }), F("property_address", "Job address", "text"), F("pay", "Pay ($) and how it's calculated", "text", { required: true }), F("pay_when", "When paid", "select", { options: ["When the job is complete and approved", "Weekly for work completed", "Per the milestones below"] }), F("start", "Start date", "date"), F("insurance", "Contractor carries general liability insurance?", "select", { options: ["Yes", "No"] })] },
  lease: { title: "Residential Lease (Texas)", price: 49, blurb: "A plain-English Texas residential lease with the disclosures the Property Code requires.",
    fields: [...PARTY("landlord", "Landlord"), F("tenant_names", "Tenant name(s)", "text", { required: true }), ...PROP.slice(0, 2), F("start", "Lease start", "date", { required: true }), F("end", "Lease end", "date", { required: true }), F("rent", "Monthly rent ($)", "money", { required: true }), F("due_day", "Rent due on day", "number", { required: true }), F("deposit", "Security deposit ($)", "money", { required: true }), F("late_fee", "Late fee ($; Texas caps it, see note)", "money"), F("pets", "Pets", "select", { options: ["No pets", "Pets allowed with written approval"] }), F("utilities", "Utilities the tenant pays", "text"), F("flood_known", "Is the landlord aware the dwelling is in a 100-year floodplain?", "select", { options: ["No", "Yes", "Not aware"] }), F("flooded", "Has the dwelling flooded in the last 5 years (to the landlord's knowledge)?", "select", { options: ["No", "Yes"] }), F("manager", "Property manager name and address (if any)", "text")] },
};

/* ---------------- Vacant Property Watch (institutional quote) ---------------- */
export const WATCH = {
  visit: { monthly: 1, biweekly: 2, weekly: 4 },
  perVisit: 45, // recurring vacant inspection with photo report (HUD's vacant follow-up allowance is $45 first unit)
  initial: 65,  // first visit: full photo baseline, occupancy check, lockbox/key log
  volume: [[100, 0.20], [50, 0.15], [10, 0.10]], // property count -> discount
  outsideCore: 15, // per visit, outside Dallas/Tarrant/Collin/Denton
  addOns: {
    lawn: { label: "Grass cuts (twice a month, March-November)", unit: "per cut", price: 95 },
    winterize: { label: "Winterization (dry)", unit: "per unit", price: 150 },
    rekey: { label: "Lock change at takeover", unit: "per property", price: 65 },
    debris: { label: "Debris removal", unit: "per cubic yard", price: 55 },
    utilities: { label: "Utility transfer and monitoring", unit: "per property / month", price: 10 },
    pool: { label: "Pool or spa securing", unit: "per property", price: 200 },
  },
};
export function watchQuote({ properties, frequency, core, addOns = [] } = {}) {
  const n = Math.max(1, Math.min(10000, parseInt(properties, 10) || 1));
  const v = WATCH.visit[frequency] || 2;
  const disc = (WATCH.volume.find(([min]) => n >= min) || [0, 0])[1];
  const perVisit = WATCH.perVisit + (core === false ? WATCH.outsideCore : 0);
  const monthlyPer = perVisit * v * (1 - disc);
  const utilities = addOns.includes("utilities") ? WATCH.addOns.utilities.price : 0;
  const monthly = Math.round((monthlyPer + utilities) * n);
  const onboarding = Math.round((WATCH.initial + (addOns.includes("rekey") ? WATCH.addOns.rekey.price : 0)) * n);
  return { properties: n, visitsPerMonth: v, discount: disc, perVisit, monthlyPerProperty: Math.round((monthlyPer + utilities) * 100) / 100, monthly, onboarding };
}

// Returns null when the job must be quoted (lot over 2 acres) or the package is unknown.
export function curbTotal(pkg, addOns = [], lot = "q1", overgrown = false) {
  const p = CURB[pkg], l = CURB_LOT[lot] || CURB_LOT.q1; if (!p || l.price == null) return null;
  return p.price + l.price + (overgrown ? l.overgrown : 0) + addOns.filter((a) => CURB_ADDONS[a]).reduce((s, a) => s + CURB_ADDONS[a].price, 0);
}
export function curbLaborGuide(pkg, lot = "q1", overgrown = false) {
  const p = CURB[pkg], l = CURB_LOT[lot] || CURB_LOT.q1; if (!p || l.price == null) return null;
  return Math.round(p.laborGuide + (l.price + (overgrown ? l.overgrown : 0)) * CURB_LABOR_SHARE);
}
export function homesteadTotal(addOns = []) {
  return HOMESTEAD.price + addOns.filter((a) => HOMESTEAD.addOns[a]).reduce((s, a) => s + HOMESTEAD.addOns[a].price, 0);
}
