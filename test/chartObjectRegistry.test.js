import { describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({ upserts: [] }));
vi.mock("../src/supabaseClient.js", () => ({ supabase: { from: () => {
  let payload, conflict;
  const query = {
    upsert: (value, opts) => { payload = value; conflict = opts.onConflict; return query; },
    select: () => query,
    single: async () => { db.upserts.push({ payload, conflict }); return { data: { id: 1, ...payload }, error: null }; },
  };
  return query;
} } }));
import { registerChartObjectType, chartObjectLabel } from "../src/chartObjectRegistry.js";
import { findNearbyPinCandidates, hasNearbyPinCandidate } from "../src/priceChartHitTest.js";
import { addPinChartObject } from "../src/pinContext.js";
import "../src/liquidity2.js";

const emptyBag = { tradePrimitives: [], orderBlockPrimitives: [], liquidityPrimitives: [], tradeSetupLinkPrimitives: [],
  tradeConfirmationLinkPrimitives: [], divergencePrimitives: [], tscSetupPrimitives: [] };
const ctx = { symbol: "GBPUSD", currentBar: "5m" };
const primitive = (obj, distance) => ({ obj, distanceTo: () => distance });

describe("Chartobjekt-Registry", () => {
  it("macht einen neuen Typ ohne Migration, Spalten oder eigenen Zweig pinnbar", async () => {
    registerChartObjectType("test_band", {
      algoVersion: "band-v1", key: (b) => `${b.from}|${b.to}`, snapshot: (b) => ({ from: b.from, to: b.to, price: b.price }),
      time: (s) => s.from, label: (s) => `Band ${s.price}`,
    });
    const sources = [{ type: "test_band", primitives: [primitive({ from: 10, to: 20, price: 1.25 }, 3)], objectOf: (p) => p.obj }];
    const bag = { ...emptyBag, chartObjectSources: sources };

    expect(hasNearbyPinCandidate(0, 0, bag)).toBe(true);
    const [candidate] = findNearbyPinCandidates(0, 0, bag, ctx);
    expect(candidate).toMatchObject({ kind: "chart_object", type: "test_band", key: "GBPUSD|5m|10|20",
      instrument: "GBPUSD", timeframe: "5m", snapshot: { from: 10, to: 20, price: 1.25, algoVersion: "band-v1" } });
    expect(chartObjectLabel("test_band", candidate.snapshot, "GBPUSD")).toBe("Band 1.25");

    const entry = await addPinChartObject(candidate, "Notiz", "bug");
    expect(db.upserts.at(-1)).toMatchObject({ conflict: "chart_object_type,chart_object_key",
      payload: { kind: "chart_object", chart_object_type: "test_band", chart_object_key: "GBPUSD|5m|10|20", note: "Notiz" } });
    expect(entry.chartObject).toMatchObject({ type: "test_band", snapshot: { algoVersion: "band-v1" } });
  });

  it("liefert LQ-2.0-Linien im Radius als Kandidaten, doppelte Primitives nur einmal", () => {
    const lvl = { dir: 1, price: 1.27345, pivotTime: 1795000000, touched: false, structurePrice: 1.27, structureTime: 1794990000,
      bosTime: 1795003000, impulsePips: 34.5, impulseAtr: 2.1, brokenSwings: 3 };
    const near = { level: lvl, distanceTo: () => 4 };
    const far = { level: { ...lvl, pivotTime: 1 }, distanceTo: () => 400 };
    const sources = [{ type: "liquidity2_ls", primitives: [near, near, far], objectOf: (p) => p.level }];
    const candidates = findNearbyPinCandidates(0, 0, { ...emptyBag, chartObjectSources: sources }, ctx);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].key).toBe("GBPUSD|5m|1|1795000000");
    expect(candidates[0].snapshot).toMatchObject({ price: 1.27345, bosTime: 1795003000, algoVersion: "liquidity2-v1" });
    expect(chartObjectLabel("liquidity2_ls", candidates[0].snapshot, "GBPUSD")).toBe("LS2 Hoch 1,27345");
  });
});
