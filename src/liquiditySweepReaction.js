// LS-Reaktion (Gruppe POI): Ist die Preisreaktion an einem LQ-Level gut? Welche Level in Frage kommen, entscheidet der LQ-Algo,
// welche Range gilt, der Struktur-Algo. Gegenstück zu evaluateOrderBlockReaction() (orderBlockReaction.js).
import {liquidityTouch} from './liquidityDetection.js';

// Eine bestätigte Gegen-FVG zwischen Sweep und Umkehr-OB belegt Fortsetzung statt Sweep-Reaktion.
// Beide Impulszeiten haben denselben M5-Bestätigungsvorlauf; spätere FVGs ändern die Historie nicht.
export function hasUninterruptedSweepReaction(setup, setupObs, m5Candles = []) {
  let touch = setup.ls?.touchedTime;
  if (!Number.isFinite(touch)) return true;
  if (setup.sweeps?.[0]?.timeframe === '1H') {
    // H1-Touch ist nur der Stundenanfang: eine M5-FVG davor darf keinen späteren Sweep entwerten.
    const crossed = m5Candles.find(c => c.time >= touch && c.time < touch + 3600 && liquidityTouch(c, setup.ls.price, setup.dir));
    if (!crossed) return true;
    touch = crossed.time;
  }
  return !setupObs.some(ob => ob.dir === setup.dir && ob.startTime > touch && ob.startTime < setup.obStartTime);
}

// Urteil der LS-Reaktion: IN = Reaktion trägt, OUT = Gegen-FVG zwischen Touch und Umkehr-OB.
export function evaluateLiquiditySweepReaction(setup, setupObs, m5Candles = []) {
  return hasUninterruptedSweepReaction(setup, setupObs, m5Candles) ? {status: 'in'} : {status: 'out', reason: 'sweepReactionInterrupted'};
}
