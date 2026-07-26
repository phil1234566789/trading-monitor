import { reactive } from "vue";
import { supabase } from "./supabaseClient.js";

// Wirtschafts-News als No-Go fürs Trade-Setup-Cockpit (Chat 2026-07-26) — Philip trägt die Termine
// selbst nicht ein; er schickt einen ForexFactory-Screenshot, Claude liest die ROTEN (High-Impact)
// Termine daraus ab und schreibt sie per Daten-Migration in `news_events` (siehe
// supabase/migrations/20260726120000_news_events.sql). Diese Datei ist deshalb NUR lesend — anders
// als sessions.js/chartColors.js gibt es hier keinen Schreibpfad aus dem Browser.
export const newsEvents = reactive([]);

// Nur Instrumente, die der TSC überhaupt bedient (siehe tradeSetupCockpit.ts, "Nur für Forex") —
// welche Währungen ein Paar betreffen, nicht (auch) welche Instrumente es insgesamt im Repo gibt.
const INSTRUMENT_CURRENCIES = {
  EURUSD: ["EUR", "USD"],
  GBPUSD: ["GBP", "USD"],
};

// Wie viele Minuten vor/nach einem High-Impact-Termin gilt er als No-Go — eigene Einschätzung
// (30min vor/nach ist eine gängige Daumenregel gegen News-Spikes), kein von Philip vorgegebener
// Wert. Bei Bedarf anpassen.
export const NEWS_NOGO_WINDOW_MINUTES = 30;

// Nur einmal beim Laden synchronisiert, kein periodisches Re-Poll (wie sessions.js/chartColors.js
// — dort unkritisch, weil der Browser selbst die Quelle für Änderungen ist; hier ist das
// akzeptiert, weil Termine i.d.R. Tage im Voraus eingetragen werden, lange bevor ein offener Tab
// sie bräuchte. Ein einfacher Reload holt neu eingetragene Termine).
async function syncNewsEvents() {
  try {
    // KEIN "event_time >= vor kurzem"-Filter (erste Version hatte einen, siehe Git-Historie) — die
    // Chart-Marker (newsMarkers.js) wollen auch länger zurückliegende Termine noch anzeigen können
    // (rückblickend nachvollziehen, ob ein Preis-Sprung mit einer News zusammenhing), nicht nur der
    // No-Go-Check braucht die Daten. Die Tabelle bleibt klein genug (ein paar Termine/Woche, von
    // Philip per Screenshot eingetragen), dass "alles laden" unproblematisch ist.
    const { data, error } = await supabase.from("news_events").select("event_time, currency, title").order("event_time");
    if (error) throw error;
    newsEvents.splice(
      0,
      newsEvents.length,
      ...(data ?? []).map((r) => ({ eventTime: Math.floor(new Date(r.event_time).getTime() / 1000), currency: r.currency, title: r.title })),
    );
  } catch (err) {
    console.error("News-Events aus DB laden fehlgeschlagen:", err);
  }
}
syncNewsEvents();

// events: schon von syncNewsEvents geladene Liste. Liefert nur die Termine, deren Währung
// `instrument` überhaupt betrifft (siehe INSTRUMENT_CURRENCIES) — gemeinsame Basis für den
// No-Go-Check (currentNewsNoGo) UND die Chart-Marker (siehe newsMarkers.js), damit beide garantiert
// dieselbe Instrument->Währung-Zuordnung verwenden.
export function newsEventsForInstrument(events, instrument) {
  const currencies = INSTRUMENT_CURRENCIES[instrument];
  if (!currencies) return [];
  return events.filter((e) => currencies.includes(e.currency));
}

// Liefert den Termin, der innerhalb von NEWS_NOGO_WINDOW_MINUTES um nowSec liegt — oder null.
export function currentNewsNoGo(events, instrument, nowSec, windowMinutes = NEWS_NOGO_WINDOW_MINUTES) {
  const windowSec = windowMinutes * 60;
  const hit = newsEventsForInstrument(events, instrument).find((e) => Math.abs(e.eventTime - nowSec) <= windowSec);
  return hit ? { title: hit.title, currency: hit.currency, eventTime: hit.eventTime } : null;
}
