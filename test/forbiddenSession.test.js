// poi-watcher alarmierte Trade-Setups, deren bestätigender M5-OB in einer 'forbidden'-Session
// entstanden war — der Chart versteckt genau die (notForbidden in usePriceChartTradeSetups.js).
// Die beiden Fälle unten sind die belegten Alarme vom 22.09.2026 (#1767/#1768), die den Task
// ausgelöst haben; der Test hält Backend-Gate und Chart-Filter auf derselben Antwort.
import { describe, expect, it } from "vitest";
import { forbiddenSessionAt } from "../supabase/functions/_shared/forbiddenSession.ts";
import { isForbiddenAt } from "../src/sessions.js";

// Echte Zeilen aus der sessions-Tabelle (GBPUSD/EURUSD, Stand 22.09.2026).
const GBPUSD = [
  { label: "Asia", fromMinutes: 0, toMinutes: 420, danger: "forbidden", days: [1, 2, 3, 4, 5] },
  { label: "Spread Hour", fromMinutes: 1380, toMinutes: 0, danger: "forbidden", days: [1, 2, 3, 4, 5] },
  { label: "MMM", fromMinutes: 630, toMinutes: 780, danger: "caution", days: [1, 2, 3, 4, 5] },
];
const EURUSD = [{ label: "Weekend Gap", fromMinutes: 1380, toMinutes: 4260, danger: "forbidden", days: [5] }];

const sec = (iso) => Math.floor(Date.parse(iso) / 1000);
const berlinOffsetFromSec = (utcSec) =>
  Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" })
      .formatToParts(new Date(utcSec * 1000))
      .find((p) => p.type === "timeZoneName")
      .value.match(/GMT([+-]\d+)/)[1],
  ) * 60;

describe("forbiddenSessionAt", () => {
  it("#1767/#1768: OB-Start 03:10/04:20 Berlin liegt in der Asia-Session", () => {
    expect(forbiddenSessionAt(GBPUSD, sec("2026-09-22T01:10:00Z"))).toBe("Asia");
    expect(forbiddenSessionAt(GBPUSD, sec("2026-09-22T02:20:00Z"))).toBe("Asia");
  });

  it("NY-Session und 'caution' (MMM) sind kein Verbot", () => {
    expect(forbiddenSessionAt(GBPUSD, sec("2026-09-22T13:00:00Z"))).toBeNull(); // 15:00 Berlin
    expect(forbiddenSessionAt(GBPUSD, sec("2026-09-22T09:30:00Z"))).toBeNull(); // 11:30 Berlin, MMM
  });

  it("über Mitternacht (Spread Hour) und über mehrere Tage (Weekend Gap)", () => {
    expect(forbiddenSessionAt(GBPUSD, sec("2026-09-22T21:30:00Z"))).toBe("Spread Hour"); // 23:30 Berlin
    // Fr 23:00 bis So 23:00 Berlin — der Sonntag gehört dazu, obwohl die Session am Freitag startet.
    expect(forbiddenSessionAt(EURUSD, sec("2026-09-20T10:00:00Z"))).toBe("Weekend Gap");
  });

  it("gibt dieselbe Antwort wie der Chart-Filter (src/sessions.js)", () => {
    for (const iso of ["2026-09-22T01:10:00Z", "2026-09-22T02:20:00Z", "2026-09-22T09:30:00Z", "2026-09-22T13:00:00Z", "2026-09-22T21:30:00Z"]) {
      expect(forbiddenSessionAt(GBPUSD, sec(iso)) !== null).toBe(isForbiddenAt(GBPUSD, sec(iso), berlinOffsetFromSec));
    }
  });
});
