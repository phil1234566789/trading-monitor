import { describe, it, expect } from 'vitest';
import { evaluateChecklistSweeps, evaluateChecklistCandidateValidity } from '../src/tradeSetupChecklistSweeps.js';

const t = Date.parse('2026-09-09T10:00:00Z') / 1000;
const level = (age, touch = t - 600, dir = 1) => ({ price: 1.3, dir, pivotTime: touch - age * 86400, touched: true, touchedTime: touch });
const context = { instrument: 'GBPUSD', evaluatedAt: t, direction: 'short', m5Candles: [], h1State: null };
const run = (levels, extra = {}) => evaluateChecklistSweeps({ context, h1Levels: levels, ...extra });

describe('checklist sweeps', () => {
  it('shows B before C and keeps the oldest level across movements', () => {
    const old = level(7, t - 7200), recent = level(2);
    const result = run([recent, old, level(2, t - 300, -1)]);
    expect(result.primary.sweep.level).toEqual(old);
    expect(result.checks.liquiditySweep.status).toBe('passed');
    expect(result.checks.reaction.status).toBe('pending');
    expect(result.opposingCandidates).toHaveLength(1);
    expect(run([old]).primary.id).toBe(result.primary.id);
  });
  it('leaves unconfirmed age rules unknown and rejects future touches', () => {
    expect(run([level(0.5)]).checks.liquiditySweep.status).toBe('unknown');
    expect(run([level(7, t + 300)]).candidates).toHaveLength(0);
  });
  it('removes an ended older candidate without removing its history', () => {
    const levels = [level(7, t - 7200), level(2)];
    const id = run(levels).primary.id;
    const result = run(levels, { targetsByCandidateId: { [id]: { price: 1.2, knownAt: t - 900 } }, context: { ...context, m5Candles: [{ time: t - 600, high: 1.29, low: 1.19 }] } });
    expect(result.primary.sweep.level).toEqual(levels[1]);
    expect(result.candidates.find(c => c.id === id).validity.state).toBe('ended');
  });
  it('requires the same sweep link and waits for the FVG close', () => {
    const levels = [level(7, t - 1800), level(2, t - 1500)];
    const candles = [
      { time: t - 1200, open: 1.31, close: 1.31, high: 1.32, low: 1.30 },
      { time: t - 900, open: 1.31, close: 1.31, high: 1.32, low: 1.30 },
      { time: t - 600, open: 1.31, close: 1.28, high: 1.32, low: 1.27 },
      { time: t - 300, open: 1.28, close: 1.28, high: 1.29, low: 1.27 },
    ];
    const ctx = { ...context, m5Candles: candles };
    const first = run(levels, { context: ctx });
    expect(first.checks.reaction.status).toBe('unknown');
    expect(first.primary.reactionOB).toBeNull();
    expect(first.primary.reactionPreview).toMatchObject({ linked: false, candidateCount: 1,
      ob: { startTime: t - 600, top: 1.32, bottom: 1.30 } });
    const link = { candidateId: first.candidates[1].id, obStartTime: t - 600, recognizedAt: t };
    const linked = run(levels, { context: ctx, reactionLinks: [link] });
    expect(linked.primary.reactionOB).toBeNull();
    expect(linked.candidates[1].reactionOB).not.toBeNull();
    expect(linked.candidates[1].checks.reaction.status).toBe('unknown');
    const complete = run(levels, { context: ctx, reactionLinks: [{ ...link, invalidation: { price: 1.32, knownAt: t } }] }).candidates[1];
    expect(complete.checks.reaction.status).toBe('passed');
    expect(complete.reactionPreview.linked).toBe(true);
    expect(complete.checks.reaction.details.join(' ')).toMatch(/Bärischer M5.*FVG.*Risikoband/);
    const premature = { ...link, recognizedAt: t - 300 };
    expect(run(levels, { context: ctx, reactionLinks: [premature, link] }).candidates[1].reactionOB).not.toBeNull();
    const early = run(levels, { context: { ...ctx, evaluatedAt: t - 1 }, reactionLinks: [link] });
    expect(early.candidates[1].reactionOB).toBeNull();
    const ignored = run(levels, { context: { ...ctx, m5Candles: candles.map((c, i) => ({ ...c, ignored: i === 1 })) }, reactionLinks: [link] });
    expect(ignored.candidates[1].reactionOB).toBeNull();
  });
  it('rejects a source that was not recognized yet and preserves explicit provenance', () => {
    const source = { ...level(2), recognizedAt: t + 1 };
    expect(run([source]).candidates).toHaveLength(0);
    expect(run([{ ...source, recognizedAt: t }]).primary.recognizedAt).toBe(t);
  });
});

describe('candidate lifetime', () => {
  const candidate = { direction: 'short', sweep: { level: level(2) } };
  it('ends on either exact touch and reports a same-bar ambiguity', () => {
    const result = evaluateChecklistCandidateValidity({ candidate, evaluatedAt: t, candles: [{ time: t - 300, high: 1.4, low: 1.2 }], invalidation: { price: 1.4, knownAt: t - 300 }, target1: { price: 1.2, knownAt: t - 300 } });
    expect(result).toMatchObject({ state: 'ended', reason: 'both', endedAt: t - 300 });
  });
  it('does not infer missing bounds or consume unclosed candles', () => {
    expect(evaluateChecklistCandidateValidity({ candidate, evaluatedAt: t, candles: [] }).state).toBe('unknown');
    expect(evaluateChecklistCandidateValidity({ candidate, evaluatedAt: t, candles: [{ time: t, high: 2, low: 0 }], target1: { price: 1.2, knownAt: t - 300 } }).state).toBe('unknown');
  });
  it('uses the first touch, supports long and does not expire by elapsed time', () => {
    const long = { ...candidate, direction: 'long' };
    const bounds = { invalidation: { price: 1.1, knownAt: t - 600 }, target1: { price: 1.4, knownAt: t - 600 } };
    expect(evaluateChecklistCandidateValidity({ candidate: long, evaluatedAt: t, candles: [{ time: t - 600, high: 1.4, low: 1.2 }, { time: t - 300, high: 1.3, low: 1.1 }], ...bounds })).toMatchObject({ reason: 'target1', endedAt: t - 600 });
    const full = Array.from({ length: 290 }, (_, i) => ({ time: t - 600 + i * 300, high: 1.3, low: 1.2 }));
    expect(evaluateChecklistCandidateValidity({ candidate: long, evaluatedAt: t + 86400, candles: full, ...bounds }).state).toBe('active');
    expect(evaluateChecklistCandidateValidity({ candidate: long, evaluatedAt: t, candles: [{ time: t - 600, high: 1.3, low: 1.2 }, { time: t - 300, high: 2, low: 0, ignored: true }], ...bounds }).state).toBe('active');
  });
  it('requires coverage from each bound and rejects partial-candle start times', () => {
    const bounds = { invalidation: { price: 1.4, knownAt: t - 600 }, target1: { price: 1.1, knownAt: t - 300 } };
    const rows = [-600, -300].map(offset => ({ time: t + offset, high: 1.3, low: 1.2 }));
    const evaluate = (candles, extra = {}) => evaluateChecklistCandidateValidity({ candidate, evaluatedAt: t, ...bounds, candles, ...extra }).state;
    expect(evaluate([])).toBe('unknown');
    expect(evaluate(rows.slice(1))).toBe('unknown');
    expect(evaluate(rows.slice(0, 1))).toBe('unknown');
    expect(evaluate(rows)).toBe('active');
    expect(evaluate(rows, { invalidation: { price: 1.4, knownAt: t - 450 } })).toBe('unknown');
    expect(evaluate([{ time: t - 300, high: 1.5, low: 1.2 }])).toBe('ended');
    expect(evaluate([{ ...rows[0], high: 1.5 }, rows[1]], { invalidation: { price: 1.4, knownAt: t - 450 } })).toBe('unknown');
    expect(evaluate(rows, { evaluatedAt: t + 300 })).toBe('unknown');
    expect(evaluate([rows[0], { ...rows[1], time: t }], { evaluatedAt: t + 300 })).toBe('unknown');
  });
});
