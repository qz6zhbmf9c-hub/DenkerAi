// Run with: npm test   (uses Node's built-in test runner, no extra packages)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue, previewDelays, schedule } from '../api/_lib/srs.js';

const base = { state: 'new', step: 0, ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
const now = new Date('2026-01-01T10:00:00Z');
const noFuzz = { fuzzing: false };

test('new card: Again/Hard/Good/Easy give 1m, 5.5m, 10m, 4d', () => {
  assert.deepEqual(previewDelays(base), [1, 5.5, 10, 4 * 1440]);
});

test('new card: Good moves to step 2, second Good graduates to 1 day', () => {
  const a = schedule(base, 3, now, noFuzz);
  assert.equal(a.state, 'learning');
  assert.equal(a.step, 1);
  const b = schedule({ ...base, ...a }, 3, now, noFuzz);
  assert.equal(b.state, 'review');
  assert.equal(b.intervalDays, 1);
});

test('learning: Again resets to the first step', () => {
  const r = schedule({ ...base, state: 'learning', step: 1 }, 1, now, noFuzz);
  assert.equal(r.step, 0);
  assert.equal(r.delayMinutes, 1);
});

test('review: Good multiplies by ease, Hard by 1.2, Easy adds bonus', () => {
  const card = { ...base, state: 'review', intervalDays: 10 };
  assert.equal(schedule(card, 3, now, noFuzz).intervalDays, 25);
  assert.equal(schedule(card, 2, now, noFuzz).intervalDays, 12);
  assert.equal(schedule(card, 4, now, noFuzz).intervalDays, 10 * 2.5 * 1.3);
  assert.equal(schedule(card, 4, now, noFuzz).ease, 2.65);
});

test('review: lapse goes to relearning, ease drops, 10 minute step', () => {
  const r = schedule({ ...base, state: 'review', intervalDays: 10 }, 1, now, noFuzz);
  assert.equal(r.state, 'relearning');
  assert.equal(r.lapses, 1);
  assert.ok(Math.abs(r.ease - 2.3) < 1e-9);
  assert.equal(r.delayMinutes, 10);
});

test('ease never falls below 1.3', () => {
  const r = schedule({ ...base, state: 'review', ease: 1.3, intervalDays: 5 }, 1, now, noFuzz);
  assert.equal(r.ease, 1.3);
});

test('relearning: Good returns to review with at least 1 day', () => {
  const r = schedule({ ...base, state: 'relearning', intervalDays: 1 }, 3, now, noFuzz);
  assert.equal(r.state, 'review');
  assert.equal(r.intervalDays, 1);
});

test('queue order: due learning, due reviews, then new capped at 20 per day', () => {
  const past = new Date(now.getTime() - 60000);
  const future = new Date(now.getTime() + 3600000);
  const cards = [
    { id: 'r1', state: 'review', due: past },
    { id: 'l1', state: 'learning', due: past },
    { id: 'rf', state: 'review', due: future },
    ...Array.from({ length: 30 }, (_, i) => ({ id: 'n' + i, state: 'new', due: past })),
  ];
  const q = buildQueue(cards, now, 0).map((c) => c.id);
  assert.deepEqual(q.slice(0, 2), ['l1', 'r1']);
  assert.equal(q.length, 22);
  assert.equal(buildQueue(cards, now, 15).length, 2 + 5);
});
