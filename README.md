# ClearPath Review

A review workflow for the ClearPath Financial compliance marketing team. It replaces the Excel-and-email process with a queue that pre-screens every asset against compliance rules, so reviewers spend time on judgment calls instead of catching missing disclosures.

## How it raises throughput

- **Intake form with live pre-screen.** Submitters see findings and suggested fixes while typing, so most defects are fixed before review.
- **Risk lanes.** Each submission is routed by its worst finding: *fast* (no findings, one-click confirm, 4 h SLA), *standard* (48 h), *escalated* (any high-severity finding, 24 h).
- **Queue sorted by lane and SLA**, with overdue items surfaced.
- **Decisions with an audit trail.** Approve, request changes, or reject. Rejections and change requests require a note. Resubmitting creates a new version and re-screens it.
- **Dashboard.** Queue depth, SLA breaches, time to decision by lane, and the most common findings (candidates for pre-approved copy blocks).

## Assumptions

- Products: personal loans, credit cards, mortgage prequalification. Channels: affiliate, email, paid social, search ads, landing pages, SMS.
- The rules in `src/rules.js` are an illustrative subset of UDAAP, Reg Z, SAFE Act, FCRA, TCPA and FTC endorsement expectations. The compliance team owns the real list; rules are data, one entry each.
- The pre-screen advises. A human always makes the final decision, including in the fast lane.
- No authentication: the header dropdown picks who is acting. SSO and role enforcement are the next step before real use.
- SLA hours per lane are guesses (`SLA_HOURS` in `src/rules.js`).

## Run

```
npm install
npm run migrate:local && npm run seed:local
npm run dev        # http://localhost:8787
npm test
```

## Deploy (Cloudflare Workers + D1)

```
npx wrangler d1 create clearpath     # put the id in wrangler.toml
npm run deploy
```

## Layout

- `src/rules.js` rules engine and scoring
- `src/index.js` JSON API (`/api/submissions`, `/api/screen`, `/api/metrics`)
- `public/index.html` single-page UI
- `migrations/` D1 schema, `scripts/seed.mjs` sample data
