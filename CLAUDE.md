# houselotandland.org: notes for Claude (and anyone editing this repo)

House Lot & Land Sales Co. LLC, a North Texas wholesaling company (owner: Harvey Searcy).
This file is never served publicly (`.assetsignore` excludes `*.md`).

## How it deploys
- Cloudflare Worker `houselotandland` (account `leelane-aimhigh`), built by Workers Builds on every push to `main`.
- `wrangler.jsonc`: static files from the repo root; `src/worker.js` runs first only for `/api/*`, `/offer/*`, `/find`, `/sign/*`, `/doc/*`.
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
| `settings` | `agreements_approved` ('true' only after attorney sign-off) | Claude, on Harvey's word |

`events_at` > `synced_at` means "something changed the Deal Desk hasn't picked up yet".

## The rest of the system (outside this repo)
- **Wholesale Deal Desk**: claude.ai artifact https://claude.ai/artifact/5MAcErFcTQZoe6VCGzbjHs. Master lead list.
  Publishes offer pages and creates envelopes through the Cloudflare connector (`d1_database_query`, one statement per call).
- **Hourly scheduled task "Website leads + offer choices"**: moves form leads to the desk, sends confirmation email/text,
  syncs offer choices, ownership answers and signatures, emails Harvey a summary.
- **AI phone line**: ElevenLabs agents behind Bandwidth +1 337-604-0230; 214-702-1519 (Google Voice) and 214-608-8032 (Android) forward there.
- **Texting**: House Lot & Land Messaging Bridge (msg.houselotandland.org, queue-only; Harvey releases texts).
- **Private money brokering**: `apply.html` + `js/loan-analyzer.js` (JS port of Harvey's COGO Deal Analyzer: loan = min(65% ARV, 80% purchase); profit = ARV − purchase − rehab − selling costs by exit strategy − broker fee − 5% finance; eligible at $20K). The same math is copied into the Deal Desk Funding panel; change both together. Applications are business-purpose, non-owner-occupied only; never collect SSNs, ID or account numbers on the site. Not offered in UT, ID, MN, AZ, MA, NY, SD, ND.
- **Agreement text**: claude.ai doc "Seller Agreement Templates (Draft for Attorney Review)". `src/agreements.js` must match it word for word.

## Rules
- Consent first: never call or text anyone without recorded consent; texts only through the bridge.
- Offers and agreements are never sent without Harvey's click on the desk.
- Real agreements stay locked (`settings.agreements_approved = 'false'`) until Harvey confirms attorney approval. Test envelopes (`test = 1`) always work.
- A locked envelope's document never changes; template edits apply to new envelopes only.
- Wholesaler disclosure (Texas Occupations Code §1101.0045) stays on offer pages and in every agreement.
- Buyer entity wording: "House Lot & Land Sales Co. LLC, a Texas-based limited liability company".
- Spanish: site text lives in `js/i18n.js`; offer, find and sign pages carry their own EN/ES strings.
- Email addresses are Gmail plus-aliases of houselotandland@gmail.com, one per source: `+website` (site contact), `+esign` (signing pages), `+letters` (printed letters), `+funding` (investor funding and private-money pages), `+text` (texting HELP reply), `+alerts` (Claude's automated summaries). Keep new sources tagged the same way.
- Commit as Harvey; Claude adds the Co-Authored-By trailer.
