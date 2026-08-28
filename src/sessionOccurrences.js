// Reine Session-Vorkommen-Berechnung + Kontext-Zuordnung, extrahiert aus sessions.js/dataExport.js
// (Chat 2026-08-02) — bewusst OHNE jeden Browser-Import (kein localStorage/Vue-reactive/Supabase-
// Client), damit dieses Modul auch außerhalb des Browsers (Deno, MCP-Server) direkt importierbar
// ist. Gleicher Schnitt wie liquidity.js → liquidityDetection.js und orderBlocks.js →
// orderBlockDetection.js (siehe CLAUDE.md "MCP-Server") — sessions.js selbst importiert
// sessionOccurrences/ALL_DAYS jetzt von hier und re-exportiert sie, öffentliche API unverändert.
// buildSessionContextLookup/contextForPivot lebten vorher als Kopien nur in dataExport.js
// (Frontend) — hier zentral, nimmt sessionConfigs (bereits nach Instrument/highLowRelevant
// gefiltert) UND die Zeitzonen-Offset-Funktion als Parameter entgegen statt den globalen
// `sessions`-Singleton bzw. eine fest verdrahtete Berlin-Funktion vorauszusetzen — sonst wäre eine
// der beiden Browser-Abhängigkeiten (sessions.js' localStorage-Singleton) wieder mit drin.

const DAY_SEC = 24 * 3600;

// Wochentage für das "days"-Feld einer Session (Chat 2026-07-26: "Session Indikatoren am WE
// weglassen"). 0=So..6=Sa wie JS Date#getDay()/#getUTCDay().
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// session.days ist null/undefined für alte, vor diesem Feature angelegte Sessions — das bedeutet
// "jeden Tag", NICHT "nie", sonst würden bestehende Sessions beim ersten Laden nach dem Feature
// plötzlich unsichtbar.
export function daysOrAll(days) {
  return days && days.length > 0 ? days : ALL_DAYS;
}

// Findet den UTC-Zeitpunkt der LOKALEN Mitternacht des Tages, der "nearUtcSec" lokal enthält.
// 2026-08-24: die vorige 2-Schritt-Fixpunkt-Iteration (Offset an nearUtcSec selbst abgefragt) hing
// sich am Tag der Herbst-Umstellung (lokal 25h, z.B. 26.10.2025) endlos auf — der zweite
// Iterationsschritt oszillierte exakt zwischen den beiden Offset-Regimen der doppelt vorkommenden
// Stunde und lieferte "utcGuess" unverändert zurück, wodurch sessionOccurrences' äußere Schleife
// (dayStart bleibt stehen) nie terminierte (gefunden beim Jahres-Backtest über
// rsiDivergenceStats.ts, das als erster Aufrufer je eine so lange Zeitspanne am Stück durchlief).
// Fix: den Offset an einem Punkt knapp NACH der groben Mitternacht abfragen (30min genügt, jede
// DST-Umstellung passiert lokal frühestens um 01:00) statt an der Tagesgrenze selbst — das liegt
// nie in der doppelten Stunde. Damit das auch bei einem 25h-Tag den nächsten Kalendertag trifft statt
// wieder denselben, ruft sessionOccurrences() diese Funktion mit einer +3h-Sicherheitsmarge auf
// (siehe dort), nicht mehr mit einem reinen "+DAY_SEC".
function localMidnightUtc(nearUtcSec, offsetMinutesFn) {
  const roughOffsetSec = offsetMinutesFn(nearUtcSec) * 60;
  const roughLocalSec = nearUtcSec + roughOffsetSec;
  const dayStartRoughLocalSec = Math.floor(roughLocalSec / DAY_SEC) * DAY_SEC;
  const probeLocalSec = dayStartRoughLocalSec + 30 * 60;
  const probeApproxUtcSec = probeLocalSec - roughOffsetSec;
  const offsetSec = offsetMinutesFn(probeApproxUtcSec) * 60;
  return dayStartRoughLocalSec - offsetSec;
}

// Lokaler Wochentag (0=So..6=Sa) eines UTC-Zeitpunkts, der bereits lokale Mitternacht ist.
function localWeekday(dayStartUtcSec, offsetMinutesFn) {
  const offsetSec = offsetMinutesFn(dayStartUtcSec) * 60;
  return new Date((dayStartUtcSec + offsetSec) * 1000).getUTCDay();
}

// Liefert alle Vorkommen (Start/Ende in echten UTC-Sekunden) einer täglich wiederkehrenden Session
// im Fenster [rangeStartSec, rangeEndSec]. fromMinutes/toMinutes sind Minuten seit Mitternacht in
// LOKALER Zeit — toMinutes <= fromMinutes bedeutet eine Session, die über Mitternacht läuft.
// tzOffsetMinutes ist entweder eine Zahl (fester Offset, für deterministische Tests) ODER eine
// Funktion (utcSec) => Offset-Minuten (für echte DST-Korrektheit).
// days (optional): welche lokalen Wochentage (0=So..6=Sa) diese Session überhaupt STARTEN darf,
// siehe ALL_DAYS/daysOrAll. null/undefined = jeden Tag (Altverhalten).
//
// JSDoc-Typ für tzOffsetMinutes hier nicht nur Doku — ohne den Union-Typ leitet TS' allowJs-
// Inferenz für einen Cross-Directory-Import aus dem MCP-Server (siehe scripts/rsiDivergenceStats.ts) nur
// `number` aus dem Default-Wert `= 0` her und lehnt eine Funktions-Übergabe ab, obwohl die Laufzeit
// (typeof tzOffsetMinutes === "function") beides längst unterstützt — gleiches Muster wie
// computeRsi in rsi.js (siehe dortiger Kommentar).
/**
 * @param {number} fromMinutes
 * @param {number} toMinutes
 * @param {number} rangeStartSec
 * @param {number} rangeEndSec
 * @param {number | ((utcSec: number) => number)} [tzOffsetMinutes]
 * @param {number[] | null} [days]
 * @returns {{startSec: number, endSec: number}[]}
 */
export function sessionOccurrences(fromMinutes, toMinutes, rangeStartSec, rangeEndSec, tzOffsetMinutes = 0, days = null) {
  if (rangeStartSec == null || rangeEndSec == null || rangeEndSec <= rangeStartSec) return [];
  const offsetMinutesFn = typeof tzOffsetMinutes === "function" ? tzOffsetMinutes : () => tzOffsetMinutes;
  const allowedDays = daysOrAll(days);

  // Ein Tag Puffer VOR dem Fenster: eine über Mitternacht laufende Session, die am Vortag beginnt,
  // kann noch bis in rangeStartSec hineinreichen.
  let dayStart = localMidnightUtc(rangeStartSec - DAY_SEC, offsetMinutesFn);

  const results = [];
  // Puffer-Tag NACH dem Fenster ebenso großzügig — der Überlappungs-Filter unten verwirft ohnehin
  // jedes Vorkommen, das tatsächlich außerhalb liegt, eine Iteration zu viel ist also harmlos.
  while (dayStart <= rangeEndSec + DAY_SEC) {
    if (allowedDays.includes(localWeekday(dayStart, offsetMinutesFn))) {
      const startSec = dayStart + fromMinutes * 60;
      let endSec = dayStart + toMinutes * 60;
      if (toMinutes <= fromMinutes) endSec += DAY_SEC;
      if (endSec > rangeStartSec && startSec < rangeEndSec) {
        results.push({ startSec, endSec });
      }
    }
    // +3h Marge statt reinem "+DAY_SEC": ein Herbst-Umstellungstag hat lokal 25h, +DAY_SEC allein
    // würde noch INNERHALB desselben Tages landen und localMidnightUtc liefert (korrekt) dessen
    // eigene Mitternacht erneut zurück -> Endlosschleife, siehe Kommentar dort.
    dayStart = localMidnightUtc(dayStart + DAY_SEC + 3 * 3600, offsetMinutesFn);
  }
  return results;
}

// Sitzungs-Kontext fürs LQ-Level (Chat 2026-07-30, Philip: "wenn ne Session 'high/low
// entscheidend' true hat, dann & das LQ-Level gehört zur Session ... context: 'asia high'") — nur
// Sessions mit highLowRelevant, deren TATSÄCHLICHES Zeitfenster (DST-aware) den Pivot-Zeitpunkt
// enthält. Erste passende Session gewinnt — mehrere überlappende highLowRelevant-Sessions
// desselben Instruments wären ein Konfigurationsfall, den Philip im Sessions-Modal selbst
// vermeiden müsste, keine eigene Prioritäts-Logik hier nötig.
// sessionConfigs: schon auf ein Instrument gefiltert (Aufrufer-Pflicht, siehe PriceChart.vue's
// `sessions.filter((s) => s.instrument === props.symbol)`-Muster) — hier zusätzlich auf
// highLowRelevant gefiltert. tzOffsetMinutesFn: (utcSec) => Offset-Minuten, z.B. Berlin-Offset.
export function buildSessionContextLookup(sessionConfigs, rangeStartSec, rangeEndSec, tzOffsetMinutesFn) {
  return sessionConfigs
    .filter((s) => s.highLowRelevant)
    .map((session) => ({
      label: session.label || "",
      occurrences: sessionOccurrences(session.fromMinutes, session.toMinutes, rangeStartSec, rangeEndSec, tzOffsetMinutesFn, session.days),
    }));
}

// "asia high"/"asia low" (Philips Beispiel) — Label klein geschrieben + high/low je nach
// Level-Richtung, kein separates Text-Template pro Session nötig. Philip: "selbst wenn noch mehr
// zum context dazukommt, reicht es einfach mehr Text dazuzuschreiben" — bewusst ein einzelner
// freier String, keine strukturierte {session, kind}-Aufteilung. dir: 1 (high) | -1 (low), wie im
// lokalen Liquidity-Level-Objekt (siehe liquidityDetection.js: buildLevel).
export function contextForPivot(pivotTime, dir, sessionContextLookup) {
  const direction = dir === 1 ? "high" : "low";
  for (const { label, occurrences } of sessionContextLookup) {
    if (occurrences.some((o) => pivotTime >= o.startSec && pivotTime < o.endSec)) {
      return `${label.toLowerCase()} ${direction}`.trim();
    }
  }
  return null;
}

// Chat 2026-08-26, Philip: "<bonus>" fürs LQ-Level-Label (Chart-Rendering, siehe liquidity.js:
// formatLiquidityLevelLabel) UND fürs "kontext"-Feld im Datenexport (Lana) — "Asia-High"/"NY-Low"/
// "MMM-High" statt contextForPivot's kleingeschriebenem "asia high". Eigene Funktion statt
// contextForPivot's Ausgabe nachträglich umzuformatieren: contextForPivot schreibt das Label
// bewusst klein (siehe dortiger Kommentar, Philip 2026-07-30, gilt für seine bisherigen
// Verwendungen unverändert weiter) — hier bleibt session.label dagegen UNVERÄNDERT stehen, weil
// Philip Session-Namen im Sessions-Modal bereits in der gewünschten Schreibweise tippt ("NY"/"MMM"/
// "Asia"); ein nachträgliches .toLowerCase() würde "NY" zu "Ny" verstümmeln.
export function bonusLabelForPivot(pivotTime, dir, sessionContextLookup) {
  const direction = dir === 1 ? "High" : "Low";
  for (const { label, occurrences } of sessionContextLookup) {
    if (occurrences.some((o) => pivotTime >= o.startSec && pivotTime < o.endSec)) {
      return label ? `${label}-${direction}` : null;
    }
  }
  return null;
}
