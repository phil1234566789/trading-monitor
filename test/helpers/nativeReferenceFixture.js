import {createHash} from 'node:crypto';
import {expect} from 'vitest';

// Beide Originalreferenzen verwenden denselben Hash-/OHLC-Vertrag, damit Prüfungen nicht auseinanderlaufen.
export function assertNativeReferenceCandles(fixture,bar) {
 const rows=fixture.candles[bar],manifest=fixture.provenance.manifest[bar];
 expect(rows).toHaveLength(manifest.count);
 expect(rows[0].time).toBe(manifest.from);expect(rows.at(-1).time).toBe(manifest.to);
 expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(manifest.sha256);
 for(const[index,c]of rows.entries()){
  expect(Object.values(c).every(Number.isFinite)).toBe(true);
  expect(Number.isInteger(c.time)).toBe(true);expect(c.volume).toBeGreaterThanOrEqual(0);
  expect(c.low).toBeGreaterThan(0);expect(c.low).toBeLessThanOrEqual(Math.min(c.open,c.close));
  expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open,c.close));
  if(index)expect(c.time).toBeGreaterThan(rows[index-1].time);
 }
}
