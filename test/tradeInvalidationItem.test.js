// Die Invalidierung einer Dealing Range trägt seit 22.09.2026 das angeklickte Chart-Objekt, nicht
// nur den Preis (Philip: "ich hätte lieber, so wie bei den anderen Feldern ... dass das Chart-Objekt
// übernommen wird"). toInvalidationItem bringt die zwei FK-Embeds der dealing_ranges-Zeile in exakt
// die Item-Form einer Bestätigung — daran hängt, dass Chart-Zeichnung, Highlight und TSC-Label sie
// ohne Sonderfall verarbeiten.
import { describe, expect, it } from "vitest";
import { toInvalidationItem } from "../src/trades.js";

const LEVEL_ROW = {
  price: 1.1471,
  direction: "high",
  timeframe: "1H",
  pivot_time: "2026-09-22T06:00:00+00:00",
  touched: true,
  end_time: "2026-09-22T10:00:00+00:00",
};
const ZONE_ROW = {
  timeframe: "1H",
  direction: "short",
  top: 1.1471,
  bottom: 1.147,
  start_time: "2026-09-22T06:00:00+00:00",
};

describe("toInvalidationItem", () => {
  it("liefert null, solange nur eine Zahl ohne Chart-Objekt gesetzt ist", () => {
    expect(toInvalidationItem({ id: 94, invalidation: 1.1471 })).toBeNull();
  });

  it("mappt ein verknüpftes LQ-Level auf ein kind='pivot'-Item mit aufgelöstem liquidityLevel", () => {
    const item = toInvalidationItem({ id: 94, invalidation: 1.1471, invalidation_liquidity_level: LEVEL_ROW });
    expect(item.kind).toBe("pivot");
    expect(item.category).toBe("invalidation");
    expect(item.dealingRangeId).toBe(94);
    expect(item.price).toBe(1.1471);
    expect(item.sourceTime).toBe(Math.floor(Date.parse(LEVEL_ROW.pivot_time) / 1000));
    // dir 1/-1 statt "high"/"low" — genau die Form, die der Chart-Highlight-Key erwartet.
    expect(item.liquidityLevel).toMatchObject({ dir: 1, price: 1.1471, timeframe: "1H", touched: true });
  });

  it("mappt eine verknüpfte OB-Zone auf ein kind='ob'-Item mit beiden Kanten", () => {
    const item = toInvalidationItem({ id: 94, invalidation: 1.1471, invalidation_ob_zone: ZONE_ROW });
    expect(item.kind).toBe("ob");
    expect(item.category).toBe("invalidation");
    expect(item.rangeLow).toBe(1.147);
    expect(item.rangeHigh).toBe(1.1471);
    expect(item.sourceTime).toBe(Math.floor(Date.parse(ZONE_ROW.start_time) / 1000));
    // Kein LQ-Level: die OB-Box zeichnet sich selbst, statt ein natives Level zu highlighten.
    expect(item.liquidityLevel).toBeNull();
  });

  it("bevorzugt das LQ-Level, falls wider den CHECK-Constraint beide Spalten gesetzt sind", () => {
    const item = toInvalidationItem({
      id: 94,
      invalidation: 1.1471,
      invalidation_liquidity_level: LEVEL_ROW,
      invalidation_ob_zone: ZONE_ROW,
    });
    expect(item.kind).toBe("pivot");
  });
});
