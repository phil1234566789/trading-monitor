// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  assessLiquidityForce,
  assessObForce,
  assessForce,
} from "../supabase/functions/trading-monitor-mcp/forceAssessment.ts";

// 09.09.2026 09:10 Berlin — der Zeitpunkt, an dem Schritt 3 und Schritt 5 sich widersprachen.
const AT_SEC = 1788937800;

describe("assessLiquidityForce — Kraft kommt aus dem Level, nicht aus dem Trend", () => {
  it("gesweeptes Hoch -> bärische Kraft", () => {
    // liquidität.md: gesweeptes Hoch = Kraft nach unten, unabhängig vom laufenden Trend.
    const s = assessLiquidityForce(
      { price: 1.35652, direction: "high", pivotTimeSec: 1788181200, touched: true, kontext: "NY-High Major (6d 18h)" },
      AT_SEC,
    );
    expect(s.side).toBe("bearish");
    expect(s.inducementClass).toBe("major");
    expect(s.text).toBe("Major Inducement 1.35652 (NY-High Major (6d 18h)) angelaufen ---> Kraft nach unten.");
  });

  it("gesweeptes Tief -> bullische Kraft", () => {
    const s = assessLiquidityForce(
      { price: 1.35413, direction: "low", pivotTimeSec: AT_SEC - 3600, touched: true, kontext: "Asia-Mid" },
      AT_SEC,
    );
    expect(s.side).toBe("bullish");
    expect(s.inducementClass).toBe("minor");
    expect(s.text).toBe("Minor Inducement 1.35413 (Asia-Mid) angelaufen ---> Kraft nach oben.");
  });

  it("sagt NIE 'sauber durchbrochen' — das entscheidet die Folge-PA, nicht der Preisvergleich", () => {
    // Der eigentliche 09.09.-Bug: eine einzelne M5-Kerze 0,3 Pips über einem 4H-Major-Inducement
    // wurde als Durchbruch gemeldet. Es gibt für ein LQ-Level jetzt gar kein broken-Verdikt mehr.
    const s = assessLiquidityForce(
      { price: 1.35652, direction: "high", pivotTimeSec: 1788181200, touched: true, kontext: null },
      AT_SEC,
    );
    expect(s.text).not.toContain("durchbrochen");
    expect(s.text).toContain("angelaufen");
  });

  it("ungetouchtes Level -> kein Kraft-Signal (das ist ein Watch-Level, kein Ereignis)", () => {
    expect(assessLiquidityForce({ price: 1.35786, direction: "high", pivotTimeSec: 1787928900, touched: false }, AT_SEC)).toBeNull();
  });
});

describe("assessObForce — Kraft kommt aus der OB-Richtung, nicht aus dem Trend", () => {
  it("bullischer OB hält -> bullische Stärke", () => {
    const s = assessObForce({ direction: "long", timeframe: "1H", touched: true, retested: true, invalidated: false, top: 1.35341, bottom: 1.35343 });
    expect(s.side).toBe("bullish");
    expect(s.text).toBe("bullischer 1H-OB angetestet und hat gehalten ---> bullische Stärke.");
  });

  it("bärischer OB hält -> bärische Stärke", () => {
    const s = assessObForce({ direction: "short", timeframe: "4H", touched: true, retested: true, invalidated: false, top: 1.35976, bottom: 1.35739 });
    expect(s.side).toBe("bearish");
    expect(s.text).toBe("bärischer 4H-OB angetestet und hat gehalten ---> bärische Stärke.");
  });

  // Der zweite Vorzeichen-Bug, gleiche Klasse wie der Level-Bug bis 13.09.2026: determineTrendForce
  // nahm bullisch/bärisch aus dem TREND. Ein durchbrochener bullischer OB in einem Downtrend wurde
  // dadurch als "bärische Schwäche" gemeldet — richtig ist bärische STÄRKE (die Gegenseite gewinnt
  // an dieser Preiszone an Kraft, orderblöcke.md#reaktionsmuster-am-ob).
  it("bullischer OB durchbrochen -> bärische Stärke, unabhängig vom Trend", () => {
    const s = assessObForce({ direction: "long", timeframe: "1H", touched: true, retested: false, invalidated: true, top: 1.35457, bottom: 1.35419 });
    expect(s.side).toBe("bearish");
    expect(s.text).toBe("bullischer 1H-OB durchbrochen ---> bärische Stärke.");
  });

  it("bärischer OB durchbrochen -> bullische Stärke", () => {
    const s = assessObForce({ direction: "short", timeframe: "1H", touched: true, retested: false, invalidated: true, top: 1.35419, bottom: 1.35374 });
    expect(s.side).toBe("bullish");
    expect(s.text).toBe("bärischer 1H-OB durchbrochen ---> bullische Stärke.");
  });

  it("'Retest läuft' (getoucht, nicht retested) -> kein Signal statt geraten", () => {
    // orderblöcke.md#retest-status: "Noch keine definierte Behandlung dieses Zustands."
    expect(assessObForce({ direction: "short", timeframe: "1H", touched: true, retested: false, invalidated: false })).toBeNull();
  });

  it("offener OB (nie getoucht) -> kein Signal", () => {
    expect(assessObForce({ direction: "long", timeframe: "1H", touched: false, retested: false, invalidated: false })).toBeNull();
  });

  it("invalidiert gewinnt IMMER, auch nach bestätigtem Retest", () => {
    // orderblöcke.md#retest-status: "Invalidiert ... Gewinnt IMMER, unabhängig von der Vorgeschichte."
    const s = assessObForce({ direction: "long", timeframe: "4H", touched: true, retested: true, invalidated: true });
    expect(s.side).toBe("bearish");
    expect(s.text).toContain("durchbrochen");
  });
});

describe("assessForce — beide Quellen, beide Richtungen, kein fertiges Urteil", () => {
  it("sammelt LQ- und OB-Signale gemeinsam und trennt sie nach Seite", () => {
    const result = assessForce(
      [
        { price: 1.35652, direction: "high", pivotTimeSec: 1788181200, touched: true, kontext: "NY-High Major (6d 18h)" },
        { price: 1.35413, direction: "low", pivotTimeSec: AT_SEC - 3600, touched: true, kontext: "Asia-Mid" },
      ],
      [{ direction: "long", timeframe: "1H", touched: true, retested: true, invalidated: false, top: 1.35341, bottom: 1.35343 }],
      AT_SEC,
    );
    expect(result.signals).toHaveLength(3);
    expect(result.bullish).toHaveLength(2);
    expect(result.bearish).toHaveLength(1);
    expect(result.signals.filter((s) => s.source === "ob")).toHaveLength(1);
    expect(result.signals.filter((s) => s.source === "liquidity")).toHaveLength(2);
  });

  it("trifft bewusst KEIN Urteil — ausgeglichener Kampf ist qualitativ, kein Zählerstand", () => {
    const result = assessForce(
      [{ price: 1.35652, direction: "high", pivotTimeSec: 1788181200, touched: true }],
      [{ direction: "short", timeframe: "4H", touched: true, retested: true, invalidated: false }],
      AT_SEC,
    );
    expect(result.verdict).toBeNull();
  });

  it("meldet die Seite eines Major Inducement für die Vorrangregel", () => {
    const result = assessForce(
      [
        { price: 1.35652, direction: "high", pivotTimeSec: 1788181200, touched: true },
        { price: 1.35413, direction: "low", pivotTimeSec: AT_SEC - 3600, touched: true },
      ],
      [],
      AT_SEC,
    );
    expect(result.majorInducementSides).toEqual(["bearish"]);
  });

  it("leere Eingabe -> leere Signale, kein Fehler", () => {
    const result = assessForce([], [], AT_SEC);
    expect(result.signals).toHaveLength(0);
    expect(result.majorInducementSides).toHaveLength(0);
  });
});
