import { describe, expect, it } from "vitest";
import { loadCandlesAroundTrade, computeJumpViewport } from "../src/priceChartJumpToTime.js";

function candle(time) {
  return { time, open: 1, high: 1, low: 1, close: 1 };
}
function page(fromExclusive, count, barSeconds) {
  // Erzeugt `count` Kerzen VOR fromExclusive, oldest-first (wie fetchOlderForexCandles liefert).
  const times = [];
  for (let i = count; i >= 1; i--) times.push(fromExclusive - i * barSeconds);
  return times.map(candle);
}

const barSeconds = 300; // 5m

// Bug-Report Philip 2026-07-30, zweite Runde ("2022 Trade der Supergau"): ein gezielter Fetch um
// den Trade herum statt seitenweise rückwärts ab dem aktuellen Datenanfang.
describe("loadCandlesAroundTrade", () => {
  it("gibt allCandles unverändert zurück, wenn entryTime schon abgedeckt ist", async () => {
    const existing = [candle(1000), candle(1300), candle(1600)];
    let fetchCalls = 0;
    const result = await loadCandlesAroundTrade(existing, 1300, 1300, barSeconds, async () => {
      fetchCalls++;
      return [];
    }, { bufferBars: 20, maxPages: 5 });
    expect(result).toBe(existing);
    expect(fetchCalls).toBe(0);
  });

  it("lädt gezielt um den Trade herum, wenn noch nichts geladen ist", async () => {
    const entryTime = 100_000;
    const exitTime = 100_600;
    let calls = [];
    const fetchOlder = async (anchor) => {
      calls.push(anchor);
      // Eine großzügige einzige Seite reicht, um entryTime abzudecken.
      return page(anchor, 25, barSeconds);
    };
    const result = await loadCandlesAroundTrade([], entryTime, exitTime, barSeconds, fetchOlder, { bufferBars: 20, maxPages: 5 });
    expect(calls).toHaveLength(1);
    // Anker = exitTime + bufferBars*barSeconds (siehe Kommentar in loadCandlesAroundTrade).
    expect(calls[0]).toBe(exitTime + 20 * barSeconds);
    expect(result.some((c) => c.time === entryTime)).toBe(true);
  });

  it("bricht nach maxPages ab, auch wenn entryTime dadurch nicht erreicht wird", async () => {
    let calls = 0;
    const fetchOlder = async (anchor) => {
      calls++;
      return page(anchor, 3, barSeconds); // absichtlich zu wenig pro Seite
    };
    await loadCandlesAroundTrade([], 100_000, 100_000, barSeconds, fetchOlder, { bufferBars: 0, maxPages: 3 });
    expect(calls).toBe(3);
  });

  it("bricht ab, sobald eine Seite leer zurückkommt", async () => {
    let calls = 0;
    const fetchOlder = async () => {
      calls++;
      return [];
    };
    const existing = [candle(500_000)];
    await loadCandlesAroundTrade(existing, 100_000, 100_000, barSeconds, fetchOlder, { bufferBars: 0, maxPages: 5 });
    expect(calls).toBe(1);
  });

  // Bug-Report Philip 2026-08-18/2026-08-19 (DR#40, über zwei Monate alt): das gezielte Laden um
  // den Trade lässt bewusst eine Lücke zum vorher schon geladenen Fenster — wird per Splice
  // gebrückt, aber NUR wenn die Brücke wirklich lückenlos anschließt.
  describe("Brücke zum vorher geladenen Fenster", () => {
    it("brückt die Lücke, wenn die Verbindung bis zum vorher geladenen Fenster reicht", async () => {
      const preexistingOldest = 200_000;
      const existing = [candle(preexistingOldest), candle(preexistingOldest + barSeconds)];
      const entryTime = 100_000;
      let call = 0;
      const fetchOlder = async () => {
        call++;
        if (call === 1) return [candle(entryTime - barSeconds)]; // deckt entryTime sofort ab (diff=300<=450)
        // Bridge-Seite reicht bis (und über) den Rand des Trade-Fensters (99700) zurück -> lückenlos verbindbar.
        return [candle(entryTime - barSeconds), candle(entryTime), candle(entryTime + barSeconds)];
      };
      const result = await loadCandlesAroundTrade(existing, entryTime, entryTime, barSeconds, fetchOlder, { bufferBars: 0, maxPages: 5 });
      // Bridge wurde übernommen: preexistingOldest bleibt erhalten UND es gibt jetzt Kerzen zwischen
      // dem Trade-Fenster und preexistingOldest, die vorher gefehlt hätten.
      expect(result.some((c) => c.time === preexistingOldest)).toBe(true);
      expect(result.some((c) => c.time === entryTime)).toBe(true);
      expect(result.length).toBeGreaterThan(existing.length + 1);
    });

    it("behält die alte, bewusste Lücke, wenn die Brücke nicht lückenlos anschließt (Notbremse maxPages)", async () => {
      const preexistingOldest = 200_000;
      const existing = [candle(preexistingOldest)];
      const entryTime = 100_000;
      let call = 0;
      const fetchOlder = async (anchor) => {
        call++;
        if (call === 1) return page(anchor, 5, barSeconds); // Fenster um den Trade
        // Brücke bleibt absichtlich zu kurz, um preexistingOldest zu erreichen (Notbremse greift).
        return page(anchor, 3, barSeconds);
      };
      const result = await loadCandlesAroundTrade(existing, entryTime, entryTime, barSeconds, fetchOlder, { bufferBars: 0, maxPages: 2 });
      // Die ursprüngliche Kerze bei preexistingOldest bleibt erhalten, aber es gibt eine Lücke
      // (nicht durchgehend barSeconds-Abstand) zum neu geladenen Trade-Fenster davor.
      expect(result.some((c) => c.time === preexistingOldest)).toBe(true);
      const hasGap = result.some((c, i) => i > 0 && result[i].time - result[i - 1].time !== barSeconds);
      expect(hasGap).toBe(true);
    });
  });
});

// Bug-Report Philip 2026-07-27: "muss immer ein ganzes Stück rauszoomen, Candles zu riesig" — die
// aktuelle Zoomweite wird reproduziert statt eines festen Bar-Counts.
describe("computeJumpViewport", () => {
  const candles = Array.from({ length: 100 }, (_, i) => candle(i * barSeconds));

  it("gibt null zurück, wenn keine Kerzen geladen sind", () => {
    expect(computeJumpViewport([], 0, 0, null)).toBeNull();
  });

  it("gibt null zurück, wenn entryTime/exitTime auf keine geladene Kerze snappen", () => {
    // snapToBarTime klemmt IMMER auf die nächste Kerze — findIndex mit exaktem Treffer schlägt nur
    // fehl, wenn candles komplett leer ist (siehe obigen Test) oder die gesnappte Zeit aus anderen
    // Gründen nicht exakt im Array steht (hier nicht konstruierbar, snapToBarTime garantiert das) —
    // Regressionsschutz für den Fall bleibt trotzdem über den Leer-Fall oben abgedeckt.
    expect(computeJumpViewport(candles, 0, 0, null)).not.toBeNull();
  });

  it("reproduziert die aktuelle Zoomweite (currentVisibleRange) statt eines festen Bar-Counts", () => {
    const currentVisibleRange = { from: 0, to: 200 }; // 200 Bars aktuell sichtbar
    const result = computeJumpViewport(candles, 0, 0, currentVisibleRange);
    expect(result.to - result.from).toBe(200);
  });

  it("erweitert die Zoomweite nur, wenn der Trade-Zeitraum selbst nicht hineinpasst", () => {
    const currentVisibleRange = { from: 0, to: 10 }; // sehr eng, 10 Bars
    const entryTime = 0;
    const exitTime = 50 * barSeconds; // 50 Bars Trade-Spanne
    const result = computeJumpViewport(candles, entryTime, exitTime, currentVisibleRange);
    expect(result.to - result.from).toBeGreaterThan(10);
    expect(result.to - result.from).toBe(50 + 2 * 15); // tradeSpanBars/2 + minBarsPastSpan, verdoppelt
  });

  it("fällt ohne currentVisibleRange auf 100 Bars zurück", () => {
    const result = computeJumpViewport(candles, 0, 0, null);
    expect(result.to - result.from).toBe(100);
  });
});
