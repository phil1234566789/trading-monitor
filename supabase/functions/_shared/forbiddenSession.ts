// Backend-Gegenstück zu src/sessions.js' isForbiddenAt: "lag dieser Zeitpunkt in einer
// 'forbidden'-Session dieses Instruments?" (Asia, Spread Hour, Weekend Gap — gepflegt im
// Sessions-Modal, danger-Spalte). Der Chart wirft Trade-Setups, deren bestätigender M5-OB in so
// einem Fenster entstanden ist, komplett raus; poi-watcher alarmierte sie trotzdem (37 von 432
// alarmierten Zeilen im Bestand, 22.09.2026), weil er die sessions-Tabelle gar nicht kannte.
// "caution" (z.B. MMM) zählt hier bewusst NICHT — nur ein hartes Verbot, siehe DANGER_LEVELS.
import { sessionOccurrences } from "./sessionOccurrences.js";
import { berlinOffsetMinutes } from "./berlinTime.ts";

export interface SessionDangerConfig {
  label: string | null;
  fromMinutes: number;
  toMinutes: number;
  danger: string | null;
  days: number[] | null;
}

// sessionOccurrences erwartet Sekunden -> Offset-MINUTEN, berlinOffsetMinutes nimmt Millisekunden
// (derselbe *1000-Fallstrick wie in rsiDivergenceStats.ts, siehe dort).
const berlinOffsetFromSec = (utcSec: number) => berlinOffsetMinutes(utcSec * 1000);

// 2 Tage zurück statt eines 1-Sekunden-Fensters wie in sessions.js' currentSessionDanger: eine
// Session darf über mehrere Tage laufen (EURUSD "Weekend Gap", Fr 23:00 bis So 23:00), und
// sessionOccurrences generiert nur Vorkommen, deren Starttag im abgefragten Bereich liegt —
// gleicher Puffer und gleicher Grund wie OCCURRENCE_SEARCH_WINDOW_SEC in sessionWindow.ts.
const OCCURRENCE_SEARCH_WINDOW_SEC = 2 * 24 * 3600;

// Label der treffenden Session ("Asia"/"Spread Hour"/...) oder null — das Label statt eines
// booleans, damit der Aufrufer im Log/Summary benennen kann, WARUM nicht alarmiert wurde.
// sessions: bereits auf ein Instrument gefiltert (Aufrufer-Pflicht, wie überall bei sessionConfigs).
export function forbiddenSessionAt(sessions: SessionDangerConfig[], atSec: number): string | null {
  for (const s of sessions) {
    if (s.danger !== "forbidden") continue;
    const occurrences = sessionOccurrences(
      s.fromMinutes,
      s.toMinutes,
      atSec - OCCURRENCE_SEARCH_WINDOW_SEC,
      atSec + 1,
      berlinOffsetFromSec,
      s.days,
    );
    if (occurrences.some((o) => atSec >= o.startSec && atSec < o.endSec)) return s.label ?? "";
  }
  return null;
}
