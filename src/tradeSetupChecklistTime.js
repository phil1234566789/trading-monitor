import { formatDatedTime } from "./berlinTime.js";
import { sessionOccurrences } from "./sessionOccurrences.js";
import { newsEventsForInstrument, newsEventsInWindow, supportsNewsInstrument } from "./newsEventRules.js";

/**
 * Reiner F-Prüfkern. evaluatedAt und news[].eventTime sind Unix-Sekunden.
 * sessions: Frontend-Form {instrument,label,fromMinutes,toMinutes,days,danger}.
 * tradingWindows: Fenster des Instruments, {weekday,saturday,sunday}: [von,bis][] in Berlin-Minuten.
 * Handelsende (z.B. 18:00) kommt aus diesen Fenstern; keine Alarmfenster übergeben.
 * newsCoverage: "confirmed" bestätigt vollständige relevante Termine für dieses Instrument
 * im Ereigniszeitraum (evaluatedAt−15min, evaluatedAt+30min]; alles andere bleibt unbekannt.
 * Leere Arrays bedeuten geladene Daten, fehlende Arrays bedeuten unbekannte Daten.
 * @returns {{status: 'passed'|'pending'|'blocked'|'unknown'|'deferred', details: string[], outsideTradingHours: boolean}}
 */
export function evaluateChecklistTime({ evaluatedAt, instrument, sessions, tradingWindows, news, newsCoverage } = {}) {
  if (!Number.isFinite(evaluatedAt) || Math.abs(evaluatedAt) > 8.64e12 || !supportsNewsInstrument(instrument)) {
    return { status: "unknown", details: ["Bewertungszeitpunkt oder Instrument fehlt oder ist nicht unterstützt."], outsideTradingHours: false };
  }
  const details = [];
  let blocked = false;
  let outsideTradingHours = false;
  let unknown = false;
  const datedTime = formatDatedTime(evaluatedAt);
  const clock = datedTime.slice(11);
  // Auf der lokalen Kalenderachse wiederverwenden: reale Sekunden seit Mitternacht verschieben
  // Sessiongrenzen am DST-Wechseltag. News-Abstände bleiben dagegen auf der echten Zeitachse.
  const wallTime = Date.parse(`${datedTime.replace(" ", "T")}:00Z`) / 1000;
  const localDate = new Date(wallTime * 1000);
  const minute = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
  const weekday = localDate.getUTCDay();
  const group = weekday === 0 ? "sunday" : weekday === 6 ? "saturday" : "weekday";
  const windows = tradingWindows?.[group];
  if (!Array.isArray(windows) || windows.some(pair => !validWindow(pair))) {
    unknown = true;
    details.push("Handelszeiten fehlen oder sind ungültig.");
  } else if (!windows.some(([from, to]) => minute >= from && minute < to)) {
    blocked = true;
    outsideTradingHours = true;
    details.push(`${clock} — außerhalb der Handelszeiten (${instrument}, Europe/Berlin).`);
  }

  if (!Array.isArray(sessions)) {
    unknown = true;
    details.push("Sessiondaten fehlen.");
  } else {
    let activeCount = 0;
    for (const session of sessions) {
      if (!session?.instrument) {
        unknown = true;
        details.push("Instrumentzuordnung einer Session fehlt.");
        continue;
      }
      if (session.instrument !== instrument) continue;
      if (!validSession(session)) {
        unknown = true;
        details.push("Sessionkonfiguration ist ungültig.");
        continue;
      }
      // Weekend Gap ist gespeichert als Fr 23:00 bis So 23:00 (toMinutes=4260).
      // Wöchentliche Wiederholung begrenzt den nötigen Rückblick auch bei langen Spannen.
      const lookback = Math.min(7 * 86400, Math.max(0, session.toMinutes - session.fromMinutes) * 60);
      if (!sessionOccurrences(session.fromMinutes, session.toMinutes, wallTime - lookback, wallTime + 1, 0, session.days)
        .some(occurrence => occurrence.startSec <= wallTime && wallTime < occurrence.endSec)) continue;
      activeCount++;
      const label = session.label || "Unbenannte Session";
      if (session.danger === "forbidden") {
        blocked = true;
        details.push(`${clock} — ${label} — Verboten (kein Trade-Entry).`);
      } else if (session.danger === "caution") {
        unknown = true;
        details.push(`${clock} — ${label} — Vorsicht; zusätzliche Freigaberegel noch ungeklärt.`);
      } else {
        details.push(`${clock} — ${label} — OK`);
      }
    }
    if (!activeCount) details.push(`${clock} — keine aktive Session konfiguriert.`);
  }

  const rows = Array.isArray(news) ? news.filter(event => event && typeof event.currency === "string") : [];
  const validNews = Array.isArray(news) && rows.length === news.length;
  const relevant = newsEventsForInstrument(rows, instrument);
  const malformedTime = relevant.some(event => !Number.isFinite(event.eventTime) || Math.abs(event.eventTime) > 8.64e12);
  const hits = newsEventsInWindow(relevant.filter(event => Number.isFinite(event.eventTime) && Math.abs(event.eventTime) <= 8.64e12), instrument, evaluatedAt,
    { beforeMinutes: 30, afterMinutes: 15 });
  for (const event of hits) {
    blocked = true;
    details.push(`News: ${event.title || "Unbenannter Termin"} (${event.currency}) — warten bis ${formatDatedTime(event.eventTime + 15 * 60)} (Europe/Berlin).`);
  }
  if (!validNews || malformedTime || newsCoverage !== "confirmed") {
    unknown = true;
    details.push("News-Abdeckung für Instrument und Bewertungszeitpunkt fehlt oder ist ungeprüft.");
  } else if (!hits.length) {
    details.push("Keine News, fertig!");
  }
  return { status: blocked ? "blocked" : unknown ? "unknown" : "passed", details, outsideTradingHours };
}

function validWindow(pair) {
  return Array.isArray(pair) && pair.length === 2 && pair.every(Number.isInteger)
    && pair[0] >= 0 && pair[0] < pair[1] && pair[1] <= 1440;
}

function validSession(session) {
  return Number.isInteger(session.fromMinutes) && session.fromMinutes >= 0 && session.fromMinutes < 1440
    && Number.isSafeInteger(session.toMinutes) && session.toMinutes >= 0
    && (session.days == null || (Array.isArray(session.days) && session.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6)))
    && (session.danger == null || ["normal", "caution", "forbidden"].includes(session.danger));
}
