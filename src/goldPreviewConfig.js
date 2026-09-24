import { GOLD_H1_MIN_FVG_USD } from './goldH1ObConfig.js';
import { GOLD_H4_MIN_FVG_USD } from './goldH4ObConfig.js';

export const GOLD_PRICE_FORMAT = { type: 'price', precision: 2, minMove: 0.01 };
export const GOLD_PREVIEWS = {
  '1h': { label: 'H1', timeframe: '1H', start: '2026-09-06T22:00:00Z', end: '2026-09-20T22:00:00Z',
    visibleStart: '2026-09-06T22:00:00Z', period: '07.–18.09.2026', minFvg: GOLD_H1_MIN_FVG_USD },
  '4h': { label: 'H4', timeframe: '4H', start: '2026-08-23T22:00:00Z', end: '2026-09-24T21:00:00Z',
    visibleStart: '2026-08-31T22:00:00Z', period: '01.–24.09.2026 · August-Vorlauf', minFvg: GOLD_H4_MIN_FVG_USD },
};

export function goldPreviewConfig(bar) {
  if (!Object.hasOwn(GOLD_PREVIEWS, bar)) throw new Error('Unsupported Gold preview timeframe');
  return GOLD_PREVIEWS[bar];
}
