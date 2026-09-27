import { expect, it } from 'vitest';
import { instrumentConfig, obMinimum, strategyDistance } from '../src/instrumentConfig.js';
import { isTooFarFromPrice, targetDistanceLimit } from '../src/findTargets.js';
import { toPips, fromPips } from '../src/pipConfig.js';

it('keeps Gold price points separate from volatility-scaled strategy distances', () => {
  expect(instrumentConfig('XAUUSD').tick).toBe(0.01);
  expect(fromPips(100, 'XAUUSD')).toBe(1);
  expect(toPips(1, 'XAUUSD')).toBe(100);
  expect(strategyDistance(0.0005, 'XAUUSD')).toBe(7.5);
  expect(obMinimum('XAUUSD', '1H')).toBe(2.53);
  expect(obMinimum('XAUUSD', '4H')).toBe(6.19);
});

it('applies the same target radius to the label and selection boundary', () => {
  expect(targetDistanceLimit('XAUUSD')).toBe(75);
  expect(isTooFarFromPrice(3975, 3900, undefined, 'XAUUSD')).toBe(false);
  expect(isTooFarFromPrice(3975.01, 3900, undefined, 'XAUUSD')).toBe(true);
  expect(targetDistanceLimit('GBPUSD')).toBe(0.005);
  expect(fromPips(10, 'GBPUSD')).toBe(0.001);
});
