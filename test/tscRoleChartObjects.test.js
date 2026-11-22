// Wächter: ein neuer Registry-Typ ist ohne Code-Zweig pinnbar und in allen 5 TSC-Rollen auswählbar
// (Bestätigung, Zusatzargument, Anti-Confluence, Target, Invalidierung) — Klick, Speichern, Lesen, Label.
import { describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({ writes: [] }));
vi.mock("../src/supabaseClient.js", () => ({ supabase: { from: (table) => ({
  insert: async (row) => { db.writes.push({ table, op: "insert", row }); return { error: null }; },
  update: (row) => ({ eq: async () => { db.writes.push({ table, op: "update", row }); return { error: null }; } }),
  // trades.js lädt beim Import Trading-Konten; leer reicht.
  select: () => ({ order: async () => ({ data: [], error: null }), then: (r) => r({ data: [], error: null }) }),
}) } }));
import { registerChartObjectType, chartObjectRoleTarget, hasChartObjectPinCandidate, chartObjectItem } from "../src/chartObjectRegistry.js";
import { findNearbyPinCandidates } from "../src/priceChartHitTest.js";
import { addRangeConfirmation, addConfirmationToTrade, addTargetToTrade, setDealingRangeInvalidation } from "../src/tradeIntake.js";
import { chartObjectFromRow } from "../supabase/functions/_shared/chartObjectColumns.js";
import { toInvalidationItem } from "../src/trades.js";
import { formatEvidenceLabel } from "../src/tradeEvidence.ts";
import { formatTargetLabel } from "../src/tradeTargets.ts";
import "../src/doubleOrderBlockPin.js";

registerChartObjectType("guard_band", {
  name: "Wächter-Band", algoVersion: "guard-v1", key: (b) => String(b.from), snapshot: (b) => ({ from: b.from, level: b.level }),
  time: (s) => s.from, line: (s) => ({ price: s.level, dir: 1, from: s.from, to: null, styleKey: "pin" }), label: (s) => `Band ${s.level}`,
});
const ctx = { symbol: "GBPUSD", currentBar: "5m" };
const sources = [{ type: "guard_band", primitives: [{ obj: { from: 1795000000, level: 1.25 }, distanceTo: () => 2 }], objectOf: (p) => p.obj }];
const emptyBag = { tradePrimitives: [], orderBlockPrimitives: [], liquidityPrimitives: [], tradeSetupLinkPrimitives: [],
  tradeConfirmationLinkPrimitives: [], divergencePrimitives: [], tscSetupPrimitives: [] };
const expectedObject = { chart_object_type: "guard_band", chart_object_key: "GBPUSD|5m|1795000000", chart_object_instrument: "GBPUSD",
  chart_object_timeframe: "5m", chart_object_snapshot: { from: 1795000000, level: 1.25, algoVersion: "guard-v1" } };

describe("TSC-Rollen nehmen jedes Registry-Objekt", () => {
  it("Klick liefert ein Rollen-Item mit Preis und Zeit aus der Typ-Definition, Pin-Menü sieht es auch", () => {
    expect(findNearbyPinCandidates(0, 0, { ...emptyBag, chartObjectSources: sources }, ctx)[0]).toMatchObject({ kind: "chart_object", type: "guard_band" });
    expect(hasChartObjectPinCandidate(0, 0, sources, 6)).toBe(true);
    expect(chartObjectRoleTarget(0, 0, sources, ctx, 1)).toBeNull();
    expect(chartObjectRoleTarget(0, 0, sources, ctx, 6)).toMatchObject({ kind: "chart_object", price: 1.25, sourceTime: 1795000000 });
  });

  it("speichert in allen 5 Rollen dieselben chart_object-Spalten, ohne FK-Auflösung", async () => {
    const item = chartObjectRoleTarget(0, 0, sources, ctx, 6);
    db.writes.length = 0;
    for (const category of ["confirmation", "confluence", "anti_confluence"]) expect(await addRangeConfirmation(7, item, category)).toBe(true);
    expect(await addConfirmationToTrade(8, item, "anti_confluence")).toBe(true);
    expect(await addTargetToTrade(7, item)).toBe(true);
    expect(await setDealingRangeInvalidation(7, item)).toBe(true);

    const evidence = db.writes.filter((w) => w.table === "trade_evidence");
    expect(evidence.map((w) => w.row.category)).toEqual(["confirmation", "confluence", "anti_confluence", "anti_confluence"]);
    for (const { row } of evidence) expect(row).toMatchObject({ kind: "chart_object", price: 1.25, ob_zone_id: null, liquidity_level_id: null, ...expectedObject });
    expect(db.writes.find((w) => w.table === "trade_targets").row).toMatchObject({ kind: "chart_object", price: 1.25, liquidity_level_id: null, ...expectedObject });
    const range = db.writes.find((w) => w.table === "dealing_ranges").row;
    expect(range).toMatchObject({ invalidation: 1.25, invalidation_ob_zone_id: null, invalidation_liquidity_level_id: null,
      invalidation_chart_object_type: "guard_band", invalidation_chart_object_key: "GBPUSD|5m|1795000000" });
  });

  it("eine Invalidierung ohne Objekt räumt das alte Registry-Objekt mit ab", async () => {
    db.writes.length = 0;
    await setDealingRangeInvalidation(7, { kind: "pivot", price: 1.3 });
    expect(db.writes[0].row).toMatchObject({ invalidation: 1.3, invalidation_chart_object_type: null, invalidation_chart_object_snapshot: null });
  });

  it("liest Evidenz, Target und Invalidierung zurück und beschriftet sie über die Registry", () => {
    const chartObject = chartObjectFromRow(expectedObject);
    expect(chartObject).toMatchObject({ type: "guard_band", key: "GBPUSD|5m|1795000000" });
    const evidence = { id: 3, ...chartObjectItem(chartObject), category: "anti_confluence", touchedTime: null };
    expect(formatEvidenceLabel(evidence, "GBPUSD", 1795003600)).toMatch(/^5m Band 1\.25 · .* #3$/);
    expect(formatTargetLabel({ id: 4, ...chartObjectItem(chartObject) }, "GBPUSD", 1795003600)).toMatch(/^5m Band 1\.25 · .* #4$/);
    const invalidation = toInvalidationItem({ id: 7, invalidation: 1.25, ...Object.fromEntries(Object.entries(expectedObject).map(([k, v]) => [`invalidation_${k}`, v])) });
    expect(invalidation).toMatchObject({ category: "invalidation", kind: "chart_object", price: 1.25, chartObject: { type: "guard_band" } });
  });

  it("DOB ist registriert: Preis = nahe OB2-Kante, Zeit = OB1-Start", () => {
    const pair = { id: 497, instrument: "GBPUSD", direction: "short",
      firstOrderBlock: { startTime: 100, top: 1.32, bottom: 1.31 }, secondOrderBlock: { startTime: 200, top: 1.33, bottom: 1.325 } };
    const item = chartObjectItem({ type: "double_order_block", key: "GBPUSD|5m|497", instrument: "GBPUSD", timeframe: "5m", snapshot: { pair } });
    expect(item).toMatchObject({ kind: "chart_object", price: 1.325, sourceTime: 100 });
  });
});
