// Bug-Report Philip 2026-08-29 (GBPUSD M5, 28.08.2026): bonusLabelForPivot/contextForPivot
// vergaben "Asia-High" allein darüber, ob ein Pivot zeitlich in die Asia-Session fiel und dir===1
// war ("high"-Pivot-Typ) — nicht darüber, ob sein Preis tatsächlich dem höchsten Punkt der Session
// entspricht. Erster Fix-Wurf hatte einen Folgefehler: alles, was nicht exakt High/Low traf, wurde
// pauschal als "Mid" ausgegeben — Philip pinnte daraufhin 4 echte Level (Asia-Session 28.08.2026,
// reales High 1.35985/Low 1.35875/Mid 1.35930), von denen zwei fälschlich "Asia-Mid" waren, obwohl
// sie weder nah am High noch nah am rechnerischen Mid lagen. Diese Tests reproduzieren exakt diesen
// 4-Level-Fall (siehe sessionOccurrences.js: SESSION_MID_TOLERANCE_RATIO) plus den Fallback ohne
// candles-Parameter (Altverhalten).
import { describe, expect, it } from "vitest";
import { buildSessionContextLookup, bonusLabelForPivot, contextForPivot } from "../src/sessionOccurrences.js";

const DAY = 24 * 3600;
const DAY_START = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000; // Montag 06.07.2026 00:00 UTC
const ASIA_SESSION = { label: "Asia", highLowRelevant: true, fromMinutes: 0, toMinutes: 7 * 60 };

function candle(hourOffset, high, low) {
  return { time: DAY_START + hourOffset * 3600, high, low, open: high, close: low };
}

describe("bonusLabelForPivot/contextForPivot: Preisvergleich gegen echten Session-High/Low/Mid", () => {
  // Reale Asia-Range aus Philips 4-Level-Bug-Report (28.08.2026, GBPUSD M5): High 1.35985 (2h),
  // Low 1.35875 (5h) -> Mid 1.35930, Range 11 Pips.
  const candles = [candle(2, 1.35985, 1.3597), candle(5, 1.3589, 1.35875)];
  const pivotTime = DAY_START + 3 * 3600;

  it("Level #201 (echtes High): 1.35985 -> 'Asia-High'/'asia high'", () => {
    const lookup = buildSessionContextLookup([ASIA_SESSION], DAY_START, DAY_START + DAY, 0, candles);
    expect(bonusLabelForPivot(pivotTime, 1, 1.35985, lookup)).toBe("Asia-High");
    expect(contextForPivot(pivotTime, 1, 1.35985, lookup)).toBe("asia high");
  });

  // Bug-Report zweite Runde: 0,4 Pips vom High entfernt (zu weit für den High-Epsilon-Vergleich)
  // UND 5,1 Pips/46% der Range vom Mid entfernt (weit außerhalb der Mid-Toleranzzone) -> kein
  // Kontext, weder High noch Mid. Philip: "falsch" (vorher fälschlich als Asia-Mid gelabelt).
  it("Level #202 (nah am High, aber kein Treffer, weit vom Mid): 1.35981 -> kein Kontext (null)", () => {
    const lookup = buildSessionContextLookup([ASIA_SESSION], DAY_START, DAY_START + DAY, 0, candles);
    expect(bonusLabelForPivot(pivotTime, 1, 1.35981, lookup)).toBeNull();
    expect(contextForPivot(pivotTime, 1, 1.35981, lookup)).toBeNull();
  });

  // 3,6 Pips/33% der Range vom Mid entfernt -> außerhalb der 20%-Toleranzzone. Philip: "falsch".
  it("Level #203 (weder High noch nah genug am Mid): 1.35966 -> kein Kontext (null)", () => {
    const lookup = buildSessionContextLookup([ASIA_SESSION], DAY_START, DAY_START + DAY, 0, candles);
    expect(bonusLabelForPivot(pivotTime, 1, 1.35966, lookup)).toBeNull();
    expect(contextForPivot(pivotTime, 1, 1.35966, lookup)).toBeNull();
  });

  // 1,6 Pips/15% der Range vom Mid entfernt -> innerhalb der 20%-Toleranzzone. Philip: "richtig".
  it("Level #204 (nah genug am Mid): 1.35946 -> 'Asia-Mid'/'asia mid'", () => {
    const lookup = buildSessionContextLookup([ASIA_SESSION], DAY_START, DAY_START + DAY, 0, candles);
    expect(bonusLabelForPivot(pivotTime, 1, 1.35946, lookup)).toBe("Asia-Mid");
    expect(contextForPivot(pivotTime, 1, 1.35946, lookup)).toBe("asia mid");
  });

  it("Pivot-Preis == echtes Session-Low -> 'Asia-Low'/'asia low'", () => {
    const lookup = buildSessionContextLookup([ASIA_SESSION], DAY_START, DAY_START + DAY, 0, candles);
    expect(bonusLabelForPivot(pivotTime, -1, 1.35875, lookup)).toBe("Asia-Low");
    expect(contextForPivot(pivotTime, -1, 1.35875, lookup)).toBe("asia low");
  });

  it("ohne candles-Parameter (Default []): Fallback auf alte rein zeitfenster-basierte Zuordnung", () => {
    const lookup = buildSessionContextLookup([ASIA_SESSION], DAY_START, DAY_START + DAY, 0);
    // Wie vor dem Fix: dir=1 -> "Asia-High", unabhängig vom Preis, da kein rangeHigh/rangeLow bekannt.
    expect(bonusLabelForPivot(pivotTime, 1, 1.35946, lookup)).toBe("Asia-High");
    expect(contextForPivot(pivotTime, 1, 1.35946, lookup)).toBe("asia high");
  });

  it("Pivot außerhalb jeder highLowRelevant-Session -> kein Bonus/Kontext", () => {
    const lookup = buildSessionContextLookup([ASIA_SESSION], DAY_START, DAY_START + DAY, 0, candles);
    const outsideTime = DAY_START + 12 * 3600; // 12:00, außerhalb 00:00-07:00
    expect(bonusLabelForPivot(outsideTime, 1, 1.36, lookup)).toBeNull();
    expect(contextForPivot(outsideTime, 1, 1.36, lookup)).toBeNull();
  });
});

// Philip 2026-08-29, direkt im Anschluss an die Asia-Mid-Kalibrierung: "Mid" nur für Asia — bei
// anderen Sessions (NY, MMM, ...) reicht ihm ein korrektes High/Low, kein Mid-Konzept gewünscht.
describe("sessionExtremeSuffix: 'Mid' gilt nur für die Asia-Session", () => {
  const NY_SESSION = { label: "NY", highLowRelevant: true, fromMinutes: 13 * 60, toMinutes: 22 * 60 };
  // Gleiche Range/Mid-Konstellation wie Level #204 oben (gültiger Asia-Mid-Fall), nur diesmal in
  // der NY-Session -> darf trotzdem kein "NY-Mid" ergeben.
  const nyCandles = [candle(14, 1.35985, 1.3597), candle(17, 1.3589, 1.35875)];
  const nyPivotTime = DAY_START + 15 * 3600;

  it("Preis nah genug am rechnerischen Mid, aber Session ist NY -> kein Kontext (null), kein 'NY-Mid'", () => {
    const lookup = buildSessionContextLookup([NY_SESSION], DAY_START, DAY_START + DAY, 0, nyCandles);
    expect(bonusLabelForPivot(nyPivotTime, 1, 1.35946, lookup)).toBeNull();
    expect(contextForPivot(nyPivotTime, 1, 1.35946, lookup)).toBeNull();
  });

  it("NY-High/-Low funktionieren weiterhin normal (nur Mid ist Asia-exklusiv)", () => {
    const lookup = buildSessionContextLookup([NY_SESSION], DAY_START, DAY_START + DAY, 0, nyCandles);
    expect(bonusLabelForPivot(nyPivotTime, 1, 1.35985, lookup)).toBe("NY-High");
    expect(bonusLabelForPivot(nyPivotTime, -1, 1.35875, lookup)).toBe("NY-Low");
  });
});
