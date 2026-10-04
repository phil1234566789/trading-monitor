// Feature-Wunsch Philip 2026-07-26: News-Events als TSC-No-Go, per ForexFactory-Screenshot manuell
// eingetragen (siehe newsEvents.js, supabase/migrations/20260726120000_news_events.sql) statt einer
// externen News-API. currentNewsNoGo ist die testbare Kernlogik — reine Funktion, bekommt die schon
// aus der DB geladene Liste rein (siehe PriceChart.vue).
import { describe, expect, it } from "vitest";
import { currentNewsNoGo, newsEventsForInstrument, NEWS_NOGO_WINDOW_MINUTES } from "../src/newsEvents.js";
import { newsEventsInWindow, supportsNewsInstrument } from "../src/newsEventRules.js";

const NOW = Date.UTC(2026, 6, 23, 12, 15, 0) / 1000; // Do 23.07.2026 12:15 UTC (ECB-Zinsentscheid, siehe Seed-Migration)

describe("XAUUSD news", () => {
  const usd = { eventTime: NOW, currency: "USD", title: "CPI" };
  const events = [
    { ...usd, currency: "EUR" }, { ...usd, currency: "GBP" },
    { ...usd, currency: "XAU" }, usd,
  ];

  it("supports gold and selects only the shared USD calendar", () => {
    expect(supportsNewsInstrument("XAUUSD")).toBe(true);
    expect(supportsNewsInstrument("UNKNOWN")).toBe(false);
    expect(newsEventsForInstrument(events, "XAUUSD")).toEqual([usd]);
    expect(newsEventsForInstrument([], "XAUUSD")).toEqual([]);
  });

  it.each([-1801, -1800, 0, 1799, 1800, 1801])("keeps inclusive TSC boundaries at %s seconds", offset => {
    expect(currentNewsNoGo(events, "XAUUSD", NOW + offset))
      .toEqual(Math.abs(offset) <= NEWS_NOGO_WINDOW_MINUTES * 60 ? usd : null);
  });

  it.each([[-1801, false], [-1800, true], [0, true], [899, true], [900, false]])
    ("keeps checklist window boundaries at %s seconds", (offset, blocked) => {
      expect(newsEventsInWindow(events, "XAUUSD", NOW + offset, { beforeMinutes: 30, afterMinutes: 15 }))
        .toEqual(blocked ? [usd] : []);
    });

  it("ignores non-USD news for the gold no-go", () => {
    expect(currentNewsNoGo(events.slice(0, 3), "XAUUSD", NOW)).toBeNull();
  });
});

describe("currentNewsNoGo", () => {
  it("findet ein High-Impact-Event exakt zum Event-Zeitpunkt", () => {
    const events = [{ eventTime: NOW, currency: "EUR", title: "Main Refinancing Rate" }];
    expect(currentNewsNoGo(events, "EURUSD", NOW)).toEqual({ title: "Main Refinancing Rate", currency: "EUR", eventTime: NOW });
  });

  it("findet ein Event innerhalb des No-Go-Fensters vor UND nach dem Termin", () => {
    const events = [{ eventTime: NOW, currency: "EUR", title: "Main Refinancing Rate" }];
    const windowSec = NEWS_NOGO_WINDOW_MINUTES * 60;
    expect(currentNewsNoGo(events, "EURUSD", NOW - windowSec)).not.toBeNull();
    expect(currentNewsNoGo(events, "EURUSD", NOW + windowSec)).not.toBeNull();
  });

  it("gibt null zurück außerhalb des No-Go-Fensters", () => {
    const events = [{ eventTime: NOW, currency: "EUR", title: "Main Refinancing Rate" }];
    const justOutside = NOW + NEWS_NOGO_WINDOW_MINUTES * 60 + 1;
    expect(currentNewsNoGo(events, "EURUSD", justOutside)).toBeNull();
  });

  it("berücksichtigt nur Währungen, die das Instrument tatsächlich betreffen", () => {
    const events = [{ eventTime: NOW, currency: "GBP", title: "BOE Rate Decision" }];
    expect(currentNewsNoGo(events, "EURUSD", NOW)).toBeNull(); // EUR/USD betroffen, nicht GBP
    expect(currentNewsNoGo(events, "GBPUSD", NOW)).not.toBeNull();
  });

  it("EUR-Event betrifft EURUSD, nicht aber ein reines GBP/USD-Paar ohne EUR-Bezug", () => {
    const events = [{ eventTime: NOW, currency: "EUR", title: "ECB Press Conference" }];
    expect(currentNewsNoGo(events, "GBPUSD", NOW)).toBeNull();
  });

  it("gibt null für ein unbekanntes Instrument zurück", () => {
    const events = [{ eventTime: NOW, currency: "USD", title: "Fed Rate Decision" }];
    expect(currentNewsNoGo(events, "UNKNOWN", NOW)).toBeNull();
  });

  it("gibt null bei leerer Event-Liste zurück", () => {
    expect(currentNewsNoGo([], "EURUSD", NOW)).toBeNull();
  });
});

// newsEventsForInstrument ist die gemeinsame Basis für currentNewsNoGo UND die Chart-Marker (siehe
// newsMarkers.js) — hier direkt getestet, damit beide Konsumenten sich auf dieselbe Zuordnung
// verlassen können.
describe("newsEventsForInstrument", () => {
  const events = [
    { eventTime: NOW, currency: "EUR", title: "Main Refinancing Rate" },
    { eventTime: NOW + 1800, currency: "GBP", title: "BOE Rate Decision" },
    { eventTime: NOW + 3600, currency: "USD", title: "Fed Rate Decision" },
  ];

  it("filtert auf die Währungen, die das Instrument betreffen (EUR+USD für EURUSD)", () => {
    expect(newsEventsForInstrument(events, "EURUSD")).toEqual([events[0], events[2]]);
  });

  it("filtert auf die Währungen, die das Instrument betreffen (GBP+USD für GBPUSD)", () => {
    expect(newsEventsForInstrument(events, "GBPUSD")).toEqual([events[1], events[2]]);
  });

  it("gibt ein leeres Array für ein unbekanntes Instrument zurück", () => {
    expect(newsEventsForInstrument(events, "UNKNOWN")).toEqual([]);
  });
});
