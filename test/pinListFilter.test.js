import { describe, it, expect } from "vitest";
import "../src/liquidity2.js";
import { filterPins, pinTime, pinTypeKey, pinTypeName, pinInstrument } from "../src/pinListFilter.js";

const lq2 = { id: 1, kind: "chart_object", createdAt: "2026-11-22T09:00:00Z",
  chartObject: { type: "liquidity2_ls", instrument: "GBPUSD", timeframe: "5m", snapshot: { pivotTime: 1795000000, price: 1.3, dir: 1 } } };
const ob = { id: 2, kind: "ob_zone", createdAt: "2026-11-01T09:00:00Z", obZone: { instrument: "XAUUSD", startTime: "2026-10-20T08:00:00Z" } };
const dobTrade = { id: 3, kind: "dob_trade", createdAt: "2026-11-20T09:00:00Z", dobTradeContext: { instrument: "EURUSD", entry_time: "1770715380" } };
const sim = { id: 4, kind: "simulation_entry", createdAt: "2026-10-04T09:00:00Z",
  simulationContext: { instrument: "GBPUSD", recognizedAt: { unix: 1788770700 }, entry: { time: { unix: 1788778200 } } } };
const trade = { id: 5, kind: "trade_position", tradePositionId: 77, createdAt: "2026-08-01T10:00:00Z" };
const all = [lq2, ob, dobTrade, sim, trade];

describe("Pin-Liste filtern", () => {
  it("nimmt den Objektzeitpunkt je Art und fällt nur ohne ihn auf created_at zurück (gekennzeichnet)", () => {
    expect(pinTime(lq2)).toEqual({ time: 1795000000, fromCreatedAt: false });
    expect(pinTime(ob).time).toBe(Date.parse("2026-10-20T08:00:00Z") / 1000);
    expect(pinTime(dobTrade).time).toBe(1770715380);
    expect(pinTime(sim).time).toBe(1788778200);
    expect(pinTime(trade)).toEqual({ time: Date.parse("2026-08-01T10:00:00Z") / 1000, fromCreatedAt: true });
    expect(pinTime(trade, [{ id: 77, instrument: "EURUSD", entryTime: 1786000000 }])).toEqual({ time: 1786000000, fromCreatedAt: false });
  });

  it("filtert nach Asset, Typ und Zeitraum; leere Auswahl heißt alle", () => {
    expect(filterPins(all, {}).length).toBe(5);
    expect(filterPins(all, { instruments: ["GBPUSD"] }).map((e) => e.id)).toEqual([1, 4]);
    expect(filterPins(all, { types: ["chart_object:liquidity2_ls", "ob_zone"] }).map((e) => e.id)).toEqual([1, 2]);
    expect(filterPins(all, { from: 1788000000, to: 1790000000 }).map((e) => e.id)).toEqual([4]);
    expect(pinInstrument(trade, [{ id: 77, instrument: "EURUSD" }])).toBe("EURUSD");
  });

  it("baut Typnamen generisch: Registry-Name für chart_object, sonst Art-Name", () => {
    expect(pinTypeKey(lq2)).toBe("chart_object:liquidity2_ls");
    expect(pinTypeName("chart_object:liquidity2_ls")).toBe("Liquidität 2.0 (LS2)");
    expect(pinTypeName("chart_object:unbekannt")).toBe("unbekannt");
    expect(pinTypeName("ob_zone")).toBe("OB-Zone");
  });
});
