// Pre-screen rules. Each rule either forbids a pattern or requires a disclosure.
// Assumption: these encode a plausible subset of UDAAP / TILA (Reg Z) / SAFE Act
// marketing expectations; ClearPath compliance owns the real list.

const ALL = ['personal_loan', 'credit_card', 'mortgage'];

export const RULES = [
  { id: 'guaranteed-approval', kind: 'forbid', severity: 'high', products: ALL,
    pattern: /\b(guaranteed|100%)\s+(approval|approved|acceptance)\b|\beveryone (is )?(approved|qualifies)\b/i,
    message: 'Implies approval is certain (deceptive under UDAAP).',
    suggestion: 'Say "See if you qualify" and state that approval depends on credit review.' },
  { id: 'no-credit-check', kind: 'forbid', severity: 'high', products: ALL,
    pattern: /\bno credit (check|history required)\b|\bbad credit (is )?(ok|welcome|no problem)\b/i,
    message: 'Claims no credit evaluation, which contradicts underwriting.',
    suggestion: 'Remove. If a soft pull is used for prequalification, say "Checking your rate will not affect your credit score."' },
  { id: 'prequal-misuse', kind: 'forbid', severity: 'high', products: ALL,
    pattern: /\bpre-?approved\b/i,
    message: '"Pre-approved" implies a firm offer of credit (FCRA firm-offer rules).',
    suggestion: 'Use "prequalified" or "see your options" unless a firm offer of credit is being made.' },
  { id: 'superlative-rate', kind: 'forbid', severity: 'medium', products: ALL,
    pattern: /\b(lowest|best|cheapest) (rates?|apr|interest)\b|\bunbeatable rates?\b/i,
    message: 'Unsubstantiated superlative rate claim.',
    suggestion: 'Remove, or attach documented substantiation and a comparison basis.' },
  { id: 'urgency', kind: 'forbid', severity: 'low', products: ALL,
    pattern: /\b(act now|limited time|last chance|expires (today|tonight)|hurry)\b/i,
    message: 'Pressure language; acceptable only if a real deadline exists.',
    suggestion: 'Remove, or state the actual end date and terms.' },
  { id: 'risk-free', kind: 'forbid', severity: 'medium', products: ALL,
    pattern: /\brisk[- ]free\b|\bno (obligation|strings attached)\b|\bfree money\b/i,
    message: 'Characterizes credit as free or risk-free.',
    suggestion: 'Remove. Credit products carry costs and obligations.' },
  { id: 'rate-guarantee', kind: 'forbid', severity: 'high', products: ['mortgage', 'personal_loan'],
    pattern: /\b(guaranteed|locked)\s+(low\s+)?rates?\b|\brates? (will )?never (go up|increase)\b/i,
    message: 'Guarantees a rate before underwriting or lock.',
    suggestion: 'Say "Rates vary based on credit profile" and drop the guarantee.' },
  { id: 'debt-erase', kind: 'forbid', severity: 'medium', products: ['personal_loan'],
    pattern: /\b(erase|wipe out|eliminate) (your )?debt\b/i,
    message: 'Overstates the effect of a consolidation loan.',
    suggestion: 'Say "consolidate your payments" and avoid implying debt disappears.' },

  { id: 'apr-trigger', kind: 'require-if', severity: 'high', products: ['personal_loan', 'credit_card'],
    when: /\d+(\.\d+)?\s*%|\$\s?\d[\d,]*\s*(\/|per)\s*(mo|month)|\bmonthly payment/i,
    pattern: /\bAPR\b|annual percentage rate/i,
    message: 'States a rate or payment (Reg Z trigger term) without APR disclosure.',
    suggestion: 'Add "Rates from X% to Y% APR" with the representative example and range.' },
  { id: 'nmls', kind: 'require', severity: 'high', products: ['mortgage'],
    pattern: /\bNMLS\b/i,
    message: 'Mortgage advertising must show the NMLS ID.',
    suggestion: 'Add "ClearPath Financial NMLS #000000" (insert the real ID).' },
  { id: 'equal-housing', kind: 'require', severity: 'medium', products: ['mortgage'],
    pattern: /equal housing/i,
    message: 'Missing Equal Housing Lender statement.',
    suggestion: 'Add the Equal Housing Lender logo or statement.' },
  { id: 'terms-apply', kind: 'require', severity: 'medium', products: ALL,
    pattern: /terms (and conditions )?apply|subject to|see (full )?terms|rates vary/i,
    message: 'No "terms apply" or rate-variability qualifier.',
    suggestion: 'Add "Terms apply. Rates vary based on credit profile."' },
  { id: 'cc-fees', kind: 'require', severity: 'medium', products: ['credit_card'],
    pattern: /annual fee|no annual fee|fees?\b/i,
    message: 'Credit card ad does not mention fees.',
    suggestion: 'State the annual fee (or "$0 annual fee") and link to the Schumer box.' },
  { id: 'affiliate-disclosure', kind: 'require-channel', channels: ['affiliate'], severity: 'medium', products: ALL,
    pattern: /\b(ad|advertisement|sponsored|paid partner|compensat(ed|ion)|affiliate)\b/i,
    message: 'Affiliate content lacks a clear paid-relationship disclosure (FTC Endorsement Guides).',
    suggestion: 'Add "ClearPath compensates us if you apply" near the first claim.' },
  { id: 'sms-optout', kind: 'require-channel', channels: ['sms'], severity: 'high', products: ALL,
    pattern: /\bSTOP\b/,
    message: 'SMS missing opt-out instruction (TCPA).',
    suggestion: 'Add "Reply STOP to opt out" and "Msg & data rates may apply".' },
];

const WEIGHT = { high: 40, medium: 15, low: 5 };

// Rules keyed on creative format rather than wording. `visual` carries what the vision step reported.
const FORMAT_RULES = [
  { id: 'ooh-legibility', severity: 'medium', formats: ['billboard'],
    test: ({ text }) => text.split(/\s+/).filter(Boolean).length > 7,
    message: 'Billboard copy is over 7 words; required disclosures are unlikely to be legible at driving speed.',
    suggestion: 'Cut copy to a headline plus a short disclosure line, or move the required terms to the landing page URL shown on the board.' },
  { id: 'video-unscreened', severity: 'medium', formats: ['video'],
    test: () => true,
    message: 'Audio and on-screen text in video are not machine-screened.',
    suggestion: 'Reviewer must watch the clip and confirm spoken claims and on-screen disclosures; paste the transcript to run the text rules.' },
  { id: 'social-ad-label', severity: 'medium', formats: ['social_post'], channels: ['paid_social', 'affiliate'],
    test: ({ text }) => !/#ad\b|#sponsored|paid partnership|sponsored/i.test(text),
    message: 'Social post has no #ad, sponsored, or paid-partnership label.',
    suggestion: 'Use the platform paid-partnership tool and put #ad at the start of the caption.' },
  { id: 'disclosure-legibility', severity: 'high', formats: ['image', 'billboard', 'social_post', 'video', 'document'],
    test: ({ visual }) => !!visual?.small_print,
    message: 'Vision check: disclosures appear small, low-contrast, or fleeting.',
    suggestion: 'Increase disclosure size and contrast so it is as prominent as the claim it qualifies (Reg Z clear-and-conspicuous).' },
  { id: 'no-extractable-text', severity: 'medium', formats: ['image', 'billboard', 'document'],
    test: ({ text }) => !text.trim(),
    message: 'No text was extracted from the creative, so nothing was screened.',
    suggestion: 'Attach the creative or paste its copy; the reviewer must read it manually.' },
];

export const FORMATS = ['text', 'image', 'video', 'social_post', 'billboard', 'document'];

export function screen({ product, channel, format = 'text', body, visual }) {
  const findings = [];
  for (const f of FORMAT_RULES) {
    if (!f.formats.includes(format)) continue;
    if (f.channels && !f.channels.includes(channel)) continue;
    if (f.test({ text: body, visual })) findings.push(finding(f, null));
  }
  for (const r of RULES) {
    if (!r.products.includes(product)) continue;
    if (r.channels && !r.channels.includes(channel)) continue;
    if (r.kind === 'forbid') {
      const m = body.match(r.pattern);
      if (m) findings.push(finding(r, m[0]));
    } else if (r.kind === 'require-if') {
      const t = body.match(r.when);
      if (t && !r.pattern.test(body)) findings.push(finding(r, t[0]));
    } else if (!r.pattern.test(body)) {
      findings.push(finding(r, null));
    }
  }
  const score = Math.min(100, findings.reduce((s, f) => s + WEIGHT[f.severity], 0));
  const lane = findings.some(f => f.severity === 'high') ? 'escalated'
    : findings.length === 0 ? 'fast' : 'standard';
  return { findings, score, lane };
}

function finding(r, excerpt) {
  return { rule_id: r.id, severity: r.severity, excerpt, message: r.message, suggestion: r.suggestion };
}

// SLA hours by lane. Assumption: fast lane is a one-click confirm, escalated gets a tighter clock
// because it is the most likely to block a launch and needs senior reviewer attention.
export const SLA_HOURS = { fast: 4, standard: 48, escalated: 24 };
