import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { applySelectionHalo } from "../src/chartSelectionHalo.js";

const fake = (id, isSelectedPin = false) => ({ id, _options: { isSelectedPin }, _requestUpdate: vi.fn() });

describe("applySelectionHalo", () => {
  it("kippt nur geänderte Halos und zeichnet nur diese neu", () => {
    const a = fake(1, true);
    const b = fake(2);
    const c = fake(3);
    applySelectionHalo([a, b, c], (p) => p.id === 2);
    expect([a, b, c].map((p) => p._options.isSelectedPin)).toEqual([false, true, false]);
    expect(a._requestUpdate).toHaveBeenCalledTimes(1);
    expect(b._requestUpdate).toHaveBeenCalledTimes(1);
    expect(c._requestUpdate).not.toHaveBeenCalled();
  });

  it("verträgt ein noch nicht attachtes Primitive", () => {
    const p = { _options: { isSelectedPin: false } };
    expect(() => applySelectionHalo([p], () => true)).not.toThrow();
    expect(p._options.isSelectedPin).toBe(true);
  });
});

// Regression Hover-Lag: der Hover einer Journal-Zeile baute alle Bestätigungs-/Target-Primitives
// neu (~160 ms pro mouseenter/mouseleave). Die Hover-Props dürfen nur den Halo-Pfad auslösen.
describe("PriceChart Hover-Watches", () => {
  const src = readFileSync(new URL("../src/components/PriceChart.vue", import.meta.url), "utf8");
  it.each(["hoveredPinTradeConfirmationId", "hoveredTradeTargetId", "hoveredInvalidationRangeId"])("%s baut nichts neu", (prop) => {
    const watchLines = src.split("\n").filter((l) => l.startsWith("watch(") && l.includes(`props.${prop}`));
    expect(watchLines.length).toBeGreaterThan(0);
    for (const line of watchLines) expect(line).not.toMatch(/refreshTrade(Confirmation|Target)LinksInternal/);
  });
});
