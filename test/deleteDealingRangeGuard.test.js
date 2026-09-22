// Am 22.09.2026 verschwand Dealing Range #95 samt der Positionen #104/#105 aus dem Journal:
// onTscTransferToTrades legte die Position an, ohne tscRangeId zu leeren, der TSC-Reset zeigte
// danach weiter auf dieselbe Range, und trade_positions haengt per `on delete cascade` an
// dealing_ranges. Der Riegel unten ist der eigentliche Fix — dieser Test haelt ihn fest.
import { describe, expect, it, vi, beforeEach } from "vitest";

// Minimaler Supabase-Doppelgaenger: nur die zwei Ketten, die deleteDealingRange baut.
let positionenAntwort;
const geloescht = [];
vi.mock("../src/supabaseClient.js", () => ({
  supabase: {
    from(tabelle) {
      if (tabelle === "trade_positions") {
        const kette = {
          select: () => kette,
          eq: () => kette,
          limit: () => Promise.resolve(positionenAntwort),
        };
        return kette;
      }
      return {
        delete: () => ({
          eq: (_spalte, wert) => {
            geloescht.push(wert);
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  },
}));

const { deleteDealingRange } = await import("../src/tradeIntake.js");

describe("deleteDealingRange", () => {
  beforeEach(() => {
    geloescht.length = 0;
    globalThis.alert = () => {};
  });

  it("loescht eine Range ohne Ausfuehrungen", async () => {
    positionenAntwort = { data: [], error: null };
    await expect(deleteDealingRange(95)).resolves.toBe(true);
    expect(geloescht).toEqual([95]);
  });

  it("loescht NICHT, sobald eine trade_positions-Zeile dranhaengt", async () => {
    positionenAntwort = { data: [{ id: 104 }], error: null };
    await expect(deleteDealingRange(95)).resolves.toBe(false);
    expect(geloescht).toEqual([]);
  });

  it("loescht nicht, wenn die Pruefung selbst fehlschlaegt", async () => {
    positionenAntwort = { data: null, error: { message: "boom" } };
    await expect(deleteDealingRange(95)).resolves.toBe(false);
    expect(geloescht).toEqual([]);
  });
});
