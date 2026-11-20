# Checkpoint: Deal Advisor working (Nov 20, 2026, ~4:05 PM Central)

Harvey confirmed the Deal Advisor works on all three dashboards at this point.
These are the exact HTML files published as:

| Dashboard | Artifact | Version id |
| --- | --- | --- |
| Wholesale Deal Desk | https://claude.ai/artifact/5MAcErFcTQZoe6VCGzbjHs | 1795211736-933c |
| Sub-To Pipeline | https://claude.ai/artifact/FtLdvSwuLyK8tRCEQKL2N8 | 1795211737-b492 |
| Creative Finance Tracker | https://claude.ai/artifact/34uqcPNYFQnpZAwZvtxvTp | 1795211733-6f69 |

Repo: branch `checkpoint/2026-11-20-advisor-working` (GitHub; tags are blocked here) (advisor source `src/dashboards/advisor.js`, back office, worker).

To restore a dashboard: republish its file here to the same artifact URL (keep the stored capabilities;
Creative's include BatchData lookup_property and skip_trace_property). To restore the repo: `git checkout origin/checkpoint/2026-11-20-advisor-working -- <paths>`.
