// Chat 2026-07-28: die Trade-Setup-LS-Linie (PriceChart.vue) und die "1h LQ-Sweep"-Linie
// (marketStructureAnalysis.ts) zeigen seit collectH1LqLevels oft denselben Pivot zweimal — Philip
// wollte identischen Label-Text ("Major LS 1,13545 (22d 19h alt)"), damit sich beide beim
// Überlappen sauber lesen lassen statt zwei leicht unterschiedliche Strings übereinander.
import { describe, expect, it } from "vitest";
import { formatLsLabel, bullBearLabelSide, formatLiquidityLevelLabel } from "../src/liquidity.js";

// Tue 28.07.2026 12:00 UTC als fixer "jetzt"-Anker — Pivot-Zeitpunkte unten bewusst so gewählt,
// dass keine Wochenend-Arithmetik (businessSecondsBetween lässt Sa/So raus) die erwarteten Werte
// verkompliziert.
const NOW = Date.UTC(2026, 6, 28, 12, 0, 0) / 1000;

describe("formatLsLabel", () => {
  it("minor (< 1 Geschäftstag): kein Tier-Präfix, aus Platzgründen (Chat 2026-07-28)", () => {
    const pivotTime = NOW - 3 * 3600; // 3h alt
    expect(formatLsLabel("1,13545", pivotTime, NOW)).toBe("LS 1,13545 (3h alt)");
  });

  it("medium (1-7 Geschäftstage): 'Medium '-Präfix", () => {
    const pivotTime = Date.UTC(2026, 6, 24, 12, 0, 0) / 1000; // Fr 24.07. 12:00 UTC -> 2 Geschäftstage
    expect(formatLsLabel("1,13545", pivotTime, NOW)).toBe("Medium LS 1,13545 (2d alt)");
  });

  it("major (> 7 Geschäftstage): 'Major '-Präfix — der eigentliche Bug-Report-Fall (26.06. -> 28.07.)", () => {
    const pivotTime = Date.UTC(2026, 5, 22, 12, 0, 0) / 1000; // 26 Geschäftstage alt
    expect(formatLsLabel("1,13545", pivotTime, NOW)).toBe("Major LS 1,13545 (26d alt)");
  });

  it("ohne pivotTime/nowSec: nur 'LS {price}', kein Tier/Alter", () => {
    expect(formatLsLabel("1,13545", undefined, NOW)).toBe("LS 1,13545");
    expect(formatLsLabel("1,13545", NOW, undefined)).toBe("LS 1,13545");
  });
});

describe("bullBearLabelSide", () => {
  it("bullisch -> unterhalb, bärisch -> oberhalb der Linie", () => {
    expect(bullBearLabelSide(false)).toBe("end-below");
    expect(bullBearLabelSide(true)).toBe("end-above");
  });
});

// Chat 2026-08-26, Philip: "<bonus> <major|medium> <alter>" ohne Debug, zusätzlich "<preis>" ans
// Ende mit Debug. Der Sweep/High/Low-Typtext ist wieder raus (zweite Runde desselben Chats:
// "dann kann das label 'sweep|high|low' ja weg") — Farbe + über/unter-Position zeigen das am Chart
// weiterhin an, touched/dir fließen also NICHT mehr in den Label-Text ein. Alter als reines "(3h)"
// statt "(3h alt)" (dritte Runde: "es ist absolut klar mittlerweile was damit gemeint ist").
describe("formatLiquidityLevelLabel", () => {
  const formatPrice = (p) => p.toFixed(5);

  it("minor: kein Tier-Präfix, aber weiterhin Alter", () => {
    const lvl = { price: 1.2, dir: 1, touched: false, pivotTime: NOW - 3 * 3600 };
    expect(formatLiquidityLevelLabel(lvl, { nowSec: NOW })).toBe("(3h)");
  });

  it("medium, ohne bonus/Debug: 'Medium (2d)'", () => {
    const pivotTime = Date.UTC(2026, 6, 24, 12, 0, 0) / 1000; // Fr 24.07. -> 2 Geschäftstage bis NOW
    const lvl = { price: 1.2, dir: -1, touched: false, pivotTime };
    expect(formatLiquidityLevelLabel(lvl, { nowSec: NOW })).toBe("Medium (2d)");
  });

  it("touched/dir beeinflussen den Text nicht mehr (nur noch Farbe/Position am Chart)", () => {
    const lvl = { price: 1.2, dir: 1, touched: true, pivotTime: NOW - 3 * 3600 };
    expect(formatLiquidityLevelLabel(lvl, { nowSec: NOW })).toBe("(3h)");
  });

  it("major + bonus: 'Asia-High' vorangestellt", () => {
    const pivotTime = Date.UTC(2026, 5, 22, 12, 0, 0) / 1000; // 26 Geschäftstage alt
    const lvl = { price: 1.2, dir: 1, touched: false, pivotTime };
    expect(formatLiquidityLevelLabel(lvl, { bonus: "Asia-High", nowSec: NOW })).toBe("Asia-High Major (26d)");
  });

  it("Debug-Modus hängt den formatierten Preis ans Ende an", () => {
    const lvl = { price: 1.2, dir: 1, touched: false, pivotTime: NOW - 3 * 3600 };
    expect(formatLiquidityLevelLabel(lvl, { nowSec: NOW, formatPrice, includePrice: true })).toBe("(3h) 1.20000");
  });

  it("ohne pivotTime/nowSec/bonus/Debug: leerer String, kein Crash", () => {
    expect(formatLiquidityLevelLabel({ price: 1.2, dir: -1, touched: false })).toBe("");
  });
});
