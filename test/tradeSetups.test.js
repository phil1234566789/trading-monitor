// Task "Chart zeichnet die persistierten Trade-Setups, nicht nur die live erkannten": der Chart
// mischt die trade_setups-Zeilen unter die Live-Erkennung, damit ein Alarm im Chart nicht fehlen
// kann. Getestet wird die beiden nicht offensichtlichen Teile davon — wer bei einer Dublette
// gewinnt, und die Objektidentität fractal===ls bei einem Setup ohne eigenes Fraktal.
import { describe, expect, it } from "vitest";
import { mergeDbTradeSetups, tradeSetupFromRow } from "../src/tradeSetups.js";

const iso = (sec) => new Date(sec * 1000).toISOString();

function row(overrides = {}) {
  return {
    id: 1,
    instrument: "GBPUSD",
    direction: "short",
    fractal_price: 1.35857,
    fractal_pivot_time: iso(1000),
    ls_price: 1.3584,
    ls_pivot_time: iso(500),
    ls_touched_time: iso(900),
    ob_top: 1.35976,
    ob_bottom: 1.35713,
    ob_start_time: iso(1200),
    ...overrides,
  };
}

describe("tradeSetupFromRow", () => {
  it("baut die Live-Setup-Form aus einer DB-Zeile", () => {
    const setup = tradeSetupFromRow(row());
    expect(setup).toMatchObject({
      instrument: "GBPUSD",
      dir: 1,
      label: "Short",
      setupNumber: null,
      obTop: 1.35976,
      obBottom: 1.35713,
      obStartTime: 1200,
      tradeSetupId: 1,
      fromDb: true,
    });
    expect(setup.ls).toMatchObject({ price: 1.3584, pivotTime: 500, touched: true, touchedTime: 900, endTime: 900 });
    expect(setup.fractal).toMatchObject({ price: 1.35857, pivotTime: 1000, touched: false });
  });

  it("setzt fractal auf DIESELBE Referenz wie ls, wenn es kein eigenes Fraktal gab (Path B)", () => {
    const setup = tradeSetupFromRow(row({ fractal_price: 1.3584, fractal_pivot_time: iso(500) }));
    // Die Zeichnung entscheidet an `fractal !== ls`, ob sie ein zweites Preislabel an dieselbe
    // Stelle schreibt — Preisgleichheit allein reicht dafür nicht.
    expect(setup.fractal).toBe(setup.ls);
  });

  it("erkennt Long an direction", () => {
    expect(tradeSetupFromRow(row({ direction: "long" }))).toMatchObject({ dir: -1, label: "Long" });
  });
});

describe("mergeDbTradeSetups", () => {
  const live = { dir: 1, obStartTime: 1200, obTop: 1.4, fromLive: true };
  const db = { dir: 1, obStartTime: 1200, obTop: 1.3, fromDb: true };

  it("bevorzugt bei gleichem (dir, obStartTime) die live erkannte Fassung", () => {
    expect(mergeDbTradeSetups([live], [db])).toEqual([live]);
  });

  it("behält ein nur in der DB vorhandenes Setup — genau der Divergenzfall", () => {
    const nurDb = { dir: 1, obStartTime: 2400, fromDb: true };
    expect(mergeDbTradeSetups([live], [db, nurDb])).toEqual([live, nurDb]);
  });

  it("hält die gleiche obStartTime in beiden Richtungen auseinander", () => {
    const dbLong = { dir: -1, obStartTime: 1200, fromDb: true };
    expect(mergeDbTradeSetups([live], [dbLong])).toHaveLength(2);
  });

  it("gibt chronologisch zurück, damit der Aufrufer hinten abschneiden kann", () => {
    const aelter = { dir: 1, obStartTime: 600, fromDb: true };
    expect(mergeDbTradeSetups([live], [aelter]).map((s) => s.obStartTime)).toEqual([600, 1200]);
  });
});
