// Texas real estate document templates for the Homestead Trust and Contract Drafting services.
// DRAFTS FOR ATTORNEY REVIEW. Until settings.legal_templates_approved = 'true', every document is stamped DRAFT
// and the service pages take waitlist sign-ups instead of orders (test orders still work). See src/services.js.
//
// Texas Gov't Code §81.101(c): a computer software product that clearly and conspicuously states it is not a
// substitute for an attorney's advice is not the practice of law. Every document and page carries that statement.
// The customer answers the questions; the software fills the attorney-approved template. Nobody here gives legal advice.

import { DOCS } from "../js/services-catalog.js";

export const DISCLAIMER = "This document was produced by self-help document software from House Lot & Land Sales Co. LLC. House Lot & Land Sales Co. LLC is not a law firm, does not give legal advice, and this software is not a substitute for the advice of an attorney.";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const v = (a, k, blank = "________________") => (a[k] !== undefined && a[k] !== null && String(a[k]).trim() !== "" ? esc(a[k]) : blank);
const money = (n) => { const x = parseFloat(String(n ?? "").replace(/[$,]/g, "")); return isFinite(x) ? "$" + x.toLocaleString("en-US", { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 }) : "$__________"; };
const date = (d) => { if (!d) return "________________"; const t = new Date(String(d) + "T12:00:00Z"); return isNaN(t) ? esc(d) : t.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); };
const lines = (s) => esc(s).split(/\r?\n/).filter(Boolean).map((x) => `<li>${x}</li>`).join("");
const sig = (who, name) => `<div class="sig"><div class="line"></div><div>${who}: ${name}</div><div class="line short"></div><div>Date</div></div>`;
const notary = (name) => `<div class="notary"><p><b>STATE OF TEXAS</b><br><b>COUNTY OF ____________________</b></p>
  <p>This instrument was acknowledged before me on ____________________, 20____, by ${name}.</p>
  <div class="sig"><div class="line"></div><div>Notary Public, State of Texas</div></div></div>`;
const confidentiality = `<p class="caps"><b>NOTICE OF CONFIDENTIALITY RIGHTS: IF YOU ARE A NATURAL PERSON, YOU MAY REMOVE OR STRIKE ANY OR ALL OF THE FOLLOWING INFORMATION FROM ANY INSTRUMENT THAT TRANSFERS AN INTEREST IN REAL PROPERTY BEFORE IT IS FILED FOR RECORD IN THE PUBLIC RECORDS: YOUR SOCIAL SECURITY NUMBER OR YOUR DRIVER'S LICENSE NUMBER.</b></p>`;
const propBlock = (a) => `<p><b>Property:</b> ${v(a, "property_address")}, ${v(a, "county")} County, Texas${a.legal_description ? `, more particularly described as: ${esc(a.legal_description)}` : ""}.</p>`;

/* ---------------- Homestead Trust package (3 documents) ---------------- */
// Answers (from homestead-trust.html): settlor_name, spouse_name (if married and spouse joins), marital ("single"|"married"),
// trust_name, trustee_name (default settlor), successor_trustee, successor_address, beneficiaries (lines), property_address,
// county, legal_description (required for the deed), mailing_address, has_mortgage, sign_date (optional).
export function homesteadDocs(a) {
  const settlors = a.marital === "married" && a.spouse_name ? `${esc(a.settlor_name)} and ${esc(a.spouse_name)}` : v(a, "settlor_name");
  const plural = a.marital === "married" && a.spouse_name;
  const trustName = v(a, "trust_name");
  const trustees = a.trustee_name ? esc(a.trustee_name) : settlors;
  const trust = `<h1>${trustName}</h1><h2>Revocable Living Trust Agreement</h2>
  <p>This Trust Agreement is made by ${settlors} (${plural ? "together, the &ldquo;Settlors,&rdquo; and each a &ldquo;Settlor&rdquo;" : "the &ldquo;Settlor&rdquo;"}), and ${trustees}, as trustee (the &ldquo;Trustee&rdquo;). The trust is named <b>${trustName}</b>.</p>
  <h3>1. Trust property</h3><p>The Settlor transfers to the Trustee the residence described below, together with any property later added, to hold under this Agreement:</p>${propBlock(a)}
  <h3>2. Right to occupy the residence (Texas Tax Code §11.13(j))</h3>
  <p>The Settlor has the right to use and occupy the residence as the Settlor's principal residence <b>rent free and without charge except for taxes and other costs and expenses specified in this Agreement</b>, for the Settlor's life, or until the date this trust is revoked or terminated by an instrument that describes the residence with sufficient certainty to identify it and that is recorded in the real property records of the county in which the residence is located. While the Settlor occupies the residence, the Settlor shall pay the property taxes, insurance, ordinary maintenance and any mortgage payments on it. The Settlor intends the residence to qualify as the Settlor's residence homestead under Texas law, including Section 11.13(j) of the Texas Tax Code, and this Agreement shall be read to achieve that result.</p>
  <h3>3. Revocation and amendment</h3><p>This trust is <b>revocable</b>. The Settlor may revoke or amend it, in whole or in part, by a signed writing delivered to the Trustee${plural ? "; while both Settlors are living, either Settlor may revoke it as to that Settlor's interest in community property" : ""}. A revocation or termination that affects the residence shall describe the residence with sufficient certainty to identify it and shall be recorded in the real property records of the county where the residence is located.</p>
  <h3>4. Trustee powers</h3><p>The Trustee has all the powers granted a trustee by Subchapter A, Chapter 113, Texas Property Code, and the Texas Trust Code generally, including the power to sell, lease, mortgage and insure trust property. No bond is required of any trustee.</p>
  <h3>5. Successor trustee</h3><p>If the Trustee dies, resigns or becomes unable to serve, <b>${v(a, "successor_trustee")}</b>${a.successor_address ? `, of ${esc(a.successor_address)}` : ""}, shall serve as successor trustee. A physician's written statement that a trustee is unable to manage his or her affairs is sufficient evidence of inability to serve.</p>
  <h3>6. During the Settlor's lifetime</h3><p>The Trustee shall hold the trust property for the benefit of the Settlor and may distribute income and principal to or for the Settlor as the Settlor directs.</p>
  <h3>7. After the Settlor's death</h3><p>${plural ? "After the death of the first Settlor, the trust continues for the surviving Settlor on the same terms. After the death of the surviving Settlor" : "After the Settlor's death"}, the Trustee shall pay the Settlor's final expenses and debts that are properly payable from the trust and distribute the remaining trust property to the following beneficiaries, in equal shares unless stated otherwise, the share of any beneficiary who does not survive the Settlor to pass to that beneficiary's descendants, per stirpes, or if none, to the other beneficiaries:</p><ul>${lines(a.beneficiaries) || "<li>________________</li>"}</ul>
  <h3>8. Spendthrift provision</h3><p>To the extent permitted by Section 112.035 of the Texas Property Code, no beneficiary other than a Settlor may transfer or assign an interest in this trust before receiving it, and no beneficiary's interest is subject to the claims of that beneficiary's creditors before distribution.</p>
  <h3>9. Governing law</h3><p>This Agreement is governed by the laws of the State of Texas.</p>
  <p>Signed on ${a.sign_date ? date(a.sign_date) : "____________________, 20____"}.</p>
  ${sig(plural ? "Settlor" : "Settlor", esc(a.settlor_name))}${plural ? sig("Settlor", esc(a.spouse_name)) : ""}${sig("Trustee", trustees)}
  ${notary(settlors)}`;

  const deed = `${confidentiality}<h1>Warranty Deed to Trustee</h1>
  <p><b>Date:</b> ____________________, 20____</p>
  <p><b>Grantor:</b> ${settlors}${plural ? ", spouses" : ""}${a.mailing_address ? `, whose mailing address is ${esc(a.mailing_address)}` : ""}</p>
  <p><b>Grantee:</b> ${trustees}, Trustee of the ${trustName}, dated ____________________, 20____${a.mailing_address ? `, whose mailing address is ${esc(a.mailing_address)}` : ""}</p>
  <p><b>Consideration:</b> Ten Dollars and other good and valuable consideration, the receipt of which is acknowledged. This conveyance is a transfer to the Grantor's revocable trust.</p>
  <p><b>Property (including any improvements):</b> ${a.legal_description ? esc(a.legal_description) : "<i>[Legal description exactly as it appears on the Grantor's current deed]</i>"}, ${v(a, "county")} County, Texas, commonly known as ${v(a, "property_address")}.</p>
  <p><b>Reservations from and exceptions to conveyance and warranty:</b> Liens described as part of the consideration, if any; validly existing easements, rights-of-way, restrictions, and other matters of record affecting the Property; and taxes for the current year, which Grantee assumes.</p>
  <p>Grantor, for the consideration and subject to the reservations from and exceptions to conveyance and warranty, grants, sells, and conveys to Grantee the Property, together with all and singular the rights and appurtenances thereto in any way belonging, to have and to hold it to Grantee and Grantee's successors and assigns forever. Grantor binds Grantor and Grantor's heirs and successors to warrant and forever defend all and singular the Property to Grantee and Grantee's successors and assigns against every person whomsoever lawfully claiming or to claim the same or any part thereof, except as to the reservations from and exceptions to conveyance and warranty.</p>
  <p>The Grantor retains the right to use and occupy the Property as the Grantor's principal residence as provided in the trust agreement, and intends the Property to remain the Grantor's residence homestead.</p>
  ${a.has_mortgage === "yes" ? `<p><b>Existing loan:</b> The Property is subject to an existing deed of trust lien. This transfer is to an inter vivos trust in which the borrower is and remains a beneficiary and occupant of the Property.</p>` : ""}
  ${sig("Grantor", esc(a.settlor_name))}${plural ? sig("Grantor", esc(a.spouse_name)) : ""}
  ${notary(settlors)}
  <p class="small"><b>After recording, return to:</b> ${trustees}, Trustee${a.mailing_address ? `, ${esc(a.mailing_address)}` : ""}</p>`;

  const cert = `<h1>Certification of Trust</h1><p class="small">(Texas Property Code §114.086)</p>
  <p>The undersigned Trustee certifies:</p><ol>
  <li>The <b>${trustName}</b> exists and the trust instrument was executed on ____________________, 20____.</li>
  <li>The settlor${plural ? "s are" : " is"}: ${settlors}.</li>
  <li>The currently acting trustee is ${trustees}${a.mailing_address ? `, whose mailing address is ${esc(a.mailing_address)}` : ""}.</li>
  <li>The trust grants the trustee all the powers granted a trustee by Subchapter A, Chapter 113, Texas Property Code, including the power to sell, convey, lease, mortgage and encumber real property.</li>
  <li>The trust is <b>revocable</b>. The power to revoke it is held by ${settlors}.</li>
  <li>${a.trustee_name && a.trustee_name.includes(" and ") ? "Any one trustee may sign or authenticate documents and exercise the trustee's powers." : "There is one acting trustee, who alone may sign documents and exercise the trustee's powers."}</li>
  <li>Title to trust property should be taken as: &ldquo;${trustees}, Trustee of the ${trustName}, dated ____________________, 20____.&rdquo;</li>
  <li>The trust has not been revoked, modified, or amended in any manner that would cause the representations in this certification to be incorrect.</li></ol>
  ${sig("Trustee", trustees)}${notary(trustees)}`;

  const steps = `<h1>Your next steps</h1><ol class="steps">
  <li><b>Read every page.</b> Make sure names, the property and the beneficiaries are right. Questions about whether a trust is right for you belong with a Texas attorney.</li>
  <li><b>Sign the trust agreement and certification before a notary</b>${plural ? " (both spouses)" : ""}. Then write the trust date into the blanks on the deed and certification.</li>
  <li><b>Sign the deed before a notary</b>${plural ? ". In Texas both spouses must sign to convey a homestead (Family Code §5.001)" : ""}. Use the legal description from your current deed exactly.</li>
  <li><b>Record the deed</b> with the ${v(a, "county")} County Clerk (recording fees are typically about $25 for the first page and $4 for each extra page; check the clerk's site). Keep the trust agreement private; you do not record it.</li>
  <li><b>Tell the appraisal district.</b> Your exemption usually carries over; if the district asks, file Form 50-114 (Residence Homestead Exemption Application) with a copy of the recorded deed and the trust.</li>
  <li><b>Tell your insurer and, if you have a mortgage, your lender</b>, and add the trust as an additional insured.</li></ol>`;

  return [
    { key: "trust", title: "Revocable Living Trust Agreement", html: trust },
    { key: "deed", title: "Warranty Deed to Trustee", html: deed },
    { key: "cert", title: "Certification of Trust", html: cert },
    { key: "steps", title: "Signing and recording instructions", html: steps },
  ];
}

/* ---------------- Contract Drafting documents ---------------- */
const T = {
  loi: (a) => `<h1>Letter of Intent to Purchase</h1><p>Date: ${date(new Date().toISOString().slice(0, 10))}</p>
    <p>To: ${v(a, "seller_name")}${a.seller_address ? `, ${esc(a.seller_address)}` : ""}</p>
    <p>${v(a, "buyer_name")} (&ldquo;Buyer&rdquo;) is interested in buying ${v(a, "property_address")}, ${v(a, "county")} County, Texas, on these terms:</p>
    <ul><li>Price: <b>${money(a.price)}</b></li><li>Earnest money: ${a.earnest ? money(a.earnest) : "to be agreed"}</li><li>Inspection / option period: ${a.inspection_days ? esc(a.inspection_days) + " days" : "to be agreed"}</li><li>Closing: ${a.close_days ? "within " + esc(a.close_days) + " days after a signed contract" : "to be agreed"}</li>${a.other_terms ? `<li>${esc(a.other_terms)}</li>` : ""}</ul>
    <p><b>This letter is not binding.</b> It is a statement of intent only. Neither party is bound until both sign a written purchase contract. This letter expires if not accepted by ${date(a.expires)}.</p>
    ${sig("Buyer", v(a, "buyer_name"))}<p>Acknowledged (not binding):</p>${sig("Seller", v(a, "seller_name"))}`,
  assignment: (a) => `<h1>Assignment of Purchase Contract</h1>
    <p>${v(a, "assignor_name")} (&ldquo;Assignor&rdquo;) assigns to ${v(a, "assignee_name")} (&ldquo;Assignee&rdquo;) all of Assignor's rights and interest as buyer under the purchase contract dated ${date(a.contract_date)} between ${v(a, "seller_name")}, as seller, and Assignor, as buyer (the &ldquo;Contract&rdquo;), for the property at ${v(a, "property_address")}, ${v(a, "county")} County, Texas.</p>
    <h3>1. Assignment fee</h3><p>Assignee shall pay Assignor <b>${money(a.fee)}</b>. Payment: ${v(a, "fee_timing", "at closing")}.${a.deposit ? ` A non-refundable deposit of ${money(a.deposit)} is due when this Assignment is signed and credited toward the fee.` : ""}${a.title_company ? ` The title company is ${esc(a.title_company)}.` : ""}</p>
    <h3>2. Assumption</h3><p>Assignee accepts the assignment and assumes all of the buyer's obligations under the Contract arising after this date, including closing on the terms of the Contract. Earnest money deposited by Assignor ${"shall be reimbursed to Assignor at closing unless stated otherwise in writing"}.</p>
    <h3>3. Representations</h3><p>Assignor represents that the Contract is in effect, that Assignor has not assigned it to anyone else, and that Assignor has given Assignee a complete copy. Assignor makes no other representations about the property, which Assignee has had the opportunity to inspect.</p>
    <h3>4. Disclosure</h3><p>Assignor has disclosed to the seller in writing, as required by Texas Occupations Code §1101.0045, that Assignor is selling an equitable interest in the property through the Contract and may assign it.</p>
    <h3>5. Default</h3><p>If Assignee fails to close, Assignor may keep any deposit as liquidated damages, and Assignee's rights under this Assignment end.</p>
    ${sig("Assignor", v(a, "assignor_name"))}${sig("Assignee", v(a, "assignee_name"))}`,
  memorandum: (a) => `${confidentiality}<h1>Memorandum of Contract</h1>
    <p>Notice is given that ${v(a, "seller_name")}${a.seller_address ? `, ${esc(a.seller_address)}` : ""} (&ldquo;Seller&rdquo;), and ${v(a, "buyer_name")}${a.buyer_address ? `, ${esc(a.buyer_address)}` : ""} (&ldquo;Buyer&rdquo;), entered into a written contract dated ${date(a.contract_date)} under which Seller agreed to sell and Buyer agreed to buy the following property:</p>${propBlock(a)}
    <p>The contract ${a.expires ? `provides for closing on or before ${date(a.expires)}` : "remains in effect according to its terms"}. This Memorandum is recorded to give notice of Buyer's interest and does not change the contract's terms. It may be released by a recorded release signed by Buyer.</p>
    ${sig("Seller", v(a, "seller_name"))}${notary(v(a, "seller_name"))}${sig("Buyer", v(a, "buyer_name"))}${notary(v(a, "buyer_name"))}`,
  release: (a) => `<h1>Mutual Release of Purchase Contract</h1>
    <p>${v(a, "buyer_name")} (&ldquo;Buyer&rdquo;) and ${v(a, "seller_name")} (&ldquo;Seller&rdquo;) are parties to a purchase contract dated ${date(a.contract_date)} for ${v(a, "property_address")}, ${v(a, "county")} County, Texas (the &ldquo;Contract&rdquo;).</p>
    <p>Buyer and Seller agree that the Contract is terminated and release each other from all obligations and claims under it.</p>
    <p><b>Earnest money:</b> ${a.earnest_to === "Split as stated below" ? "shall be split as follows: " + v(a, "earnest_split") : a.earnest_to === "No earnest money was deposited" ? "none was deposited" : "shall be released to " + v(a, "earnest_to")}${a.title_company ? `. ${esc(a.title_company)} is authorized to disburse it accordingly` : ""}.</p>
    ${sig("Buyer", v(a, "buyer_name"))}${sig("Seller", v(a, "seller_name"))}`,
  option: (a) => `<h1>Option to Purchase Agreement</h1>
    <p>${v(a, "owner_name")} (&ldquo;Owner&rdquo;) grants ${v(a, "optionee_name")} (&ldquo;Optionee&rdquo;) the exclusive option to buy the following property on the terms below:</p>${propBlock(a)}
    <h3>1. Option fee</h3><p>Optionee pays Owner <b>${money(a.option_fee)}</b> when this Agreement is signed. The option fee is non-refundable${a.credit_fee === "Yes" ? " and will be credited to the purchase price at closing" : " and is not credited to the purchase price"}.</p>
    <h3>2. Term and exercise</h3><p>The option expires at 11:59 p.m. on ${date(a.expires)}. Optionee may exercise it only by written notice delivered to Owner before it expires.</p>
    <h3>3. Price and closing</h3><p>If exercised, the purchase price is <b>${money(a.price)}</b>, and closing shall occur within ${a.close_days ? esc(a.close_days) : "30"} days after exercise at a title company Optionee selects. Owner shall convey good and marketable title by general warranty deed, subject only to matters of record Optionee approves.</p>
    <h3>4. During the option</h3><p>Owner shall not sell, encumber or lease the property beyond the option term without Optionee's written consent. Optionee may record a memorandum of this option.</p>
    <h3>5. Not an executory contract</h3><p>This is an option only. Optionee does not occupy the property under this Agreement and has no obligation to buy.</p>
    ${sig("Owner", v(a, "owner_name"))}${notary(v(a, "owner_name"))}${sig("Optionee", v(a, "optionee_name"))}`,
  vacate: (a) => `<h1>Notice to Vacate</h1><p>Date delivered: ____________________</p>
    <p>To: ${v(a, "tenant_names")} and all other occupants of ${v(a, "property_address")}, ${v(a, "county")} County, Texas.</p>
    <p>You are notified to <b>vacate the premises within ${v(a, "notice_days", "3")} days</b> after the date this notice is delivered.</p>
    <p><b>Reason:</b> ${v(a, "reason")}${a.amount_due ? `. Amount due: ${money(a.amount_due)}` : ""}.</p>
    <p>If you do not vacate by that date, the landlord may file an eviction suit in the justice court for the precinct where the property is located.${a.reason === "Nonpayment of rent" ? " Paying the full amount owed before the deadline may resolve this notice only if the landlord agrees in writing." : ""}</p>
    <p><b>Method of delivery:</b> ${v(a, "delivery")}</p>
    ${sig("Landlord or agent", v(a, "landlord_name"))}`,
  billofsale: (a) => `<h1>Bill of Sale</h1>
    <p>For <b>${money(a.price)}</b>, received in full, ${v(a, "seller_name")} (&ldquo;Seller&rdquo;) sells and transfers to ${v(a, "buyer_name")} (&ldquo;Buyer&rdquo;) the following personal property:</p><ul>${lines(a.items)}</ul>
    <p>Seller warrants that Seller owns the property and that it is free of liens. ${a.as_is && a.as_is.startsWith("Yes") ? "<b>Otherwise the property is sold AS IS, with no warranties, express or implied, including any warranty of merchantability or fitness for a particular purpose.</b>" : "Seller also warrants: " + v(a, "warranty")}</p>
    ${sig("Seller", v(a, "seller_name"))}${sig("Buyer", v(a, "buyer_name"))}`,
  note: (a) => `<h1>Promissory Note</h1><p>Amount: <b>${money(a.principal)}</b> &nbsp; Date: ____________________</p>
    <p>For value received, ${v(a, "borrower_name")} (&ldquo;Borrower&rdquo;) promises to pay ${v(a, "lender_name")} (&ldquo;Lender&rdquo;)${a.lender_address ? `, at ${esc(a.lender_address)}` : ""}, the principal sum of ${money(a.principal)}, with interest on the unpaid principal at <b>${v(a, "rate")}% per year</b>.</p>
    <p><b>Payment:</b> ${v(a, "payments")}. All unpaid principal and interest are due on <b>${date(a.maturity)}</b> (the maturity date).${a.late_fee ? ` A late charge of ${money(a.late_fee)} applies to any payment more than 10 days late.` : ""}</p>
    <p><b>Business purpose:</b> This loan is made for business and commercial purposes (${v(a, "purpose")}) and not for personal, family or household purposes.</p>
    <p><b>Prepayment:</b> Borrower may prepay without penalty. <b>Usury savings:</b> Interest shall never exceed the maximum lawful rate; any excess shall be credited to principal or refunded.</p>
    <p><b>Default:</b> If Borrower fails to pay when due and does not cure within 10 days after written notice, Lender may declare the unpaid balance immediately due. Borrower agrees to pay reasonable attorney's fees to collect this Note after default. Borrower waives presentment, demand and notice of dishonor, except the notice of default above.</p>
    <p>This Note is governed by Texas law.</p>${sig("Borrower", v(a, "borrower_name"))}`,
  contractor: (a) => `<h1>Independent Contractor Agreement</h1>
    <p>${v(a, "company_name")} (&ldquo;Company&rdquo;) and ${v(a, "contractor_name")} (&ldquo;Contractor&rdquo;) agree:</p>
    <h3>1. Work</h3><p>Contractor will perform: ${v(a, "work")}${a.property_address ? ` at ${esc(a.property_address)}` : ""}, starting ${a.start ? date(a.start) : "on a date the parties agree"}.</p>
    <h3>2. Pay</h3><p>${v(a, "pay")}, paid ${v(a, "pay_when")}. Contractor will give Company a completed IRS Form W-9 before the first payment. Company will report payments as required by law.</p>
    <h3>3. Independent contractor</h3><p>Contractor is an independent contractor, not an employee. Contractor controls how the work is done, supplies Contractor's own tools unless agreed otherwise, may work for others, and is responsible for Contractor's own taxes. Contractor is not eligible for employee benefits.</p>
    <h3>4. Licenses and safety</h3><p>Contractor will not perform work that requires a license Contractor does not hold, and will follow safe work practices. Contractor ${a.insurance === "Yes" ? "carries general liability insurance and will provide a certificate on request" : "does not carry general liability insurance and accepts responsibility for Contractor's own injuries and equipment"}.</p>
    <h3>5. Quality and property</h3><p>Contractor will do the work in a good and workmanlike manner, keep the job site clean and secure, and repair any damage Contractor causes.</p>
    <h3>6. Ending this agreement</h3><p>Either party may end this agreement by written notice. Company will pay for work satisfactorily completed through that date.</p>
    ${sig("Company", v(a, "company_name"))}${sig("Contractor", v(a, "contractor_name"))}`,
  lease: (a) => `<h1>Residential Lease</h1>
    <p>Landlord: ${v(a, "landlord_name")}${a.landlord_address ? `, ${esc(a.landlord_address)}` : ""}. Tenant(s): ${v(a, "tenant_names")}. Property: ${v(a, "property_address")}, ${v(a, "county")} County, Texas.</p>
    <h3>1. Term</h3><p>From ${date(a.start)} through ${date(a.end)}. After that, month to month unless either party gives at least 30 days' written notice.</p>
    <h3>2. Rent</h3><p><b>${money(a.rent)}</b> per month, due on day ${v(a, "due_day")} of each month.${a.late_fee ? ` If any rent remains unpaid two full days after its due date, Tenant owes a late fee of ${money(a.late_fee)}. The late fee will not exceed the limits in Texas Property Code §92.019 (12% of monthly rent for a structure with four or fewer units).` : ""}</p>
    <h3>3. Security deposit</h3><p>${money(a.deposit)}. Landlord will refund the deposit, less lawful deductions itemized in writing, within 30 days after Tenant surrenders the property, as provided in Texas Property Code Chapter 92, Subchapter C. Tenant must give Landlord a written forwarding address.</p>
    <h3>4. Use and occupancy</h3><p>Only the Tenants named above and their minor children may live in the property. Pets: ${v(a, "pets")}. Utilities paid by Tenant: ${v(a, "utilities", "all utilities")}.</p>
    <h3>5. Repairs</h3><p><b><u>If Landlord fails to repair a condition that materially affects the physical health or safety of an ordinary tenant as required by this lease or the Texas Property Code, Tenant may be entitled to exercise remedies under Texas Property Code §92.056 and §92.0561. If Tenant follows the procedures under those sections, the following remedies may be available: (1) terminate the lease and obtain a proportionate refund of rent and the security deposit; (2) have the condition repaired or remedied and deduct the cost from rent; and (3) obtain judicial remedies under §92.0563. Do not exercise these remedies without consulting an attorney or carefully reviewing the procedures under those sections.</u></b> Repair requests must be in writing unless the lease allows otherwise.</p>
    <h3>6. Security devices</h3><p>Landlord will rekey the exterior door locks within 7 days after each tenant turnover and will provide the security devices required by Texas Property Code Chapter 92, Subchapter D.</p>
    <h3>7. Flood disclosure (Texas Property Code §92.0135)</h3><p>Landlord <b>${a.flood_known === "Yes" ? "is" : "is not"}</b> aware that the dwelling you are renting is located in a 100-year floodplain. If neither box is checked, you should assume the dwelling is in a 100-year floodplain. Even if the dwelling is not in a 100-year floodplain, the dwelling may still be susceptible to flooding. Most tenant insurance policies do not cover damages or loss incurred in a flood. You should seek insurance coverage that would cover losses caused by a flood.</p>
    <p>Landlord <b>${a.flooded === "Yes" ? "is" : "is not"}</b> aware that the dwelling you are renting has flooded at least once within the last five years.</p>
    <h3>8. Ownership and management</h3><p>Owner: ${v(a, "landlord_name")}. ${a.manager ? `Property manager: ${esc(a.manager)}.` : "The owner manages the property."}</p>
    <h3>9. Default</h3><p>If Tenant fails to pay rent or otherwise defaults, Landlord may end Tenant's right to occupy by giving the written notice to vacate required by Texas Property Code §24.005 and may pursue all lawful remedies.</p>
    ${sig("Landlord", v(a, "landlord_name"))}${sig("Tenant", v(a, "tenant_names"))}`,
};

export function contractDoc(type, a) {
  const d = DOCS[type]; if (!d || !T[type]) return null;
  return [{ key: type, title: d.title, html: T[type](a || {}) }];
}

// Wrap one or more documents in a printable page.
export function printable(docs, { draft = true, test = false, title = "Your documents", backUrl = "" } = {}) {
  const stamp = test ? "TEST DOCUMENT: not for real use" : draft ? "DRAFT: pending attorney review. Not for signing or recording." : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="robots" content="noindex">
<style>
 :root{color-scheme:light}
 body{margin:0;background:#eef1f5;font:16px/1.6 Georgia,'Times New Roman',serif;color:#111}
 .bar{position:sticky;top:0;background:#0b1730;color:#fff;font:600 14px/1.4 system-ui,sans-serif;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;z-index:2}
 .bar a,.bar button{color:#0b1730;background:#f59e0b;border:0;border-radius:8px;padding:8px 14px;font:700 14px system-ui,sans-serif;text-decoration:none;cursor:pointer}
 .bar .ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)}
 .page{max-width:8.5in;margin:20px auto;background:#fff;padding:0.9in 0.9in;box-shadow:0 8px 30px rgba(0,0,0,.12);position:relative;overflow:hidden}
 .page+.page{page-break-before:always}
 h1{font-size:22px;text-align:center;margin:0 0 6px;text-transform:uppercase;letter-spacing:.04em} h2{font-size:17px;text-align:center;margin:0 0 18px;font-weight:normal}
 h3{font-size:15px;margin:18px 0 4px} p,li{font-size:14.5px} .small{font-size:12.5px} .caps{font-size:11.5px}
 .sig{margin:30px 0 8px;max-width:340px;font-size:13px} .sig .line{border-bottom:1px solid #111;height:28px} .sig .line.short{max-width:180px;margin-top:10px}
 .notary{margin-top:18px;padding-top:10px;border-top:1px dashed #999;font-size:13.5px}
 .disc{margin-top:28px;padding-top:10px;border-top:1px solid #ccc;font:11.5px/1.5 system-ui,sans-serif;color:#444}
 .stamp{position:absolute;top:38%;left:-10%;right:-10%;text-align:center;transform:rotate(-24deg);font:800 40px/1.1 system-ui,sans-serif;color:rgba(220,38,38,.16);pointer-events:none;text-transform:uppercase}
 .ribbon{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:8px 12px;border-radius:8px;font:600 13px system-ui,sans-serif;margin-bottom:16px}
 @media print{body{background:#fff}.bar{display:none}.page{box-shadow:none;margin:0;padding:0.6in}}
 @media (max-width:700px){.page{padding:28px 20px;margin:10px}}
</style></head><body>
<div class="bar"><span>${esc(title)}</span><span>${backUrl ? `<a class="ghost" href="${esc(backUrl)}">Back</a> ` : ""}<button onclick="window.print()">Print or save as PDF</button></span></div>
${docs.map((d) => `<section class="page">${stamp ? `<div class="stamp">${esc(stamp)}</div><div class="ribbon">${esc(stamp)}</div>` : ""}${d.html}<div class="disc">${esc(DISCLAIMER)}</div></section>`).join("\n")}
</body></html>`;
}
