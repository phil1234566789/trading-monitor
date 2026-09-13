// Dritter, fall-unabhängiger Watch-Kanal (computeHtfWatchLevels/assessInducement).
//
// Regressionsfall GBPUSD 09.09.2026: die beiden Aufmerksamkeitslevel aus docs/attention-levels.md
// sind exklusiv — sobald eine Reaktion gefunden ist, füttert performFullTick nur noch M5-Level in
// computeWatchLevels. M5-Level liegen dichter und verdrängen HTF-Level. Ab dem ersten Tick um 09:00
// war durchgehend hasReaction=true, das 4H-Level 1.35652 tauchte deshalb den ganzen Tag in keinem
// einzigen Tick auf, obwohl der Kurs direkt darauf zulief und es um 09:10 überschritt.
import { describe, expect, it } from "vitest";
import { computeHtfWatchLevels, assessInducement } from "../supabase/functions/trading-monitor-mcp/fallClassifier.ts";

// Die tatsächliche Lage am 09.09.2026 um 09:00 Uhr Berlin, Kurs 1.35588.
const PRICE_0900 = 1.35588;
const LEVELS_0900 = [
  { price: 1.35616, touched: true, timeframe: "1H", id: 312277, pivotTime: 1788872400, direction: "high" },
  { price: 1.35528, touched: false, timeframe: "1H", id: 329003, pivotTime: 1788760800, direction: "high" },
  { price: 1.35593, touched: true, timeframe: "1H", id: 260577, pivotTime: 1788220800, direction: "high" },
  { price: 1.35976, touched: false, timeframe: "1H", id: 253629, pivotTime: 1787925600, direction: "high" },
  { price: 1.3529, touched: false, timeframe: "1H", id: 312461, pivotTime: 1788901200, direction: "low" },
  { price: 1.35213, touched: false, timeframe: "1H", id: 312460, pivotTime: 1788861600, direction: "low" },
  // Das entscheidende Level: 4H-NY-High, ungetoucht, 6,4 Pips über dem Kurs.
  { price: 1.35652, touched: false, timeframe: "4H", id: 268994, pivotTime: 1788181200, direction: "high" },
  { price: 1.34855, touched: false, timeframe: "4H", id: 299776, pivotTime: 1788512400, direction: "low" },
];

describe("computeHtfWatchLevels", () => {
  it("findet 1.35652 als nächstes HTF-Level über dem Preis (GBPUSD 09.09.2026, 09:00)", () => {
    const { above } = computeHtfWatchLevels(PRICE_0900, LEVELS_0900);
    expect(above?.price).toBe(1.35652);
    expect(above?.timeframe).toBe("4H");
    expect(above?.refId).toBe(268994);
    // Ohne sourceTimeSec ließe sich beim Treffer die Inducement-Klasse nicht bestimmen.
    expect(above?.sourceTimeSec).toBe(1788181200);
  });

  it("findet 1.35528 als nächstes HTF-Level unter dem Preis", () => {
    // Nicht 1.3529: 1.35528 ist ebenfalls ungetoucht und mit 6,0 statt 29,8 Pips deutlich näher.
    const { below } = computeHtfWatchLevels(PRICE_0900, LEVELS_0900);
    expect(below?.price).toBe(1.35528);
  });

  it("überspringt bereits getouchte Level (1.35593/1.35616 liegen näher, sind aber touched)", () => {
    const { above } = computeHtfWatchLevels(PRICE_0900, LEVELS_0900);
    expect(above?.price).not.toBe(1.35593);
    expect(above?.price).not.toBe(1.35616);
  });

  it("ignoriert M5-Level — sie würden HTF sonst genau wie im Bug verdrängen", () => {
    const withM5 = [...LEVELS_0900, { price: 1.35625, touched: false, timeframe: "5M", pivotTime: 1788934500, direction: "high" }];
    const { above } = computeHtfWatchLevels(PRICE_0900, withM5);
    expect(above?.price).toBe(1.35652);
  });

  it("ignoriert OB-Kanten (nur Liquidity-Level, ein Inducement ist ein LQ-Sweep)", () => {
    // computeHtfWatchLevels nimmt gar keine OB-Liste entgegen — der Aufruf bleibt zweistellig.
    expect(computeHtfWatchLevels.length).toBe(2);
  });
});

describe("assessInducement", () => {
  // 1.35652: Pivot Mo 31.08.2026 13:00 UTC, angelaufen Mi 09.09.2026 07:10 UTC -> 6d 18h
  // Handelszeit. Ab 5 Handelstagen ist es ein Major Inducement (liquidität.md) — vor dem
  // dataExport-Fix wurde es als "Medium" gemeldet.
  it("1.35652 am 09.09.2026 09:10 -> Major Inducement, Kraft nach unten", () => {
    const result = assessInducement({ price: 1.35652, pivotTimeSec: 1788181200, direction: "high" }, 1788937800);
    expect(result.class).toBe("major");
    expect(result.text).toBe("Major Inducement 1.35652 angelaufen ---> Kraft nach unten.");
  });

  it("gesweeptes Tief -> Kraft nach oben (die Umkehrung, die im Backtest verdreht wurde)", () => {
    const result = assessInducement({ price: 1.3529, pivotTimeSec: 1788181200, direction: "low" }, 1788937800);
    expect(result.text).toBe("Major Inducement 1.3529 angelaufen ---> Kraft nach oben.");
  });

  it("frisches Level -> minor", () => {
    const atSec = 1788937800;
    const result = assessInducement({ price: 1.356, pivotTimeSec: atSec - 3 * 3600, direction: "high" }, atSec);
    expect(result.class).toBe("minor");
    expect(result.text).toContain("Minor Inducement");
  });
});
