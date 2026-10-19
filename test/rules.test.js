import test from 'node:test';
import assert from 'node:assert/strict';
import { screen } from '../src/rules.js';

const ids = r => r.findings.map(f => f.rule_id).sort();

test('clean compliant loan ad goes to fast lane', () => {
  const r = screen({ product: 'personal_loan', channel: 'email',
    body: 'Consolidate your payments. Rates from 8.99% to 24.99% APR. Terms apply. Rates vary based on credit profile.' });
  assert.deepEqual(ids(r), []);
  assert.equal(r.lane, 'fast');
  assert.equal(r.score, 0);
});

test('rate without APR triggers apr-trigger but a bare percentage word elsewhere does not', () => {
  const bad = screen({ product: 'credit_card', channel: 'email', body: 'Earn 5% back. No annual fee. Terms apply.' });
  assert.ok(ids(bad).includes('apr-trigger'));
  const ok = screen({ product: 'credit_card', channel: 'email', body: 'Earn rewards. No annual fee. Terms apply.' });
  assert.ok(!ids(ok).includes('apr-trigger'));
});

test('any high-severity finding escalates and score is capped at 100', () => {
  const r = screen({ product: 'mortgage', channel: 'sms',
    body: 'Guaranteed approval! Pre-approved, lowest rates, no credit check, risk-free. Act now!' });
  assert.equal(r.lane, 'escalated');
  assert.equal(r.score, 100);
});

test('channel-scoped rules only fire on their channel', () => {
  const body = 'Rates vary. Terms apply. 7.5% APR. No annual fee.';
  assert.ok(!ids(screen({ product: 'personal_loan', channel: 'email', body })).includes('sms-optout'));
  assert.ok(ids(screen({ product: 'personal_loan', channel: 'sms', body })).includes('sms-optout'));
  assert.ok(ids(screen({ product: 'personal_loan', channel: 'affiliate', body })).includes('affiliate-disclosure'));
});

test('mortgage requires NMLS and equal housing; loan does not', () => {
  const body = 'See your options. Terms apply.';
  assert.deepEqual(ids(screen({ product: 'mortgage', channel: 'email', body })), ['equal-housing', 'nmls']);
  assert.deepEqual(ids(screen({ product: 'personal_loan', channel: 'email', body })), []);
});
