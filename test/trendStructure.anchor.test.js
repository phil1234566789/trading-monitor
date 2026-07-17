// computeStructureAnchorTime gegen echte GBPUSD-H1-Daten (siehe scripts/fetch-trend-fixture.mjs).
import { describe, expect, it } from "vitest";
import { computeStructureAnchorTime } from "../src/trendStructure.js";
import { detectLiquidityLevels } from "../src/liquidity.js";
import h1Candles from "./fixtures/gbpusd-h1-trend.json";

const H1_FRACTAL_PERIOD = 10; // muss mit trendStructure.js übereinstimmen

describe("computeStructureAnchorTime", () => {
  it("liefert einen Zeitpunkt innerhalb des geladenen H1-Fensters", () => {
    const anchor = computeStructureAnchorTime(h1Candles);
    expect(anchor).not.toBeNull();
    expect(anchor).toBeGreaterThanOrEqual(h1Candles[0].time);
    expect(anchor).toBeLessThanOrEqual(h1Candles[h1Candles.length - 1].time);
  });

  it("liefert null, wenn keine einzige H1-Fraktal-Periode voll ist (zu wenig Kerzen)", () => {
    expect(computeStructureAnchorTime(h1Candles.slice(0, 5))).toBeNull();
  });

  it("nutzt die pivotTime des zuletzt gebrochenen H1-Pivots als Anker", () => {
    const { highs, lows } = detectLiquidityLevels(h1Candles, H1_FRACTAL_PERIOD);
    const allPivots = [...highs, ...lows];
    const lastBroken = allPivots.filter((p) => p.touched).sort((a, b) => b.touchedTime - a.touchedTime)[0];

    const anchor = computeStructureAnchorTime(h1Candles);

    expect(lastBroken).toBeTruthy(); // im geladenen ~20-Tage-Fenster sollte mind. 1 H1-Pivot gebrochen sein
    expect(anchor).toBe(lastBroken.pivotTime);
  });

  it("Fallback greift, wenn kein H1-Pivot im Fenster gebrochen ist: ältester der letzten 3 Pivots", () => {
    // Synthetisch statt Fixture-Ausschnitt, damit deterministisch garantiert genau 3 Pivot-
    // Highs entstehen und keiner davon je gebrochen wird (fallende Bump-Höhen -> jeder
    // spätere Bump bleibt unter allen früheren, kein Wick erreicht sie je wieder).
    const n = 200;
    const candles = Array.from({ length: n }, (_, i) => ({
      time: 1_700_000_000 + i * 3600,
      open: 1.0,
      high: 1.0,
      low: 0.99,
      close: 1.0,
    }));
    const bumpPositions = [40, 90, 140]; // Abstand > 2*Periode+1, keine Überlappung der Fraktal-Fenster
    const bumpHeights = [1.3, 1.25, 1.2]; // fallend -> keine spätere Kerze berührt einen früheren Bump
    bumpPositions.forEach((p, i) => {
      candles[p].high = bumpHeights[i];
    });

    const { highs, lows } = detectLiquidityLevels(candles, H1_FRACTAL_PERIOD);
    const allPivots = [...highs, ...lows];
    expect(allPivots).toHaveLength(3); // Testaufbau absichern
    expect(allPivots.some((p) => p.touched)).toBe(false);

    // Erwartung: ältester der (hier: einzigen) 3 Pivots = der erste Bump.
    expect(computeStructureAnchorTime(candles)).toBe(candles[bumpPositions[0]].time);
  });
});
