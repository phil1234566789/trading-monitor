import { fetchForexCandles } from "../forexCandles.ts";
import { getLiquidityLevels, getSessions } from "../db.ts";
import { berlinOffsetMinutes } from "../berlinTime.ts";
import { buildSessionContextLookup, contextForPivot, bonusLabelForPivot } from "../sessionOccurrences.js";
import { PIP_SIZE } from "../pipConfig.js";
import { formatKontext } from "./dataExport.ts";

// Chat 2026-08-26, Philip: ersetzt das alte get_liquidity_levels — "früher war die Idee, dass Lana
// alles selbst herausfindet, solange sie ALLE Daten zur Verfügung hat. Die Realität zeigt, dass sie
// damit nicht klarkommt, wir müssen die Daten besser vorbereiten." Statt roher DB-Zeilen (1H/4H,
// ungefiltert oder nur nach Rezenz gedeckelt) liefert dieses Tool GENAU die Level, die für eine
// Analyse "jetzt" (bzw. zu einem Replay-Zeitpunkt toSec) wirklich relevant sind:
// - bereits GETOUCHTE Level: relevant, wenn ihr Sweep-Zeitpunkt im Fenster [fromSec, toSec] liegt
//   (Zeit-Kriterium, Preis spielt keine Rolle — ein Sweep von vor 3 Tagen bleibt Kontext, egal wie
//   weit der Preis seither gelaufen ist).
// - noch UNGETOUCHTE Level: relevant, wenn ihr Preis innerhalb von NEAR_RANGE_PIPS um den
//   Referenzpreis (Kurs "as of" toSec) liegt (Preis-Kriterium, Alter spielt keine Rolle — derselbe
//   Gedanke wie computeHtfLiquidityLevels/selectRelevantHtfLevels im Frontend seit der
//   2026-08-23-Nachbesserung: ein Monate alter, aber preisnaher Pivot ist relevanter als ein
//   rezenter, aber weit entfernter).
// Enthält dasselbe kontext-Feld wie get_data_export (formatKontext, von dort re-exportiert statt
// ein drittes Mal dupliziert).
export const NEAR_RANGE_PIPS = 40;
const DAY_SEC = 24 * 3600;
// Default für fromSec, falls nicht angegeben — dieselbe 7-Tage-Konvention wie
// M5_DETECTION_LOOKBACK_HOURS/EXPORT_LOOKBACK_HOURS (dataExport.ts/src/dataExport.js).
const DEFAULT_LOOKBACK_HOURS = 7 * 24;

export interface NearRelevantLiquidityLevelsArgs {
  instrument: string;
  fromSec?: number;
  toSec?: number;
  // get_data_snapshot (Task "schlankes Schritt-5-Tool", 2026-08-30) braucht einen engeren Radius
  // als das bestehende get_near_relevant_liquidity_levels (40 Pips) — Default bleibt für dessen
  // Aufrufer unverändert, nur ein expliziter Override ändert das Verhalten.
  rangePips?: number;
}

export async function buildNearRelevantLiquidityLevels({ instrument, fromSec, toSec, rangePips = NEAR_RANGE_PIPS }: NearRelevantLiquidityLevelsArgs) {
  const effectiveToSec = toSec ?? Math.floor(Date.now() / 1000);
  const effectiveFromSec = fromSec ?? effectiveToSec - DEFAULT_LOOKBACK_HOURS * 3600;
  const rangePrice = rangePips * PIP_SIZE;

  // includeAll:true + asOfSec:effectiveToSec — ALLE 1H/4H-Zeilen, touched/end_time bereits auf den
  // Stand "as of effectiveToSec" zurückgerechnet (Replay-konsistent, siehe db.ts: applyAsOf), roher
  // Filter (filterRelevantRows' Rezenz-Deckel) bewusst NICHT angewendet — die Zeit-/Preis-Auswahl
  // unten ersetzt ihn vollständig.
  const [rows, priceCandles, sessionConfigs] = await Promise.all([
    getLiquidityLevels(instrument, undefined, true, effectiveToSec),
    fetchForexCandles(instrument, "5m", { count: 1, toMs: effectiveToSec * 1000 }),
    getSessions(instrument),
  ]);

  const referencePrice = priceCandles[priceCandles.length - 1]?.close ?? null;

  const relevant = rows.filter((r) => {
    if (r.touched) {
      const touchedSec = r.end_time != null ? Math.floor(new Date(r.end_time).getTime() / 1000) : null;
      return touchedSec != null && touchedSec >= effectiveFromSec && touchedSec <= effectiveToSec;
    }
    return referencePrice != null && Math.abs(r.price - referencePrice) <= rangePrice;
  });

  const range = { fromSec: effectiveFromSec, toSec: effectiveToSec };
  if (relevant.length === 0) {
    return { instrument, referencePrice, range, rangePips, levels: [] };
  }

  // Session-Kontext-Fenster aus den tatsächlich relevanten Pivots abgeleitet (±1 Tag Puffer),
  // analog zu attachSessionContext (dataExport.ts) — nicht aus range/toSec, damit auch ein Monate
  // alter, preisnaher (aber zeitlich weit außerhalb von range liegender) Pivot noch einen
  // korrekten Kontext bekommt.
  const pivotTimesSec = relevant.map((r) => Math.floor(new Date(r.pivot_time).getTime() / 1000));
  // Kein candles-Parameter hier (anders als dataExport.ts: attachSessionContext) — dieses Tool holt
  // bewusst nur EINE Kerze für referencePrice (siehe oben), ein 7-Tage-M5-Fetch nur für die
  // Session-Preis-Verifikation (sessionExtremeSuffix, siehe sessionOccurrences.js) wäre hier
  // unverhältnismäßig teuer. bonusLabelForPivot/contextForPivot fallen dadurch auf die alte rein
  // zeitfenster-basierte Zuordnung zurück (Bug-Report Philip 2026-08-29 bleibt für DIESES Tool
  // bestehen, ist aber in get_data_export/get_forex_candles_archive-Flows bereits gefixt).
  const lookup = buildSessionContextLookup(
    sessionConfigs,
    Math.min(...pivotTimesSec) - DAY_SEC,
    Math.max(...pivotTimesSec) + DAY_SEC,
    (utcSec: number) => berlinOffsetMinutes(utcSec * 1000),
  );

  // Kuratierte Form statt roher DB-Zeile (Philip: "Daten besser vorbereiten") — id bleibt drin
  // (siehe trading/00-trading-steps/05-markt-beobachten/05-markt-beobachten.md: refId-Quelle für
  // add_pin_entry kind='liquidity_level'), interne poi-watcher-Buchhaltung (notified/notified_at/
  // created_at/updated_at/alert_price) fliegt raus — für Lanas Analyse irrelevant.
  const levels = relevant.map((r, i) => {
    const pivotTimeSec = pivotTimesSec[i];
    const dirNum: 1 | -1 = r.direction === "high" ? 1 : -1;
    const touchedTimeSec = r.touched && r.end_time != null ? Math.floor(new Date(r.end_time).getTime() / 1000) : null;
    const bonus = bonusLabelForPivot(pivotTimeSec, dirNum, r.price, lookup);
    return {
      id: r.id,
      timeframe: r.timeframe,
      direction: r.direction,
      price: r.price,
      touched: r.touched,
      pivotTime: pivotTimeSec,
      touchedTime: touchedTimeSec,
      context: contextForPivot(pivotTimeSec, dirNum, r.price, lookup),
      kontext: formatKontext(bonus, pivotTimeSec, touchedTimeSec, effectiveToSec),
    };
  });

  return { instrument, referencePrice, range, rangePips, levels };
}
