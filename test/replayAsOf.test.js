// Regressionsfall GBPUSD 09.09.2026: get_data_export mit replayUntilSec=09:00 Berlin lieferte das
// 1H-Level 259848 (1.35652) als touched — der Sweep lief real erst um 09:10, das Tageshoch stand
// zum Stichzeitpunkt bei 1.35625. Ursache ist die OEFFNUNGS-Zeit der erkennenden Kerze als
// Ereigniszeitpunkt (siehe replayAsOf.ts). Gegenprobe in beide Richtungen: der Sweep darf weder zu
// frueh sichtbar sein noch nach seinem echten Eintreten verschwiegen werden — ein 4H-Sweep erst
// zum 4H-Kerzenschluss zu melden waere fuer M5-Intraday wertlos.
import { describe, expect, it } from "vitest";
import { applyAsOf, applyAsOfZones, earliestAmbiguousEventSec } from "../supabase/functions/trading-monitor-mcp/replayAsOf.ts";

const H0900 = 1788937200; // 09.09.2026 09:00 Europe/Berlin
const H0700 = H0900 - 7200; // Oeffnung der 4H-Kerze, in der derselbe Sweep liegt
const iso = (sec) => new Date(sec * 1000).toISOString();
const SWEEP = 1.35652;

// M5-Kerzen 07:00-09:40: das Hoch bleibt bis 09:05 unter 1.35652, die 09:10-Kerze bricht es.
const m5 = [];
for (let t = H0700; t <= H0900 + 2400; t += 300) {
  const breaks = t >= H0900 + 600;
  m5.push({ time: t, high: breaks ? 1.35672 : 1.35625, low: 1.3556 });
}

const level = (over) => ({
  id: 259848,
  timeframe: "1H",
  direction: "high",
  price: SWEEP,
  pivot_time: iso(1788184800),
  touched: true,
  end_time: iso(H0900),
  ...over,
});
const level4h = (over) => level({ id: 268994, timeframe: "4H", end_time: iso(H0700), ...over });

describe("applyAsOf — Sweep in noch laufender Kerze", () => {
  it("verschweigt den Sweep, solange der Preis das Niveau nicht erreicht hat", () => {
    const [row] = applyAsOf([level()], H0900, m5);
    expect(row.touched).toBe(false);
    expect(row.end_time).toBe(null);
  });

  it("meldet ihn ab der M5-Kerze, die das Niveau wirklich bricht — nicht erst zum 1H-Schluss", () => {
    const [row] = applyAsOf([level()], H0900 + 900, m5); // 09:15
    expect(row.touched).toBe(true);
    expect(row.end_time).toBe(iso(H0900 + 600)); // 09:10, nicht 09:00 und nicht 10:00
  });

  // Der Fall, auf den es fuer M5-Intraday ankommt: eine 4H-Kerze laeuft 4h, ein darauf gestuetzter
  // DR-Sweep darf nicht bis zu ihrem Schluss unsichtbar bleiben.
  it("meldet einen 4H-Sweep 5 Minuten nach dem Bruch, nicht erst zum 4H-Kerzenschluss", () => {
    expect(applyAsOf([level4h()], H0900 + 300, m5)[0].touched).toBe(false); // 09:05, noch nicht gebrochen
    const [row] = applyAsOf([level4h()], H0900 + 900, m5); // 09:15
    expect(row.touched).toBe(true);
    expect(row.end_time).toBe(iso(H0900 + 600));
  });

  it("zaehlt nur abgeschlossene M5-Kerzen, damit die laufende nicht dieselbe Zukunft leakt", () => {
    expect(applyAsOf([level()], H0900 + 600, m5)[0].touched).toBe(false); // 09:10, Kerze laeuft noch
    expect(applyAsOf([level()], H0900 + 900, m5)[0].touched).toBe(true); // 09:15, sie ist zu
  });

  it("faellt ohne M5-Abdeckung auf das alte Verhalten zurueck statt blind zu verschweigen", () => {
    expect(applyAsOf([level()], H0900, [])[0].touched).toBe(true);
  });

  it("laesst eindeutig vergangene Sweeps unangetastet und holt dafuer keine Kerzen", () => {
    const old = level({ end_time: iso(1788436800) });
    expect(applyAsOf([old], H0900, [])[0].end_time).toBe(iso(1788436800));
    expect(earliestAmbiguousEventSec([old], H0900)).toBe(null);
  });

  it("verschweigt einen Sweep, dessen Zeitstempel eindeutig nach dem Stichzeitpunkt liegt", () => {
    expect(applyAsOf([level({ end_time: iso(H0900 + 3600) })], H0900, m5)[0].touched).toBe(false);
  });

  it("filtert Pivots raus, die es zum Stichzeitpunkt noch nicht gab", () => {
    expect(applyAsOf([level({ pivot_time: iso(H0900 + 60) })], H0900, m5)).toHaveLength(0);
  });

  // Regressionsfall GBPUSD 09.09.2026 (Level 315786/317992, beide auf 1.3568 = dem Hoch der
  // 09:15-Kerze): der Pivot lag zwar auf/vor 09:00, bestaetigt ist ein Fraktal aber erst, wenn 5
  // Kerzen danach geschlossen sind — das Preisniveau selbst stammte aus noch nicht gelaufener
  // Kursbewegung.
  it("zeigt einen 1H-Pivot erst 6 Kerzen spaeter, nicht schon zur Pivot-Kerzen-Oeffnung", () => {
    const fresh = level({ id: 315786, price: 1.3568, pivot_time: iso(H0900), touched: false, end_time: null });
    expect(applyAsOf([fresh], H0900, m5)).toHaveLength(0);
    expect(applyAsOf([fresh], H0900 + 6 * 3600 - 60, m5)).toHaveLength(0); // 14:59
    expect(applyAsOf([fresh], H0900 + 6 * 3600, m5)).toHaveLength(1); // 15:00
  });

  it("rechnet die Bestaetigung je Timeframe, ein 4H-Pivot braucht 24h", () => {
    const fresh = level4h({ id: 317992, price: 1.3568, pivot_time: iso(H0700), touched: false, end_time: null });
    expect(applyAsOf([fresh], H0900, m5)).toHaveLength(0);
    expect(applyAsOf([fresh], H0700 + 24 * 3600 - 60, m5)).toHaveLength(0);
    expect(applyAsOf([fresh], H0700 + 24 * 3600, m5)).toHaveLength(1); // 10.09. 07:00
  });

  it("laesst ohne asOfSec alles unangetastet", () => {
    expect(applyAsOf([level()], undefined, m5)[0].touched).toBe(true);
  });
});

describe("applyAsOfZones", () => {
  const zone = (over) => ({
    id: 1,
    timeframe: "1H",
    top: 1.3566,
    bottom: 1.3564,
    start_time: iso(1788184800),
    touched: false,
    invalidated: false,
    end_time: null,
    retested: false,
    retested_at: null,
    ...over,
  });

  it("verschweigt Touch/Invalidation, solange der Preis die Zone nicht erreicht hat", () => {
    expect(applyAsOfZones([zone({ touched: true, end_time: iso(H0900) })], H0900, m5)[0].touched).toBe(false);
    expect(applyAsOfZones([zone({ invalidated: true, end_time: iso(H0900) })], H0900, m5)[0].invalidated).toBe(false);
  });

  it("meldet den Touch ab der M5-Kerze, die in die Zone laeuft", () => {
    const [row] = applyAsOfZones([zone({ touched: true, end_time: iso(H0900) })], H0900 + 900, m5);
    expect(row.touched).toBe(true);
    expect(row.end_time).toBe(iso(H0900 + 600));
  });

  // Retest bewusst ohne M5-Aufloesung: er ist per Definition erst zum Kerzenschluss entschieden.
  it("verschweigt einen Retest, dessen bestaetigende Kerze noch laeuft, und zeigt ihn danach", () => {
    const r = zone({ retested: true, retested_at: iso(H0900) });
    expect(applyAsOfZones([r], H0900, m5)[0].retested).toBe(false);
    expect(applyAsOfZones([r], H0900 + 3600, m5)[0].retested).toBe(true);
  });

  it("filtert Zonen raus, die zum Stichzeitpunkt noch nicht existierten", () => {
    expect(applyAsOfZones([zone({ start_time: iso(H0900 + 60) })], H0900, m5)).toHaveLength(0);
  });

  // startTime ist die MITTLERE der drei FVG-Kerzen — entdeckt wird die Zone auf der darauffolgenden,
  // bekannt ist sie erst mit deren Schluss (2 Bars).
  it("zeigt eine Zone erst, wenn ihre entdeckende Kerze geschlossen hat", () => {
    const fresh = zone({ start_time: iso(H0900 - 3600) }); // 08:00
    expect(applyAsOfZones([fresh], H0900, m5)).toHaveLength(0); // 09:00, entdeckende Kerze laeuft
    expect(applyAsOfZones([fresh], H0900 + 3600, m5)).toHaveLength(1); // 10:00
  });
});
