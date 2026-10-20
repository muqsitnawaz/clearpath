---
kind: report
template: report.v1
title: 'ClearPath Review: status, Jev evaluation, and what is left'
summary: 'Working prototype of the compliance review queue is on GitHub; deployment is blocked on a Cloudflare token. Jev is a good fit for a confidence-gated triage layer, but access needs one human step.'
header: ''
footer: ''
project: clearpath
projectUrl: ''
context: ''
repository: muqsitnawaz/clearpath
branch: task-74a75edb
tracking: ''
status: draft
harness: ''
harnessVersion: ''
agent: ''
human: agent
avatar: ''
host: e2b
hostPlatform: linux
hostArch: x64
hostAddress: ''
session: ''
sessionId: ''
date: '2026-10-20'
created: '2026-10-20T00:17:30.961Z'
updated: ''
facts: []
links: []
assets: []
---

## Summary

ClearPath Review is built and pushed to [muqsitnawaz/clearpath](https://github.com/muqsitnawaz/clearpath) (`main`). It is not deployed, so there is no live URL yet.

- Intake: manual form, or `POST /api/intake` for automatic submission.
- Formats: text, image, PDF, social post, billboard, video. Claude reads text out of images and PDFs.
- Routing: rules pre-screen, then fast, standard or escalated lane with an SLA clock.
- Review: decisions with notes, versioned resubmission, audit trail, dashboard.

## Findings

### Jev (TypeSafe AI) as a decision layer

Jev is a "System One" decision model released 15 September 2026. It does not generate prose. It takes a `state` (text or JSON) and typed questions and returns only structured answers with confidence: `noul` (probability of yes), `score` (2 to 10 levels) or `choice` (up to 255 options). Pricing is reported as $0.042 per million input tokens and nothing for output. These figures come from vendor-aligned coverage; no independent benchmark was found.

Where it fits here:

<svg viewBox="0 0 860 190" role="img" aria-label="Proposed flow: submission, rules and Claude vision, Jev triage, then lane or human reviewer" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" font-size="13">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5b6577"/></marker></defs>
<g fill="none" stroke="#5b6577" stroke-width="1.5" marker-end="url(#a)"><path d="M150 70H200"/><path d="M370 70H420"/><path d="M590 55H650"/><path d="M590 90L650 130"/></g>
<g stroke="#0b6e4f" stroke-width="1.5"><rect x="10" y="40" width="140" height="60" rx="8" fill="#e7f6ef"/><rect x="200" y="40" width="170" height="60" rx="8" fill="#e7f6ef"/><rect x="420" y="25" width="170" height="90" rx="8" fill="#fffaeb" stroke="#b54708"/><rect x="650" y="30" width="200" height="50" rx="8" fill="#e7f6ef"/><rect x="650" y="110" width="200" height="50" rx="8" fill="#fef3f2" stroke="#b42318"/></g>
<g fill="#14213d"><text x="80" y="68" text-anchor="middle">Submission</text><text x="80" y="86" text-anchor="middle" font-size="11">form or /api/intake</text>
<text x="285" y="68" text-anchor="middle">Rules + Claude vision</text><text x="285" y="86" text-anchor="middle" font-size="11">findings with explanations</text>
<text x="505" y="52" text-anchor="middle" font-weight="600">Jev triage</text><text x="505" y="72" text-anchor="middle" font-size="11">noul: is each finding real?</text><text x="505" y="88" text-anchor="middle" font-size="11">score: risk   choice: lane</text><text x="505" y="104" text-anchor="middle" font-size="11">+ confidence on each</text>
<text x="750" y="52" text-anchor="middle">High confidence: lane + SLA</text><text x="750" y="68" text-anchor="middle" font-size="11">human still decides</text>
<text x="750" y="132" text-anchor="middle">Low confidence: reviewer</text><text x="750" y="148" text-anchor="middle" font-size="11">sees the raw findings</text></g></svg>

Today the lane comes from the worst rule severity. Jev would filter false positives (for example "pre-approved" in a negated sentence), give a risk score, and attach a confidence so uncertain cases go straight to a person.

Where it does not fit: it gives no reasoning, and answers are not guaranteed identical across runs ([TechTarget](https://www.techtarget.com/it-infrastructure/news/366650696/Jev-decision-model-touted-as-quicker-cheaper-LLM-alternative)). A compliance finding needs an explanation a reviewer and an auditor can read, so Jev should rank and filter and never be the only reason an asset passes. The rules and Claude keep the explanations.

### Access

- Direct API: `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`, bearer key from console.typesafe.ai ([setup guide](https://flaviocopes.com/jev-api-key/)).
- Vercel AI Gateway serves it as `typesafe-ai/jev` at `https://ai-gateway.vercel.sh/typesafe`.
- I tried the console sign-in with the Rush email. It stops at a Cloudflare "verify you are human" check, which I did not try to bypass. Reports also say TypeSafe paused new signups on 22 September; that is unconfirmed for today.

## Evidence

- Jev page content: TechTarget article and the setup guide above. Both are secondary sources; TypeSafe's own docs were not retrieved.
- App: 7 unit tests pass on the rules engine. An image submitted through `/api/intake` against the local Worker came back `escalated`, risk 100, with the guaranteed-approval claim and the tiny fine print flagged.
- Not verified: anything on a deployed environment, and any Jev call.

## Recommendations

What is left, in order:

1. **Deploy.** Needs a Cloudflare API token (Workers, D1, R2). Then `npm run deploy` and a smoke test on the live URL.
2. **Jev access.** One person clicks the human check at console.typesafe.ai, or creates a Vercel AI Gateway key. Then add `src/jev.js` behind a configured key and compare it against reviewer decisions.
3. **Measure before trusting it.** Log each reviewer decision against each automated finding. That gives precision per rule and a labelled set to test Jev against.
4. **Real policy.** Replace the illustrative rules with the compliance team's list, owned by them.
5. **Auth and roles.** SSO and enforced reviewer versus submitter roles. Today a dropdown picks the actor.
6. **Intake connectors.** Email-in worker and affiliate-portal and ad-platform callers for `/api/intake`.
7. **Video.** Sample frames and transcribe audio so video is screened and not only flagged.
8. **Large files.** Resumable upload to R2 beyond the 5 MB cap.
