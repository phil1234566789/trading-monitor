import { barSecondsFor } from "./timeframes.ts";

// Replay-Rueckrechnung der persistierten Zonen/Level auf den Stand "as of asOfSec", aus db.ts
// herausgeloest (Datei ueber dem 1000-Zeilen-Backstop, und die Tests sollen ohne Supabase-Client
// importierbar sein).

const M5_SECONDS = barSecondsFor("5m");

export interface ProbeCandle {
  time: number;
  high: number;
  low: number;
}

// Touch/Invalidation tragen die OEFFNUNGS-Zeit der Kerze, auf der sie erkannt wurden (endTime =
// cur.time in _shared/orderBlocks.ts, touchedTime = c.time in _shared/liquidity.ts) — bei einem
// 4H-Level also bis zu 4h vor dem echten Ereignis. Der Zeitstempel allein taugt damit weder als
// "schon passiert" (leakt Zukunft) noch als "noch nicht passiert" (verschweigt einen laufenden
// Sweep stundenlang, toedlich fuer M5-Intraday). Aufloesung: M5-Kerzen entscheiden.
//   - Ereigniszeit NACH asOfSec          -> eindeutig Zukunft, verschweigen
//   - Ereigniskerze bereits geschlossen  -> eindeutig Vergangenheit, unveraendert uebernehmen
//   - dazwischen (Kerze laeuft noch)     -> erste M5-Kerze suchen, die das Niveau wirklich bricht
// Ohne M5-Abdeckung bleibt es beim alten Verhalten (Ereigniszeit gilt) — lieber die bisherige
// Ungenauigkeit als ein neuer blinder Fleck.
function resolveEventSec(
  eventSec: number,
  timeframe: string,
  asOfSec: number,
  probe: ProbeCandle[],
  breached: (c: ProbeCandle) => boolean,
): number | null {
  if (eventSec > asOfSec) return null;
  if (eventSec + barSecondsFor(timeframe) <= asOfSec) return eventSec;
  const covered = probe.some((c) => c.time + M5_SECONDS >= eventSec && c.time <= asOfSec);
  if (!covered) return eventSec;
  // time + M5 <= asOfSec: nur abgeschlossene M5-Kerzen zaehlen, sonst leakt die laufende Kerze
  // dieselbe Zukunft eine Ebene tiefer.
  const hit = probe.find((c) => c.time >= eventSec && c.time + M5_SECONDS <= asOfSec && breached(c));
  return hit ? hit.time : null;
}

const toSec = (iso: string) => new Date(iso).getTime() / 1000;

// Frueheste Ereigniszeit, die noch in einer laufenden Kerze liegt — Signal fuer den Aufrufer, ob er
// ueberhaupt M5-Kerzen nachladen muss (siehe asOfProbeCandles in db.ts). null = kein Zweifelsfall.
export function earliestAmbiguousEventSec(
  rows: { timeframe: string; touched: boolean; invalidated?: boolean; end_time: string | null }[],
  asOfSec: number | undefined,
): number | null {
  if (asOfSec == null) return null;
  let earliest: number | null = null;
  for (const r of rows) {
    if (!r.touched && !r.invalidated) continue;
    if (r.end_time == null) continue;
    const eventSec = toSec(r.end_time);
    if (eventSec > asOfSec || eventSec + barSecondsFor(r.timeframe) <= asOfSec) continue;
    if (earliest == null || eventSec < earliest) earliest = eventSec;
  }
  return earliest;
}

// Analog zu applyAsOf unten fuer liquidity_levels, aber fuer ob_zones: end_time ist hier der
// Zeitpunkt, an dem die Zone entweder touched ODER invalidated wurde (siehe detectOrderBlocks in
// _shared/orderBlocks.ts — waechst mit jeder Kerze, friert bei einem der beiden Ereignisse ein).
// Beide Ereignisse bedeuten "Preis hat die Zone erreicht", deshalb ein gemeinsames M5-Kriterium.
// Eine Zone, deren start_time NACH asOfSec liegt, existierte zu diesem Zeitpunkt noch nicht.
// Bug-Report Lana 2026-08-02: get_data_export zeigte Zonen mit start_time NACH dem Replay-Cutoff.
export function applyAsOfZones<
  T extends {
    timeframe: string;
    top: number;
    bottom: number;
    start_time: string;
    touched: boolean;
    invalidated: boolean;
    end_time: string | null;
    retested?: boolean;
    retested_at?: string | null;
  },
>(rows: T[], asOfSec: number | undefined, probe: ProbeCandle[] = []): T[] {
  if (asOfSec == null) return rows;
  return rows
    .filter((r) => toSec(r.start_time) <= asOfSec)
    .map((r) => {
      let row = r;
      // end_time == null bei touched/invalidated kommt von poi-watcher nie vor (es schreibt beide
      // immer zusammen) — unveraendert durchreichen statt zu raten.
      if ((row.touched || row.invalidated) && row.end_time != null) {
        const eventSec = toSec(row.end_time);
        const resolved = resolveEventSec(eventSec, row.timeframe, asOfSec, probe, (c) => c.high >= row.bottom && c.low <= row.top);
        if (resolved == null) row = { ...row, touched: false, invalidated: false, end_time: null };
        else if (resolved !== eventSec) row = { ...row, end_time: new Date(resolved * 1000).toISOString() };
      }
      // retested_at ist unabhaengig von end_time (Retest kann lange NACH dem Touch bestaetigt
      // werden, siehe orderblöcke.md#retest-status) — eigener Rueckrechnungs-Schritt, sonst dieselbe
      // Bug-Klasse. Bewusst ohne M5-Aufloesung: ein Retest wird ueber einen KERZENSCHLUSS ausserhalb
      // der Zone definiert, ist also ohnehin erst zum Kerzenschluss entschieden, und fuer eine
      // bestaetigte Confluence spielt das Alter laut Doku keine Rolle.
      if (row.retested) {
        const knownAt = row.retested_at == null ? null : toSec(row.retested_at) + barSecondsFor(row.timeframe);
        if (knownAt == null || knownAt > asOfSec) row = { ...row, retested: false, retested_at: null };
      }
      return row;
    });
}

// Rekonstruiert den Stand "as of asOfSec" statt des Live-Stands: ein Pivot, der erst NACH asOfSec
// entstanden ist, existierte damals noch nicht (raus); ein Sweep, der aus Sicht des Stichzeitpunkts
// noch nicht passiert war, wird zurueckgenommen. Bug-Report Philip 2026-08-02: beim Backtesten
// zeigte get_data_export den AKTUELLEN Live-Sweep-Stand statt des Stands zum Replay-Zeitpunkt —
// dadurch fielen damals noch unberuehrte Level durch den RECENT_SWEEP_COUNT-Filter.
export function applyAsOf<T extends { timeframe: string; direction: string; price: number; pivot_time: string; touched: boolean; end_time: string | null }>(
  rows: T[],
  asOfSec: number | undefined,
  probe: ProbeCandle[] = [],
): T[] {
  if (asOfSec == null) return rows;
  return rows
    .filter((r) => toSec(r.pivot_time) <= asOfSec)
    .map((r) => {
      if (!r.touched || r.end_time == null) return r;
      const eventSec = toSec(r.end_time);
      const resolved = resolveEventSec(eventSec, r.timeframe, asOfSec, probe, (c) => (r.direction === "high" ? c.high >= r.price : c.low <= r.price));
      if (resolved == null) return { ...r, touched: false, end_time: null };
      if (resolved !== eventSec) return { ...r, end_time: new Date(resolved * 1000).toISOString() };
      return r;
    });
}
