import { berlinDateTimeStrFor, berlinDateStrFor } from "./berlinTime.ts";

// Pure Logik hinter check_pretrade_gates (Schritt 1+2, siehe docs/state-machine.md) — dependency-frei
// (nur Intl.DateTimeFormat + berlinTime.ts, kein db.ts/supabaseClient.ts-Import), damit sie
// unabhängig von den DB-Fetches (trading_schedules/news_events, siehe tools/pretradeGates.ts) per
// Vitest testbar bleibt.

const BERLIN_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" });
const BERLIN_HM_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false });

export type WeekdayGroup = "weekday" | "saturday" | "sunday";

// Minuten seit Mitternacht + Wochentags-Gruppe in Europe/Berlin — dieselbe Konvention wie
// trading_schedules.trading_windows/alarm_windows (siehe Migration 20260725120000_trading_schedules.sql).
export function berlinWeekdayAndMinutes(unixSec: number): { weekdayGroup: WeekdayGroup; minutesOfDay: number } {
  const date = new Date(unixSec * 1000);
  const weekdayShort = BERLIN_WEEKDAY_FORMATTER.format(date); // "Mon".."Sun"
  const weekdayGroup: WeekdayGroup = weekdayShort === "Sat" ? "saturday" : weekdayShort === "Sun" ? "sunday" : "weekday";
  const [hh, mm] = BERLIN_HM_FORMATTER.format(date).split(":").map(Number);
  return { weekdayGroup, minutesOfDay: hh * 60 + mm };
}

export interface TradingWindows {
  weekday: [number, number][];
  saturday: [number, number][];
  sunday: [number, number][];
}

export interface TradingHoursGateResult {
  exclude: boolean;
  atSec: number;
  at: string;
  weekdayGroup: WeekdayGroup;
  minutesOfDay: number;
  windowsChecked: [number, number][];
  resultText: string;
}

// Schritt 1 — Handelszeit. Quelle = trading_schedules.trading_windows (Philips Entscheidung, siehe
// docs/state-machine.md Tool 1 — aktiviert diese bisher nur referenzielle Spalte erstmals als
// echtes Gate). Fenster sind [von,bis) in Minuten seit Mitternacht, from inklusiv/to exklusiv.
export function evaluateTradingHoursGate(nowSec: number, tradingWindows: TradingWindows): TradingHoursGateResult {
  const { weekdayGroup, minutesOfDay } = berlinWeekdayAndMinutes(nowSec);
  const windows = tradingWindows[weekdayGroup] ?? [];
  const exclude = !windows.some(([from, to]) => minutesOfDay >= from && minutesOfDay < to);
  const at = berlinDateTimeStrFor(nowSec);
  const resultText = exclude
    ? `Analysezeitpunkt ${at}, AUSSERHALB der Handelszeit ---> kein Trade.`
    : `Analysezeitpunkt ${at}, innerhalb der Handelszeit.`;
  return { exclude, atSec: nowSec, at, weekdayGroup, minutesOfDay, windowsChecked: windows, resultText };
}

// Schritt 2 — Check News. Feste Schwellwerte (Richtwert, analog zum <30-Min-Schwellwert für ein
// "unmittelbar bevorstehendes" Session-Fenster in 04-check-session.md) statt völlig freier
// Interpretation durch Lana — 02-check-news.md selbst gibt keine exakte Minutenzahl vor, nur
// "kurzfristig"/"unmittelbar bevorstehend"/"bereits eingetreten".
export const NEWS_IMMINENT_MINUTES = 30; // Ausschlusskriterium: News <30 Min entfernt ---> kein Trade
export const NEWS_SOON_MINUTES = 120; // Soft: News <2h entfernt ---> Analyse aussetzen empfohlen (kein hartes Ausschlusskriterium)
export const NEWS_POST_EVENT_PAUSE_MINUTES = 14; // feste Pause 14min. Nach 15min kann man weiter analysieren.
const NY_SESSION_START_MINUTES = 14 * 60; // marktsessions.md#ny-session
const NY_SESSION_END_MINUTES = 22 * 60;

export interface NewsEventInput {
  eventTimeSec: number;
  currency: string;
  title: string;
}

export type NewsCategory = "exclude_imminent" | "exclude_post_event_pause" | "soon" | "ny_time_ahead" | "no_consequence";

export interface ClassifiedNewsEvent extends NewsEventInput {
  minutesUntil: number;
  category: NewsCategory;
  textBlock: string;
}

export interface NewsGateResult {
  hasData: boolean; // false = "keine Daten hinterlegt" (nicht zwingend "keine News", siehe 02-check-news.md)
  exclude: boolean;
  events: ClassifiedNewsEvent[];
  textBlocks: string[];
}

// events: bereits auf einen sinnvollen Umkreis um nowSec gefiltert (siehe tools/pretradeGates.ts —
// get_news_events selbst nimmt fromTime/toTime, die Eingrenzung passiert dort, nicht hier).
// hasEventsForDay: ob für den Analysetag überhaupt News-Daten hinterlegt sind (siehe
// 02-check-news.md-Einschränkung: "Tabelle wird nur für aktuell gehandelte Tage gepflegt") — separat
// von "events" (die bereits zeitlich gefilterte, evtl. leere Liste), damit hasData/"keine Daten
// hinterlegt" nicht mit "es gibt tatsächlich keine News heute" verwechselt wird.
export function evaluateNewsGate(nowSec: number, events: NewsEventInput[], hasEventsForDay: boolean): NewsGateResult {
  if (!hasEventsForDay) {
    return { hasData: false, exclude: false, events: [], textBlocks: [`keine News hinterlegt (${berlinDateStrFor(nowSec)})`] };
  }
  const classified: ClassifiedNewsEvent[] = events.map((ev) => {
    const minutesUntil = (ev.eventTimeSec - nowSec) / 60;
    const timeStr = berlinDateTimeStrFor(ev.eventTimeSec).split(" ")[1];
    const label = `News (${ev.title}, ${ev.currency}) um ${timeStr} Uhr`;
    let category: NewsCategory;
    let textBlock: string;
    if (minutesUntil >= 0 && minutesUntil < NEWS_IMMINENT_MINUTES) {
      category = "exclude_imminent";
      textBlock = `${label}\nunmittelbar bevorstehend ---> kein Trade`;
    } else if (minutesUntil < 0 && minutesUntil > -NEWS_POST_EVENT_PAUSE_MINUTES) {
      category = "exclude_post_event_pause";
      textBlock = `${label}\nbereits eingetreten (vor ${Math.round(-minutesUntil)} Min.) ---> feste Pause ${NEWS_POST_EVENT_PAUSE_MINUTES} Min.`;
    } else if (minutesUntil >= NEWS_IMMINENT_MINUTES && minutesUntil < NEWS_SOON_MINUTES) {
      category = "soon";
      textBlock = `${label}\nunmittelbar bevorstehend ---> Analyse aussetzen bis danach`;
    } else if (minutesUntil >= 0 && ev.currency === "USD" && (() => {
      const { minutesOfDay } = berlinWeekdayAndMinutes(ev.eventTimeSec);
      return minutesOfDay >= NY_SESSION_START_MINUTES && minutesOfDay < NY_SESSION_END_MINUTES;
    })()) {
      category = "ny_time_ahead";
      textBlock = `${label} (NY)\n ---> eventuell reduzierte Volatilität in London`;
    } else {
      category = "no_consequence";
      textBlock = `${label}\naktuell (${berlinDateTimeStrFor(nowSec).split(" ")[1]}) ---> keine Konsequenz`;
    }
    return { ...ev, minutesUntil, category, textBlock };
  });
  const exclude = classified.some((c) => c.category === "exclude_imminent" || c.category === "exclude_post_event_pause");
  const textBlocks = classified.length > 0 ? classified.map((c) => c.textBlock) : [`keine News hinterlegt (${berlinDateStrFor(nowSec)})`];
  return { hasData: true, exclude, events: classified, textBlocks };
}
