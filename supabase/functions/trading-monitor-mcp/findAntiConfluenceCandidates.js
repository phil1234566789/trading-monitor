// find_anti_confluences-Algorithmus (Chat 2026-08-30, Philip: "Lana tut sich wie erwartet schwer
// selbst anti-confluences zu finden") — analog find_targets/findTargetCandidates.js: mechanische
// Kandidatenliste statt Lana müsste den Preis-Chart selbst nach Gegenargumenten absuchen. Baut auf
// derselben Zonen-Regel auf, die 00-trading-steps/06-dealing-range-validieren.md (trading-Repo)
// bisher nur manuell/textuell beschreibt ("Gegenläufige Dealing Range ... zählt NUR, wenn sie
// ZWISCHEN aktuellem Preis und dem eigenen Schritt-3-Target liegt").
//
// Regel (Short-Fall, Long spiegelt): Zone = [tiefstes Short-Target, aktueller Preis]. Anti-
// Confluence = alles BULLISCHE in dieser Zone (offene ODER gehaltene bullische OBs, bullische
// LQ-Sweeps, bullische RSI-Divergenz) + zusätzlich unberührte bärische OBs knapp ÜBER der
// Invalidierung (eigene, von der Ziel-Zone unabhängige Regel).
import { fetchForexCandles } from "./forexCandles.ts";
import { buildCandidatePool } from "./findTargetCandidates.js";
import { detectRsiDivergenceHistory } from "./rsi.js";
import { fromPips } from "./pipConfig.js";

// "nicht 100 Jahre alt" (Philip) — noch kein konkreter Wert vorgegeben, 14 Tage als erster
// Startwert, leicht nachjustierbar sobald echte Kandidatenlisten sichtbar sind.
export const MAX_HELD_OB_AGE_DAYS = 14;
// Von Philip vorgegeben (Chat 2026-08-30): "aber nicht zu weit entfernt, sagen wir max 10 pips".
export const MAX_INVALIDATION_OB_DISTANCE_PIPS = 10;
const DAY_SECONDS = 86400;

function inBand(price, low, high) {
  return price >= low && price <= high;
}

function byDistance(getPrice, currentPrice) {
  return (a, b) => Math.abs(getPrice(a) - currentPrice) - Math.abs(getPrice(b) - currentPrice);
}

// zones: Rohformat wie findTargetCandidates.js: buildCandidatePool (dir/top/bottom/touched/
// invalidated/startTime/endTime/timeframe). Gesuchte OB-Richtung ist IMMER die GEGENLÄUFIGE zur
// Trade-Richtung (bullisch gegen einen Short, bärisch gegen einen Long, Philip 2026-08-30) — anders
// als bei findNearestObTargets geht es hier NICHT um die nächsten N, sondern um ALLE (offenen UND
// gehaltenen) Zonen innerhalb der ganzen Zone, siehe held/MAX_HELD_OB_AGE_DAYS.
export function findAntiConfluenceObCandidates(zones, { direction, zoneLow, zoneHigh, currentPrice, nowSec }) {
  const wantedDir = direction === "short" ? 1 : -1;
  return (zones ?? [])
    .filter((z) => z.dir === wantedDir && !z.invalidated)
    .map((z) => ({ ...z, edgePrice: direction === "short" ? z.top : z.bottom, held: z.touched }))
    .filter((z) => inBand(z.edgePrice, zoneLow, zoneHigh))
    .filter((z) => !z.held || (nowSec - z.endTime) / DAY_SECONDS <= MAX_HELD_OB_AGE_DAYS)
    .sort(byDistance((z) => z.edgePrice, currentPrice));
}

// levels: Rohformat wie buildCandidatePool (price/direction 'high'|'low'/pivotTime/touched/
// touchedTime/timeframe). Ein bullischer Sweep ist ein bereits berührtes LOW (Sellside-Liquidität
// gegrabbt, Reversal-Erwartung nach oben) — gegenläufig zu einem Short, siehe rsi.js/
// liquidityDetection.ts für dieselbe dir/direction-Konvention.
export function findAntiConfluenceSweepCandidates(levels, { direction, zoneLow, zoneHigh, currentPrice }) {
  const wantedLevelDir = direction === "short" ? "low" : "high";
  return (levels ?? [])
    .filter((l) => l.direction === wantedLevelDir && l.touched)
    .filter((l) => inBand(l.price, zoneLow, zoneHigh))
    .sort(byDistance((l) => l.price, currentPrice));
}

// divergences: Rohformat wie rsi.js: detectRsiDivergenceHistory ({type, toPrice, ...}) — toPrice
// ist der geprüfte (jüngere) Divergenz-Schwungpunkt, siehe rsi.js Kopfkommentar.
export function findAntiConfluenceDivergenceCandidates(divergences, { direction, zoneLow, zoneHigh, currentPrice }) {
  const wantedType = direction === "short" ? "bullish" : "bearish";
  return (divergences ?? [])
    .filter((d) => d.type === wantedType)
    .filter((d) => inBand(d.toPrice, zoneLow, zoneHigh))
    .sort(byDistance((d) => d.toPrice, currentPrice));
}

// Eigene, von der Ziel-Zone unabhängige Regel (Philip 2026-08-30, "EBENFALLS gilt!"): eine
// unberührte GEGENLÄUFIGE OB knapp jenseits der Invalidierung wirkt als Magnet/unfertiges Geschäft
// — bei einem Short eine bärische OB knapp ÜBER der Invalidierung, bei einem Long eine bullische
// knapp DARUNTER. Die der Invalidierung zugewandte Kante zählt (bottom bei Short/bärisch, top bei
// Long/bullisch).
export function findInvalidationObCandidates(zones, { direction, invalidation, maxPips = MAX_INVALIDATION_OB_DISTANCE_PIPS }) {
  if (invalidation == null) return [];
  const wantedDir = direction === "short" ? -1 : 1;
  const maxDistance = fromPips(maxPips);
  return (zones ?? [])
    .filter((z) => z.dir === wantedDir && !z.touched && !z.invalidated)
    .map((z) => ({ ...z, edgePrice: direction === "short" ? z.bottom : z.top }))
    .filter((z) => {
      const distance = direction === "short" ? z.edgePrice - invalidation : invalidation - z.edgePrice;
      return distance >= 0 && distance <= maxDistance;
    })
    .sort(byDistance((z) => z.edgePrice, invalidation));
}

// Einstiegspunkt fürs find_anti_confluences-Tool. zoneBoundPrice ist die ferne Kante der Zone
// (tiefstes Short-Target bzw. höchstes Long-Target, von Lana/dem Frontend aus den bereits
// gesetzten trade_targets abgeleitet) — aktueller Preis ist die andere Kante (siehe Zonen-Regel
// oben). invalidation optional, nur für die Invalidierungs-nahe Zusatzregel gebraucht.
export async function findAntiConfluenceCandidates({ instrument, direction, zoneBoundPrice, invalidation, currentTimeSec }) {
  const effectiveTimeSec = currentTimeSec ?? Math.floor(Date.now() / 1000);
  const [{ liquidityLevels, obZones, m5Candles }, priceCandles] = await Promise.all([
    buildCandidatePool(instrument, effectiveTimeSec),
    fetchForexCandles(instrument, "5m", { count: 1, toMs: effectiveTimeSec * 1000 }),
  ]);
  const currentPrice = priceCandles[priceCandles.length - 1]?.close ?? null;
  if (currentPrice == null) {
    return { instrument, direction, currentPrice: null, obCandidates: [], sweepCandidates: [], divergenceCandidates: [], invalidationObCandidates: [] };
  }

  const zoneLow = direction === "short" ? zoneBoundPrice : currentPrice;
  const zoneHigh = direction === "short" ? currentPrice : zoneBoundPrice;
  const divergences = detectRsiDivergenceHistory(m5Candles);

  return {
    instrument,
    direction,
    currentPrice,
    obCandidates: findAntiConfluenceObCandidates(obZones, { direction, zoneLow, zoneHigh, currentPrice, nowSec: effectiveTimeSec }),
    sweepCandidates: findAntiConfluenceSweepCandidates(liquidityLevels, { direction, zoneLow, zoneHigh, currentPrice }),
    divergenceCandidates: findAntiConfluenceDivergenceCandidates(divergences, { direction, zoneLow, zoneHigh, currentPrice }),
    invalidationObCandidates: findInvalidationObCandidates(obZones, { direction, invalidation }),
  };
}
