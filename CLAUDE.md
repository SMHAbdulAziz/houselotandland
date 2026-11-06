# houselotandland.org: notes for Claude (and anyone editing this repo)

House Lot & Land Sales Co. LLC, a North Texas wholesaling company (owner: Harvey Searcy).
This file is never served publicly (`.assetsignore` excludes `*.md`).

## How it deploys
- Cloudflare Worker `houselotandland` (account `leelane-aimhigh`), built by Workers Builds on every push to `main`.
- `wrangler.jsonc`: static files from the repo root; `src/worker.js` runs first only for `/api/*`, `/offer/*`, `/find`, `/sign/*`, `/doc/*`, `/order/*`.
- Custom domains `houselotandland.org` and `www.houselotandland.org`. DNS is on Cloudflare.
  Do NOT attach `msg` or `esign` to this Worker: they are Cloudflare tunnels to Lee's Mac (texting bridge).
- `.assetsignore` keeps `src/`, `wrangler.jsonc`, `*.md`, `form-handler.php` (unused, legacy) off the public site.
- Test locally: `npx wrangler dev --local` (D1 runs locally with `--persist-to`).

## Data: D1 database `hll-leads` (id 41cd2c24-fb52-41ae-95b9-748ee75b2d31)
| Table | What it holds | Written by |
| --- | --- | --- |
| `leads` | Website form submissions (status new/synced/test) | `POST /api/lead` |
| `offers` | One row per seller offer page: payload JSON, choice, call-back, ownership answers, search fields | Deal Desk (publish), site (seller actions) |
| `offer_events` | View/choose/callback/ownership log | site |
| `find_attempts` | Rate limit for `/find` | site |
| `envelopes`, `signers`, `sign_audit` | E-sign: locked document + hash, per-signer links, audit trail | Deal Desk (create), site (sign) |
| `loan_apps` | Private money loan applications from `/apply.html` (schema in `src/loan_apps.sql`): applicant data JSON, fix-and-flip analysis, desk status/checklist/notes | `POST /api/loan` (create), Deal Desk Funding panel (work) |
| `service_requests`, `service_docs` | Homestead Trust, Curb Appeal, Contract Drafting and Property Watch orders (schema in `src/services.sql`); documents made with subscriptions | `POST /api/service`, Stripe webhook, `/api/order/<token>/doc` (create), Deal Desk Services panel (work) |
| `settings` | `agreements_approved` and `legal_templates_approved` ('true' only after attorney sign-off) | Claude, on Harvey's word |
| `properties`, `contacts`, `property_contacts`, `deals`, `activities` | **Master list ("hub")**, schema in `src/hub.sql`. One property per address key, one contact per phone/email, one deal per property per track (`wholesale`, `subto`, `creative`, `funding`, `services`; stages in `js/hub-keys.js`). Keys from `js/hub-keys.js` (`propertyKey`, `phoneKey`). `deals.source_app/source_id` point back to the dashboard record it came from | Back office, migration (Nov 6, 2026: 45 Sub-To, 8 Creative, 3 Desk) |
| `workers`, `worker_jobs` | Crew/contractor applicants and roster (status applied/approved/active/inactive/declined, W-9 status only, never tax IDs), jobs with pay and paid date | `POST /api/worker/apply` (`work-with-us.html`), back office |
| `hub_imports` | Log of imports into the master list | migrations, imports |

`events_at` > `synced_at` means "something changed the Deal Desk hasn't picked up yet".

## Back office (houselotandland.org/office)
- `office/` (page, JS, CSS) and `/api/office/*` (`src/office.js`) are served only after the Worker verifies a Cloudflare Access token
  (vars `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, optional `OFFICE_EMAILS` in `wrangler.jsonc`). Empty vars = locked. Local testing: `OFFICE_DEV=1` in `.dev.vars`.
- Tabs: overview (pipelines, follow-ups, activity), deals by track, property drawer (tracks, owners, do-not-contact, history), add property (matches instead of duplicating),
  workers and crews (status, W-9, agreement, insurance, jobs, pay owed/paid), links to every dashboard.
- Phase 2 (planned): Sub-To Pipeline, Creative Finance Tracker and Deal Desk read and write the master list directly. Phase 3: phone agent lookup. Phase 4: Google Takeout import of Maps saved lists.

## The rest of the system (outside this repo)
- **Wholesale Deal Desk**: claude.ai artifact https://claude.ai/artifact/5MAcErFcTQZoe6VCGzbjHs. Master lead list.
  Publishes offer pages and creates envelopes through the Cloudflare connector (`d1_database_query`, one statement per call).
- **Hourly scheduled task "Website leads + offer choices"**: moves form leads to the desk, sends confirmation email/text,
  syncs offer choices, ownership answers and signatures, emails Harvey a summary.
- **AI phone line**: ElevenLabs agents behind Bandwidth +1 337-604-0230; 214-702-1519 (Google Voice) and 214-608-8032 (Android) forward there.
- **Texting**: House Lot & Land Messaging Bridge (msg.houselotandland.org, queue-only; Harvey releases texts).
- **Private money brokering**: `apply.html` + `js/loan-analyzer.js` (JS port of Harvey's COGO Deal Analyzer: loan = min(65% ARV, 80% purchase); profit = ARV − purchase − rehab − selling costs by exit strategy − broker fee − 5% finance; eligible at $20K). The same math is copied into the Deal Desk Funding panel; change both together. Applications are business-purpose, non-owner-occupied only; never collect SSNs, ID or account numbers on the site. Not offered in UT, ID, MN, AZ, MA, NY, SD, ND.
- **Services** (`homestead-trust.html`, `curb-appeal.html`, `contracts.html`, `property-watch.html`, shared `css/pages.css`, `js/service-form.js`): prices and questionnaires live in `js/services-catalog.js` (drafts for Harvey's approval); the Worker (`src/services.js`) recomputes every price from it. Legal document templates are in `src/legaldocs.js`; they render DRAFT and real customers join a waitlist until `settings.legal_templates_approved = 'true'`. Names starting with "Test" make test orders (no charge, stamped TEST). Texas only; self-help software with the Gov't Code §81.101(c) disclaimer on every page and document; never give legal advice. Curb Appeal: no licensed trades (irrigation, electrical, pesticide, tree work near lines, roofing).
- **Stripe**: Checkout via REST in `src/services.js`. Secrets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set by Harvey in Cloudflare (never in the repo). Webhook endpoint: `https://houselotandland.org/api/stripe/webhook` (events: checkout.session.completed, customer.subscription.deleted, invoice.paid, invoice.payment_failed). Without the key, orders save as awaiting_payment and Harvey invoices.
- **Agreement text**: claude.ai doc "Seller Agreement Templates (Draft for Attorney Review)". `src/agreements.js` must match it word for word.

## Rules
- **Shabbat, without exception:** closed for all new business from sunset Friday to sunset Saturday (Dallas sunset, `js/shabbat.js`, shared by browser and Worker).
  The Worker refuses new-business POSTs (`NEW_BUSINESS` in `src/worker.js`: lead, loan, service orders, offer choices, signatures, new subscription documents) with 503 and the reopening time;
  `js/shabbat-banner.js` (on every page) shows the notice and countdown and hides forms. Paid customers keep access to order pages, documents, offer pages and Find my offer.
  No Curb Appeal work dates on Saturdays. The hourly scheduled task stops during Shabbat (STEP 0). Terms of Use: `terms.html` (section 2, English and Spanish). Any new form or endpoint must follow this.
  `GET /api/hours` gives open/closed plus the spoken closed notice; the AI phone line's tool `check_business_hours` calls it on every call. The power-washing bid scan skips Saturdays.
- Consent first: never call or text anyone without recorded consent; texts only through the bridge.
- Offers and agreements are never sent without Harvey's click on the desk.
- Real agreements stay locked (`settings.agreements_approved = 'false'`) until Harvey confirms attorney approval. Test envelopes (`test = 1`) always work.
- A locked envelope's document never changes; template edits apply to new envelopes only.
- Wholesaler disclosure (Texas Occupations Code §1101.0045) stays on offer pages and in every agreement.
- Buyer entity wording: "House Lot & Land Sales Co. LLC, a Texas-based limited liability company".
- Spanish: site text lives in `js/i18n.js`; offer, find and sign pages carry their own EN/ES strings.
- Email addresses are Gmail plus-aliases of houselotandland@gmail.com, one per source: `+website` (site contact), `+esign` (signing pages), `+letters` (printed letters), `+funding` (investor funding and private-money pages), `+text` (texting HELP reply), `+alerts` (Claude's automated summaries). Keep new sources tagged the same way.
- Commit as Harvey; Claude adds the Co-Authored-By trailer.
