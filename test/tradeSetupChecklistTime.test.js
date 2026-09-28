import { describe, expect, it } from "vitest";
import { evaluateChecklistTime } from "../src/tradeSetupChecklistTime.js";

const at = (iso) => Date.parse(iso) / 1000;
const london = { instrument: "GBPUSD", label: "London", fromMinutes: 540, toMinutes: 1080, danger: "normal", days: [1, 2, 3, 4, 5] };
const input = (overrides = {}) => ({
  evaluatedAt: at("2026-09-09T09:20:00+02:00"), instrument: "GBPUSD",
  sessions: [london], tradingWindows: { weekday: [[540, 1080]], saturday: [], sunday: [] },
  news: [], newsCoverage: "confirmed", ...overrides,
});

describe("evaluateChecklistTime", () => {
  it.each([["08:59:59", true], ["09:00:00", false], ["17:59:59", false], ["18:00:00", true]])(
    "meldet nur außerhalb der Handelsfenster eine Sperre (%s)", (clock, outside) => {
      const result = evaluateChecklistTime(input({ evaluatedAt: at(`2026-09-09T${clock}+02:00`) }));
      expect(result.outsideTradingHours).toBe(outside);
      expect(result.details.join(' ')).not.toContain('innerhalb der Handelszeiten');
      expect(result.details.some(d => d.includes('außerhalb der Handelszeiten'))).toBe(outside);
    });
  it('akzeptiert das gespeicherte mehrtägige Weekend-Gap bis Sonntagabend', () => {
    const args = input({ evaluatedAt: at('2026-09-27T22:00:00+02:00'),
      sessions: [{ ...london, label: 'Weekend Gap', fromMinutes: 1380, toMinutes: 4260, days: [5] }],
      tradingWindows: { sunday: [[0, 1440]] } });
    const result = evaluateChecklistTime(args);
    expect(result.status).toBe('passed');
    expect(result.details.join(' ')).toContain('Weekend Gap — OK');
    expect(evaluateChecklistTime({ ...args, evaluatedAt: at('2026-09-27T23:00:00+02:00') }).details.join(' ')).not.toContain('Weekend Gap — OK');
  });
  it("zeigt London und bestätigt nur explizit abgedeckte News", () => {
    const result = evaluateChecklistTime(input());
    expect(result.status).toBe("passed");
    expect(result.details.join(" ")).toContain("09:20 — London — OK");
    expect(result.details).toContain("Keine News, fertig!");
  });

  it.each([undefined, "unknown", "missing", "error"])("bestätigt keine leeren News bei Abdeckung %s", (newsCoverage) => {
    const result = evaluateChecklistTime(input({ newsCoverage }));
    expect(result.status).toBe("unknown");
    expect(result.details).not.toContain("Keine News, fertig!");
  });

  it.each([[-1801, "passed"], [-1800, "blocked"], [0, "blocked"], [899, "blocked"], [900, "passed"]])(
    "prüft News-Grenze bei Abstand %s Sekunden", (offset, status) => {
      const eventTime = at("2026-09-09T14:30:00+02:00");
      const result = evaluateChecklistTime(input({ evaluatedAt: eventTime + offset,
        news: [{ eventTime, currency: "USD", title: "CPI" }] }));
      expect(result.status).toBe(status);
      if (status === "blocked") expect(result.details.join(" ")).toContain("2026-09-09 14:45");
    },
  );

  it("filtert News nach Instrument und meldet alle überlappenden Sperren", () => {
    const eventTime = input().evaluatedAt;
    const news = ["EUR", "GBP", "USD"].map(currency => ({ currency, eventTime, title: currency }));
    const result = evaluateChecklistTime(input({ news }));
    expect(result.status).toBe("blocked");
    expect(result.details.filter(d => d.startsWith("News:")).length).toBe(2);
    expect(evaluateChecklistTime(input({ news: [news[0]] })).status).toBe("passed");
  });

  it("behält eine bekannte Sperre auch bei unvollständiger Kalenderabdeckung", () => {
    expect(evaluateChecklistTime(input({ newsCoverage: "unknown",
      news: [{ eventTime: input().evaluatedAt, currency: "GBP", title: "BoE" }] })).status).toBe("blocked");
  });

  it("behält bekannte News-Sperren neben fehlerhaften Kalenderzeilen", () => {
    const result = evaluateChecklistTime(input({ news: [null,
      { eventTime: input().evaluatedAt, currency: "GBP", title: "BoE" }] }));
    expect(result.status).toBe("blocked");
    expect(result.details.join(" ")).toContain("ungeprüft");
  });

  it.each([["17:59:59", "passed"], ["18:00:00", "blocked"]])("beachtet das konfigurierte Handelsende %s", (clock, status) => {
    expect(evaluateChecklistTime(input({ evaluatedAt: at(`2026-09-09T${clock}+02:00`) })).status).toBe(status);
  });

  it("nimmt geänderte Handelsfenster unmittelbar an", () => {
    expect(evaluateChecklistTime(input({ tradingWindows: { weekday: [[600, 1080]], saturday: [], sunday: [] } })).status).toBe("blocked");
  });

  it.each(["2026-01-07T09:20:00+01:00", "2026-09-09T09:20:00+02:00"])("nutzt Berlin unabhängig von Gerätezeit für %s", (iso) => {
    expect(evaluateChecklistTime(input({ evaluatedAt: at(iso) })).details.join(" ")).toContain("09:20 — London — OK");
  });

  it.each(["2026-03-29T09:20:00+02:00", "2026-10-25T09:20:00+01:00"])("beachtet Session-Uhrzeiten auch am DST-Wechseltag %s", (iso) => {
    const result = evaluateChecklistTime(input({ evaluatedAt: at(iso), sessions: [{ ...london, days: [0] }],
      tradingWindows: { weekday: [], saturday: [], sunday: [[540, 600]] } }));
    expect(result.status).toBe("passed");
    expect(result.details.join(" ")).toContain("London");
  });

  it("trennt Vorsicht von Verbot und erhält normale Sessionnamen", () => {
    const caution = { ...london, label: "MMM", danger: "caution" };
    const result = evaluateChecklistTime(input({ sessions: [london, caution] }));
    expect(result.status).toBe("unknown");
    expect(result.details.join(" ")).toMatch(/London.*MMM.*Vorsicht/);
    expect(evaluateChecklistTime(input({ sessions: [caution, { ...london, danger: "forbidden" }] })).status).toBe("blocked");
    expect(evaluateChecklistTime(input({ sessions: [{ ...caution, instrument: "EURUSD" }, london] })).status).toBe("passed");
  });

  it("wendet Wochentage auf den Sessionbeginn über Mitternacht an", () => {
    const overnight = { ...london, fromMinutes: 1380, toMinutes: 60, days: [5], danger: "forbidden" };
    const windows = { weekday: [], saturday: [[0, 1440]], sunday: [[0, 1440]] };
    expect(evaluateChecklistTime(input({ evaluatedAt: at("2026-09-12T00:30:00+02:00"), sessions: [overnight], tradingWindows: windows })).status).toBe("blocked");
    expect(evaluateChecklistTime(input({ evaluatedAt: at("2026-09-13T00:30:00+02:00"), sessions: [overnight], tradingWindows: windows })).status).toBe("passed");
  });

  it("wertet eine Session am Beginn aktiv und am Ende inaktiv", () => {
    const session = { ...london, fromMinutes: 560, toMinutes: 561, danger: "forbidden" };
    expect(evaluateChecklistTime(input({ sessions: [session] })).status).toBe("blocked");
    expect(evaluateChecklistTime(input({ sessions: [session], evaluatedAt: at("2026-09-09T09:21:00+02:00") })).status).toBe("passed");
  });

  it.each([{ evaluatedAt: undefined }, { instrument: "XAUUSD" }, { sessions: undefined }, { sessions: [{ ...london, instrument: undefined }] },
    { tradingWindows: undefined }, { news: undefined },
    { news: [{ currency: "GBP", eventTime: NaN }] }])("gibt für fehlende oder ungültige Eingaben kein GO (%j)", (overrides) => {
    expect(evaluateChecklistTime(input(overrides)).status).toBe("unknown");
  });

  it("liefert bei Replay vorwärts und rückwärts dasselbe Ergebnis ohne gespeicherten Zustand", () => {
    const start = input();
    const before = evaluateChecklistTime(start);
    evaluateChecklistTime(input({ evaluatedAt: at("2026-09-09T18:00:00+02:00") }));
    expect(evaluateChecklistTime(start)).toEqual(before);
  });
});
