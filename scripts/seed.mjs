// Prints SQL that seeds realistic submissions across lanes, statuses and ages.
import { screen, SLA_HOURS } from '../src/rules.js';

const q = s => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const H = 3600e3, NOW = Date.now();
const iso = ms => new Date(ms).toISOString();

const DISC = ' Terms apply. Rates vary based on credit profile.';
const items = [
  ['Spring consolidation email', 'personal_loan', 'email', null, 'Consolidate your payments into one. Rates from 8.99% to 24.99% APR.' + DISC, 'maria.lopez', 30, 'approved'],
  ['Cashback card landing page', 'credit_card', 'landing_page', null, 'Earn 3% cash back. $0 annual fee. Variable APR 19.99% - 28.99%.' + DISC, 'dev.patel', 20, 'approved'],
  ['BestRatesHub review post', 'personal_loan', 'affiliate', 'BestRatesHub', 'The lowest rates you will find! Guaranteed approval for everyone. Rates from 5.99%. Act now!', 'sam.ortiz', 52, 'pending'],
  ['LoanFinder comparison widget', 'personal_loan', 'affiliate', 'LoanFinder', 'Compare offers from ClearPath. Rates from 7.49% to 23.99% APR.' + DISC + ' Advertisement: ClearPath compensates us if you apply.', 'sam.ortiz', 6, 'pending'],
  ['Mortgage prequal Meta ad', 'mortgage', 'paid_social', null, 'Pre-approved in minutes! Locked low rates. Start now.', 'jin.wu', 30, 'pending'],
  ['Mortgage rate explainer email', 'mortgage', 'email', null, 'See your options in minutes. Checking your rate will not affect your credit score. ClearPath Financial NMLS #123456. Equal Housing Lender.' + DISC, 'maria.lopez', 3, 'pending'],
  ['Q4 holiday SMS blast', 'personal_loan', 'sms', null, 'Need cash for the holidays? Rates from 9.99% APR. Terms apply. Rates vary based on credit profile.', 'dev.patel', 26, 'pending'],
  ['Debt relief search ad', 'personal_loan', 'search_ad', null, 'Erase your debt today. No credit check required.', 'jin.wu', 40, 'rejected'],
  ['Travel card paid social', 'credit_card', 'paid_social', null, 'Earn 2x miles. $95 annual fee. 21.99% - 29.99% variable APR.' + DISC, 'maria.lopez', 8, 'pending'],
  ['CardCompare banner copy', 'credit_card', 'affiliate', 'CardCompare', 'Risk-free rewards card. Limited time offer. 0% intro for 15 months.', 'sam.ortiz', 20, 'changes_requested'],
  ['Refi retargeting email', 'mortgage', 'email', null, 'Thinking about refinancing? Rates vary. ClearPath NMLS #123456. Equal Housing Lender. Terms apply.', 'jin.wu', 1, 'pending'],
  ['Small business-owner loan LP', 'personal_loan', 'landing_page', null, 'Fund your next step. Fixed rates from 8.49% APR. Rates vary based on credit profile. Terms apply.', 'dev.patel', 14, 'approved'],
  ['Highway billboard: Refi season', 'mortgage', 'landing_page', null, 'Refinance today. Rates from 6.1% APR. NMLS #123456. Equal Housing Lender. Terms apply. See clearpath.com for details.', 'jin.wu', 5, 'pending', 'billboard'],
  ['Creator reel: 60s loan explainer', 'personal_loan', 'paid_social', 'FinFluence', 'Watch how Sara consolidated her debt. Rates vary. Terms apply.', 'sam.ortiz', 9, 'pending', 'video'],
  ['Instagram carousel post', 'credit_card', 'paid_social', null, 'Cash back made simple. $0 annual fee. Variable APR 19.99% - 28.99%. Terms apply. Rates vary.', 'maria.lopez', 2, 'pending', 'social_post'],
];

const out = [];
const decideHours = { fast: 2, standard: 30, escalated: 18 };
items.forEach(([title, product, channel, partner, body, submitter, ageH, status, format = 'text'], i) => {
  const id = i + 1;
  const r = screen({ product, channel, format, body });
  const created = NOW - ageH * H;
  const decided = ['approved', 'rejected', 'changes_requested'].includes(status)
    ? created + Math.min(decideHours[r.lane], ageH * 0.8) * H : null;
  out.push(`INSERT INTO submissions (id,title,product,channel,format,partner,body,submitter,status,lane,risk_score,assignee,decision_note,created_at,due_at,decided_at) VALUES (${id},${q(title)},${q(product)},${q(channel)},${q(format)},${q(partner)},${q(body)},${q(submitter)},${q(status)},${q(r.lane)},${r.score},${q(status === 'pending' ? null : 'priya.shah')},${q(status === 'rejected' ? 'Claims no credit check and debt erasure; not curable by edit.' : status === 'changes_requested' ? 'Remove risk-free and urgency language; state the intro APR after the promo period.' : null)},${q(iso(created))},${q(iso(created + SLA_HOURS[r.lane] * H))},${q(decided && iso(decided))});`);
  for (const f of r.findings)
    out.push(`INSERT INTO findings (submission_id,version,rule_id,severity,excerpt,message,suggestion) VALUES (${id},1,${q(f.rule_id)},${q(f.severity)},${q(f.excerpt)},${q(f.message)},${q(f.suggestion)});`);
  out.push(`INSERT INTO events (submission_id,at,actor,type,detail) VALUES (${id},${q(iso(created))},${q(submitter)},'submitted',${q(`Pre-screen: ${r.findings.length} finding(s), lane ${r.lane}`)});`);
  if (decided) out.push(`INSERT INTO events (submission_id,at,actor,type,detail) VALUES (${id},${q(iso(decided))},'priya.shah',${q(status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'request_changes')},NULL);`);
});
console.log(out.join('\n'));
