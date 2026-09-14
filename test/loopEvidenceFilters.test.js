// Die beiden bias-ungefilterten Evidenz-Felder aus dem GBPUSD-Backtest 09.09.2026.
//
// Jedes bisherige Evidenz-Feld ist nach der Bias-Richtung gefiltert, und oppositeSetup — das einzige
// Fenster zur Gegenrichtung — existiert erst, wenn ein VOLLSTAENDIGES Sweep+Fraktal+OB-Muster fertig
// ist. Dazwischen klaffte ein 40-Minuten-Loch: der baerische M5-OB 1.35647-1.3568 (die eigentliche
// Entry-Zone, entstanden 09:20) stand in keinem einzigen Feld, weil er weder retestet war noch zu
// einem fertigen Setup gehoerte.
//
// Die Filter selbst sind bewusst zwei Zeilen in performFullTick (dealingRangeLoop.ts, nicht
// importierbar — Deno npm:-Imports). Hier steht deshalb die Filter-Logik als Spezifikation, damit
// die Regeln festgenagelt sind: was genau zaehlt als "frisch" und was faellt raus.
import { describe, expect, it } from "vitest";

const FRESH_M5_OB_HOURS = 2;
const AT_SEC = 1788939000; // 2026-09-09 09:30 Uhr Berlin

// Nachbau des Filters aus performFullTick.
const freshM5ObZones = (zones, atSec) => zones.filter((z) => z.startTime != null && z.startTime >= atSec - FRESH_M5_OB_HOURS * 3600);

describe("freshM5ObZones", () => {
  // Die echte Lage um 09:30: die Entry-Zone war 10 Minuten alt, ungetoucht, ohne Retest.
  const zones = [
    { direction: "short", top: 1.3568, bottom: 1.35647, touched: false, retested: false, startTime: 1788938400 }, // 09:20, die Entry-Zone
    { direction: "long", top: 1.35574, bottom: 1.35528, touched: true, retested: true, startTime: 1788934500 }, // 08:15
    { direction: "short", top: 1.35786, bottom: 1.35682, touched: false, retested: false, startTime: 1787929500 }, // 28.08., alt
  ];

  it("enthaelt die frische Entry-Zone, obwohl sie weder touched noch retested ist", () => {
    const result = freshM5ObZones(zones, AT_SEC);
    expect(result.map((z) => z.bottom)).toContain(1.35647);
  });

  it("filtert NICHT nach Richtung — der Bias war long, die Zone ist baerisch", () => {
    const result = freshM5ObZones(zones, AT_SEC);
    expect(result.find((z) => z.bottom === 1.35647)?.direction).toBe("short");
  });

  it("laesst Zonen aelter als das Frische-Fenster raus", () => {
    const result = freshM5ObZones(zones, AT_SEC);
    expect(result.map((z) => z.bottom)).not.toContain(1.35682);
  });

  it("nimmt eine Zone exakt an der Fenstergrenze noch mit", () => {
    const edge = [{ direction: "short", top: 1.36, bottom: 1.3599, startTime: AT_SEC - FRESH_M5_OB_HOURS * 3600 }];
    expect(freshM5ObZones(edge, AT_SEC)).toHaveLength(1);
  });

  it("ueberspringt Zonen ohne startTime, statt sie faelschlich als frisch zu werten", () => {
    expect(freshM5ObZones([{ direction: "short", top: 1.36, bottom: 1.3599, startTime: null }], AT_SEC)).toHaveLength(0);
  });
});

describe("allLiquiditySweeps — ungefiltert, beide Richtungen", () => {
  // buildRecentReactions liefert bereits beide Richtungen; performFullTick warf die Gegenrichtung
  // bisher weg (filter auf wantedSweepDir). Hier der Beleg, dass genau das den Unterschied macht.
  const sweeps = [
    { direction: "high", price: 1.35652, timeframe: "4H", touchedTime: 1788937800 },
    { direction: "low", price: 1.35413, timeframe: "5M", touchedTime: 1788920700 },
  ];
  const wantedSweepDir = "low"; // Bias long -> bisheriger Filter

  it("der alte Bias-Filter haette das 4H-Hoch 1.35652 verschluckt", () => {
    expect(sweeps.filter((s) => s.direction === wantedSweepDir).map((s) => s.price)).not.toContain(1.35652);
  });

  it("ungefiltert ist es drin", () => {
    expect(sweeps.map((s) => s.price)).toContain(1.35652);
  });
});
