// Agreement templates for the e-sign flow.
// Source text: "Seller Agreement Templates (Draft for Attorney Review)" doc. Keep the two in step:
// when the attorney changes wording there, change it here too, then set settings.agreements_approved = 'true'.
//
// render(vars) returns { title, html } for one envelope. vars come from the Deal Desk.

const BLANK = "__________";

export function render(v) {
  const kind = v.kind;
  const parts = [];
  if (kind === "LOI") {
    parts.push(heirshipLOI(v));
    return { title: "Heirship Letter of Intent (not binding)", html: parts.join("") };
  }
  const titles = { A: "Assignable Cash Purchase Agreement", B: "Option to Purchase Agreement", C: "Seller-Finance Purchase Agreement" };
  parts.push(`<h1>${esc(titles[kind] || "Purchase Agreement")}</h1>`);
  parts.push(`<p class="meta">Property: ${f(v.property_address)} · Reference ${f(v.ref)}</p>`);
  if (kind === "A") parts.push(agreementA(v));
  if (kind === "B") parts.push(agreementB(v));
  if (kind === "C") parts.push(agreementC(v));
  parts.push(commonTerms(v, kind));
  if ((v.owners || []).length > 1 || v.homestead_spouse) parts.push(multiOwner(v));
  if (v.estate) parts.push(estate(v));
  return { title: titles[kind] || "Purchase Agreement", html: parts.join("") };
}

function agreementA(v) {
  return sec("Agreement A: Assignable Cash Purchase", [
    `Used when the seller picks Option A. The Common Terms below are part of this Agreement.`,
    p("1. Price.", `Buyer will pay ${f(v.price)} in cash at closing. No financing contingency.`),
    p("2. Earnest money and option fee.", `Within 3 business days after the Effective Date, Buyer will deposit ${f(v.emd)} earnest money with the Title Company and pay Seller ${f(v.option_fee)} as an option fee. The option fee is Seller's to keep and is credited to the price at closing.`),
    p("3. Option period.", `For ${f(v.option_days)} days after the Effective Date, Buyer may terminate this Agreement for any reason by written notice to Seller. If Buyer does, the earnest money is returned to Buyer, Seller keeps the option fee, and neither party owes the other anything more.`),
    p("4. Closing.", `Closing will be at the Title Company on or before ${f(v.closing_date)} (${f(v.close_days)} days after the Effective Date). Buyer may move closing up to 15 days later once, by written notice, if the Title Company needs more time to clear title.`),
    p("5. Buyer's costs.", `Buyer pays all of Buyer's closing costs, the owner's title policy and any survey. Seller pays only to release Seller's own liens.`),
  ]);
}

function agreementB(v) {
  return sec("Agreement B: Option to Purchase", [
    `Used when the seller picks Option B. The Common Terms below are part of this Agreement, except that Common Terms §5 (title objections) and §7 (access) start on the Effective Date, and Common Terms §10 (default) is replaced by §6 below.`,
    p("1. Grant of option.", `For ${f(v.option_consideration)} paid to Seller when this Agreement is signed, Seller grants Buyer the exclusive right to buy the Property for ${f(v.price)} (the "Option"). The option consideration is Seller's to keep in every case and is credited to the price if Buyer buys.`),
    p("2. Option term.", `The Option lasts ${f(v.option_days)} days from the Effective Date and ends at 11:59 p.m. Central time on ${f(v.option_expires)}. Buyer exercises it by written notice to Seller before then. If Buyer does not, the Option ends and neither party owes the other anything more.`),
    p("3. After exercise.", `Closing will be at the Title Company within ${f(v.close_days_after_exercise)} days after Buyer's notice, on the terms in Common Terms §5–§9, for the price in §1, all cash.`),
    p("4. Seller keeps the Property until closing.", `Seller keeps possession, rents and income and stays responsible for taxes, insurance, loan payments and upkeep until closing. During the term Seller will not sell, lease for more than 12 months, or place any new lien or easement on the Property.`),
    p("5. Memorandum.", `Buyer may record a short memorandum of this Option in the county records. If the Option ends unexercised, Buyer will sign and record a release within 10 days of Seller's request.`),
    p("6. Default.", `If Seller fails to convey after a valid exercise, Buyer may seek specific performance or recover the option consideration plus Buyer's documented costs. Buyer has no obligation to buy; letting the Option expire is not a default.`),
    p("7. Assignment.", `Buyer may assign the Option itself, before or after exercise (Common Terms §4).`),
    `<p class="note">A notary acknowledgment for each Seller is needed only if Buyer records the memorandum; the Title Company can arrange it.</p>`,
  ]);
}

function agreementC(v) {
  const loan = v.existing_loan || "";
  const box = (k) => (loan === k ? "☒" : "☐");
  return sec("Agreement C: Seller-Finance Purchase", [
    `Used when the seller picks Option C. The Common Terms below are part of this Agreement. Seller transfers title at closing and Buyer pays the balance over time under a recorded note, so this is not a contract for deed.`,
    `<p><strong>1. Price and payment.</strong></p>`,
    table(["Term", "Amount"], [
      ["Purchase price", f(v.price)],
      ["Down payment at closing", f(v.down_payment)],
      ["Seller-financed balance", f(v.note_amount)],
      ["Interest rate", `${f(v.rate)}% fixed`],
      ["Term", `${f(v.years)} years, fully amortizing`],
      ["Monthly payment (principal and interest)", `${f(v.monthly_payment)}, first due ${f(v.first_payment_date)}`],
      ["Prepayment", "Allowed at any time without penalty"],
    ]),
    p("2. Earnest money and option period.", `Same as Agreement A §2–§3: ${f(v.emd)} earnest money, ${f(v.option_fee)} option fee and a ${f(v.option_days)}-day option period.`),
    p("3. Closing documents.", `At closing Seller signs a general warranty deed with vendor's lien to Buyer (or its assignee). Buyer signs a promissory note to Seller for the financed balance, secured by a first-lien deed of trust on the Property in favor of Seller, both on forms prepared by the Title Company. Buyer will keep the Property insured with Seller named as mortgagee and pay the taxes when due.`),
    p("4. Seller's existing loan.", `${box("none")} There is no loan on the Property. ${box("payoff")} Seller's existing loan of about ${f(v.existing_loan_balance)} will be paid off at closing from the down payment and Buyer's funds. ${box("subject")} The existing loan will stay in place and Seller's note will be junior or wrapped; Seller receives the notice required by Property Code §5.016 and acknowledges that the existing lender may have the right to call its loan due.`),
    p("5. Servicing.", `Payments go through ${f(v.servicer || "a third-party loan servicer chosen at closing")} (paid by Buyer) or directly to Seller, as Seller chooses at closing. Buyer will give Seller a year-end statement of interest paid.`),
    p("6. Late payment and default.", `A payment more than 15 days late incurs a late charge of 5% of that payment. If a payment stays unpaid 30 days after written notice, Seller may accelerate the note and foreclose under the deed of trust and Texas law.`),
    p("7. Assignment.", `Buyer may assign this Agreement before closing (Common Terms §4). After closing, Buyer may sell the Property only if the note is paid in full at that sale, unless Seller agrees in writing to an assumption.`),
  ]);
}

function commonTerms(v, kind) {
  const two = v.two_tract;
  return sec("Common Terms", [
    `These Common Terms are part of the Agreement above. If the two conflict, the Agreement controls.`,
    p("1. Parties.", `Seller: ${f((v.seller_names || []).join(", "))} (each a "Seller"; if more than one, all of them together). Buyer: House Lot &amp; Land Sales Co. LLC, a Texas limited liability company, and its assigns ("Buyer").`, true),
    p("2. Property.", `The land, improvements and fixtures at ${f(v.property_address)}, ${f(v.county)} County, Texas, legally described as ${f(v.legal_description || "shown in the title commitment")}, including all of Seller's rights in it (the "Property"). Reference no. ${f(v.ref)}.`),
    p("3. Disclosure under Texas Occupations Code §1101.0045.", `Buyer is entering into this Agreement to acquire an equitable interest in the Property. Buyer intends to market that interest and may assign this Agreement to another buyer before closing instead of taking title itself. Buyer is not acting as Seller's real estate broker or agent and does not represent Seller. Seller should get independent advice before signing.`),
    p("4. Assignment.", `Buyer may assign this Agreement, in whole or in part, without Seller's consent. Any assignee takes all of Buyer's rights and duties. Buyer stays responsible to Seller until closing. Seller's net proceeds do not change because of an assignment.`),
    p("5. Title.", `Seller will convey good and indefeasible title by general warranty deed (special warranty deed for an estate representative), free of liens except those Buyer agrees to in writing. Buyer will open escrow with a Texas title company of Buyer's choosing ("Title Company"). Buyer may object in writing to title, survey or HOA matters within ${f(v.title_review_days || 10)} days after receiving the title commitment. If Seller does not cure before closing, Buyer may terminate and receive the earnest money back.`),
    p("6. Condition: as-is.", `Buyer accepts the Property in its present condition, with no repairs required of Seller. Seller will deliver any disclosure Texas law requires (including the Seller's Disclosure Notice under Property Code §5.008 unless an exemption applies, and the federal lead-based paint disclosure for homes built before 1978). Seller states that, to Seller's knowledge, Seller has disclosed every known material defect.`),
    p("7. Access.", `From the Effective Date until closing, Seller will give Buyer, its assignees, inspectors, lenders and prospective buyers reasonable access to the Property with 24 hours' notice.`),
    p("8. Closing costs and prorations.", `Unless the Agreement says otherwise: Buyer pays its own closing costs and the owner's title policy; Seller pays to release Seller's liens and any Seller's attorney. Taxes, HOA dues and rents are prorated to the closing date.`),
    p("9. Possession.", `Seller delivers possession and all keys at funding, with the Property broom-clean and free of personal property Seller wants to keep, unless the parties agree in writing to a lease-back.`),
    kind === "B" ? "" : p("10. Default.", `If Buyer fails to close when required, Seller's only remedy is to keep the earnest money (or option consideration) as liquidated damages. If Seller fails to close, Buyer may seek specific performance, or terminate and get the earnest money back.`),
    p("11. Two-tract closing.", two
      ? `☒ Seller agrees that the Property may be surveyed and closed at the same time as two tracts, about ${f(two.tract1_acres)} acres and ${f(two.tract2_acres)} acres, each deeded to the buyer Buyer names. Seller's total price and net proceeds stay the same. Buyer pays for the survey and any plat or partition costs. If the split cannot be completed by the closing date, the parties close on the whole Property as one tract.`
      : `☐ Not used in this Agreement.`),
    p("12. Notices.", `Notices go to the email and mailing address under each party's signature. Email notice is effective when sent.`),
    p("13. Electronic signatures.", `Each party agrees to use electronic records and signatures for this Agreement under the Texas Uniform Electronic Transactions Act (Business &amp; Commerce Code ch. 322). Each signer may ask for a paper copy at no charge and may withdraw consent to electronic records for future documents. An electronic signature has the same effect as an ink signature. Counterparts together form one Agreement.`, true),
    p("14. General.", `Texas law governs. This is the parties' entire agreement; changes must be in writing and signed by both. Time is of the essence. If the last day of any period falls on a weekend or legal holiday, it moves to the next business day. "Effective Date" is the date the last party signs.`),
  ]);
}

function multiOwner(v) {
  const rows = (v.owners || []).map((o) => [esc(o.name), esc(o.share || ""), esc(o.email || ""), esc(o.phone || "")]);
  return sec("Multiple Owners Addendum", [
    p("1. All owners must sign.", `The owners of record, as shown in the county records and confirmed by the Title Company, are listed below. This Agreement binds no one until every listed owner has signed. If all listed owners have not signed within ${f(v.all_sign_days || 14)} days after the first signature, Buyer may withdraw by written notice and any earnest money is returned.`),
    table(["Owner of record", "Share (if known)", "Email", "Phone"], rows),
    p("2. Spouses and homestead.", `If the Property is the homestead of any owner, that owner's spouse must also sign, even if the spouse is not on the deed (Texas Family Code §5.001). ${v.homestead_spouse ? `The Property is a homestead and ${esc(v.homestead_spouse)} signs as spouse.` : ""}`, true),
    p("3. Owners we may not know about.", `Each signing owner states that, to their knowledge, the table above lists every person with an ownership interest. If a signing owner knows of anyone else, they will tell Buyer their name and how to reach them. Buyer may then add that person by a written amendment the other owners approve.`),
    p("4. Sharing the proceeds.", `The Title Company will split Seller's net proceeds among the owners by their shares of record, unless all owners give the Title Company written instructions otherwise.`),
    p("5. One owner may be the contact.", `The owners name ${f(v.contact_owner)} as their contact for scheduling and notices. Every owner still receives a copy of every notice. Only a document signed by all owners changes the price or terms.`),
  ]);
}

function estate(v) {
  const e = v.estate || {};
  return sec("Estate Sale Addendum", [
    p("1. Who is selling.", `Seller is ${f(e.representative_name)}, as ${f(e.role)} of the Estate of ${f(e.decedent_name)}, Cause No. ${f(e.cause_number)}, in the ${f(e.court_name)} of ${f(e.county || v.county)} County, Texas. The representative signs only in that capacity and has no personal liability under this Agreement. Any living co-owners of record also sign under the Multiple Owners Addendum.`),
    p("2. Proof of authority.", `Within 5 business days after the Effective Date, Seller will give Buyer and the Title Company current letters testamentary or letters of administration (issued or re-certified within the last 60 days) and a copy of the will, if any.`),
    p("3. Court approval when required.", `If the administration is dependent, or the Title Company requires it, this sale is subject to the probate court approving it under Estates Code ch. 356. Seller will apply for approval within 10 days after the Effective Date and pursue it diligently. Closing will occur within 10 days after the order approving the sale becomes final. If approval is denied, or not obtained within ${f(e.approval_days || 90)} days, either party may terminate and the earnest money is returned to Buyer.`),
    p("4. Muniment of title (no representative).", `If the will was probated as a muniment of title, there is no executor. The devisees named in the will and the order sign as Seller under the Multiple Owners Addendum instead of a representative.`),
    p("5. Deed and disclosures.", `Seller conveys by executor's or administrator's deed with special warranty. Seller's Disclosure Notice is not required from a representative who has never occupied the Property (Property Code §5.008(e)), but Seller will share any known defects.`),
    p("6. Estate debts and taxes.", `Any estate debts, taxes or liens payable from the sale are paid from Seller's proceeds at closing, as the Title Company requires.`),
  ]);
}

function heirshipLOI(v) {
  return `<h1>Heirship Letter of Intent</h1><p class="meta">Property: ${f(v.property_address)} · Reference ${f(v.ref)} · <strong>Not binding</strong></p>` +
    sec("Letter of Intent (non-binding)", [
      `<p><strong>Nothing here is a contract or an offer that can be accepted.</strong> It records that the undersigned want to sell and who they are, so title can be cleared. A binding agreement follows once the Title Company confirms who can sign.</p>`,
      `<p>The undersigned believe they are heirs of ${f(v.decedent_name)}, who died on or about ${f(v.date_of_death)} and owned ${f(v.property_address)}. They are interested in selling the Property to House Lot &amp; Land Sales Co. LLC or its assigns on the terms of ${f(v.chosen_option_name)} (${f(v.price)}), as shown at ${f(v.offer_link)}. They understand that:</p>`,
      `<ol><li>This letter is not binding on anyone and can be withdrawn at any time.</li>
       <li>Before a sale, the heirs must be established. This is usually done with an Affidavit of Heirship signed before a notary by two people who knew the family but will not inherit (Estates Code §203.001), or by a court order. Buyer may help arrange this at Buyer's cost.</li>
       <li>Every heir with an interest (or their representative) will need to sign the final agreement and deed. An heir under 18 cannot sign; a court-appointed guardian or a court order is needed for that share.</li>
       <li>Buyer is not their attorney and does not advise them about inheritance, taxes or family matters.</li></ol>`,
      `<p>Each heir signs separately; one signature is enough to start.</p>`,
    ]);
}

/* helpers */
function sec(title, items) { return `<section class="agr"><h2>${esc(title)}</h2>${items.filter(Boolean).map((x) => (x.startsWith("<") ? x : `<p>${x}</p>`)).join("")}</section>`; }
function p(head, body, raw) { return `<p><strong>${esc(head)}</strong> ${raw ? body : body}</p>`; }
function table(head, rows) {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function f(x) { return x === undefined || x === null || x === "" ? `<span class="blank">${BLANK}</span>` : `<span class="fill">${esc(String(x))}</span>`; }
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
