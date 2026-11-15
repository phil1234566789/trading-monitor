import { describe, expect, it } from 'vitest';
import { aggregateDobRoutes, aggregateDobByMonth } from '../scripts/dobWinrateAggregate.mjs';

const ready = status => ({ status: 'ready', outcome: { status } });
const pair = (month, a, b) => ({ month, entries: { a, b } });

describe('aggregateDobRoutes', () => {
  it('zählt Outcomes je Route, Winrate nur über success+loss, R +2/−1', () => {
    const r = aggregateDobRoutes([
      pair('10', ready('success'), { status: 'invalid' }),
      pair('10', ready('loss'), ready('ambiguous')),
      pair('11', ready('loss'), ready('weird')),
      pair('11', ready('open'), undefined),
    ]);
    expect(r.pairs).toBe(4);
    expect(r.routes.a).toEqual({ success: 1, loss: 2, ambiguous: 0, open: 1, unknown: 0, notReady: 0, winrate: 1 / 3, sumR: 0 });
    expect(r.routes.b).toMatchObject({ ambiguous: 1, unknown: 1, notReady: 2, winrate: null, sumR: 0 });
  });

  it('trennt Monate', () => {
    const r = aggregateDobByMonth([pair('11', ready('success')), pair('10', ready('loss'))], p => p.month);
    expect(Object.keys(r.months)).toEqual(['10', '11']);
    expect(r.months['11'].routes.a.sumR).toBe(2);
    expect(r.total.routes.a.sumR).toBe(1);
  });
});
