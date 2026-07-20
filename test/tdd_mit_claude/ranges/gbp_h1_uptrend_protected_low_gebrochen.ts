import { Pivot, PivotHigh, PivotLow, MarketStructureState } from "../../../src/range.type";

/**
 * BUG-REPORT PHILIP 2026-07-20 (Debug-Metadaten-Copy aus dem laufenden Chart, GBPUSD 1h, Replay bis
 * 08.07.2026 23:15 = 1783545300):
 *
 *   "wir haben einen 1h uptrend. leider ist das ermittelte protected-low schon lang unterschritten
 *   worden (=getouched + weitere pivots drunter, sonst wärs ja ein LS)"
 *
 * RÜCKFRAGE PHILIP: "was macht 1.33459 nochmal zum protected low? [...] da range.high bis dahin
 * noch nicht nach oben gebrochen ist, haben wir nicht wirklich ne bullische struktur"
 *
 * ANTWORT (gegengecheckt, siehe unten "WIE WIRD 1.33459 ÜBERHAUPT PROTECTED-LOW?") — Philip hat
 * recht: ZUM ZEITPUNKT, an dem der Pivot 1.33459 selbst gelesen wird (03.07. 15:00), ist range.high
 * (1.33844) noch NICHT gebrochen, es gibt noch keine bestätigte bullische Struktur. 1.33459 wird
 * deshalb an DIESER Stelle erstmal nur als ganz normaler Pullback in structurePivots einsortiert —
 * GENAU wie jeder andere. Das ist bestehendes, gewolltes Verhalten (siehe rangeState7 in
 * gbp_h1_uptrend.ts: "das JÜNGSTE qualifizierende higher-low [zum BESTÄTIGUNGS-Zeitpunkt] gilt als
 * protected-low" — die Auswahl ist immer RÜCKWIRKEND, nie beim Entstehen des Pivots selbst).
 * 1.33459 wird erst gut 3 Tage SPÄTER (06.07. 21:00) rückwirkend zu protected-low, in dem Moment, wo
 * ein eingebetteter Periode-2-Pivot (1.33969) mit echtem Kerzen-Close range.high (1.33844) bricht —
 * siehe Trace unten. Das ist NICHT der Bug, das ist dieselbe "rückwirkende Auswahl des jüngsten
 * qualifizierenden Pullbacks" wie beim allerersten Uptrend-Start (tryConfirmUptrend).
 *
 * WICHTIGER SELBST-FUND beim Verifizieren: meine ERSTE Version dieser Datei hatte die Pivots aus
 * einer älteren TDD-Fixture (gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts) 1:1 kopiert — die enthält
 * aber pivot14/pivot15 (1.34103/1.34308), die zum HIER relevanten Replay-Zeitpunkt (08.07. 23:15)
 * noch GAR NICHT als Periode-5-Fraktal bestätigt sein können (ein Fraktal braucht `period` Kerzen
 * NACH sich selbst zur Bestätigung, siehe isUpFractal in liquidity.js — für pivot14 um 19:00 stehen
 * bis 23:15 nur 4 weitere H1-Kerzen zur Verfügung, nicht 5). Dadurch hatte meine erste Simulation
 * ein zu hohes currRange.high (1.34103 statt 1.34016) — gefixt, indem ich detectLiquidityLevels
 * SELBST gegen die echten Kerzen (test/fixtures/gbpusd-h1-trend.json, geclippt auf replayUntil)
 * habe laufen lassen, exakt wie computeRangesPivotsFor in PriceChart.vue. Ergebnis reproduziert
 * jetzt Philips Live-State 1:1 (trend/currRange/structurePivots/innerStructurePivots).
 */
const currRangeLow: PivotLow = { type: "low", price: 1.32972, pivotAt: "02.07.2026 14:00", pivotTime: 1782993600, touched: false };
// sweeped-high statt high: ein eingebetteter Pivot (1.34103, 08.07. 19:00) hat den Preis zwar
// überschritten, aber (noch) keine Kerze DARÜBER geschlossen — echter Bruch bisher nur ein Docht.
const currRangeHigh: PivotHigh = {
  type: "sweeped-high",
  price: 1.34016,
  pivotAt: "07.07.2026 03:00",
  pivotTime: 1783386000,
  touched: { price: 1.34016, touchedAt: "08.07.2026 19:00" },
};
const pivot6: Pivot = { type: "low", price: 1.33346, pivotAt: "03.07.2026 02:00", pivotTime: 1783036800, touched: { price: 1.33346, touchedAt: "06.07.2026 07:00" } };
const pivot7: Pivot = { type: "high", price: 1.3381, pivotAt: "03.07.2026 08:00", pivotTime: 1783058400, touched: { price: 1.3381, touchedAt: "06.07.2026 19:00" } };
// DAS ist das aktuell gesetzte protected-low, das laut Philip längst gebrochen ist.
const protectedLow: Pivot = {
  type: "protected-low",
  price: 1.33459,
  pivotAt: "03.07.2026 15:00",
  pivotTime: 1783083600,
  touched: { price: 1.33459, touchedAt: "03.07.2026 22:00" },
};
// Der eingebettete Pivot, der range.high (1.33844) am 06.07. 21:00 ERSTMALS mit echtem Kerzen-Close
// bricht — DAS ist der Moment, in dem tryConfirmUptrend feuert und protectedLow rückwirkend gewählt
// wird (nicht in dieser Datei als eigene Konstante gebraucht, aber für den Trace relevant).
// pivot9: der ERSTE Pivot, der protectedLow (1.33459) preislich unterschreitet — wird aber (per
// markLqSweeps, weil NIE eine Kerze drunter schließt) selbst zum 'LQ-sweep', bevor die
// Trendbestätigung überhaupt feuert -> qualifiziert sich deshalb NICHT als Pullback-Kandidat.
const pivot9: Pivot = { type: "LQ-sweep", price: 1.33286, pivotAt: "06.07.2026 09:00", pivotTime: 1783321200, touched: { price: 1.33286, touchedAt: "08.07.2026 11:00" } };
const pivot11: Pivot = { type: "high", price: 1.33941, pivotAt: "07.07.2026 13:00", pivotTime: 1783422000, touched: { price: 1.33941, touchedAt: "08.07.2026 19:00" } };
// pivot12: der ERSTE Pivot, der wirklich (mit echtem Close, siehe unten) unter protectedLow bricht.
const pivot12: Pivot = { type: "low", price: 1.33421, pivotAt: "08.07.2026 03:00", pivotTime: 1783472400, touched: { price: 1.33421, touchedAt: "08.07.2026 10:00" } };
// pivot13: noch tiefer, aktuell unberührt — die JÜNGSTE (und tiefste) bekannte Struktur.
const pivot13: Pivot = { type: "low", price: 1.33222, pivotAt: "08.07.2026 11:00", pivotTime: 1783501200, touched: false };
const p2_1_33775: Pivot = { type: "high", price: 1.33775, pivotAt: "08.07.2026 15:00", pivotTime: 1783515600, touched: { price: 1.33775, touchedAt: "08.07.2026 18:00" } };
// noch nicht als Periode-5-Fraktal bestätigt (siehe Kommentar oben) — deshalb nur innerStructurePivots.
const p2_1_34103: Pivot = { type: "high", price: 1.34103, pivotAt: "08.07.2026 19:00", pivotTime: 1783530000, touched: false };

/**
 * STATE 0 — Philips Live-Kopie, jetzt VERIFIZIERT (mit echter Fraktal-Erkennung gegen
 * test/fixtures/gbpusd-h1-trend.json nachgebaut, reproduziert 1:1).
 */
const state0_buggy: MarketStructureState = {
  trend: "uptrend",
  currRange: { high: currRangeHigh, low: currRangeLow },
  structurePivots: [pivot6, pivot7, protectedLow, pivot9, pivot11, pivot12, pivot13],
  innerStructurePivots: [p2_1_33775, p2_1_34103],
  appliedPivots: [], // für diesen Bug nicht relevant, siehe state0_buggy oben genügt für die Analyse
};

/**
 * WIE WIRD 1.33459 ÜBERHAUPT PROTECTED-LOW? (Antwort auf Philips Rückfrage)
 *
 * tryConfirmUptrend feuert NICHT beim Entstehen von 1.33459 (03.07. 15:00) — da ist range.high
 * (1.33844) noch intakt. Es feuert erst am 06.07. 21:00, als ein EINGEBETTETER Periode-2-Pivot bei
 * 1.33969 range.high mit einem ECHTEN Kerzen-Close darüber bricht (closesAboveOldHigh, siehe
 * applyInnerMarketStructurePivot). GENAU in diesem Moment sucht tryConfirmUptrend den "jüngsten
 * qualifizierenden Pullback" (type 'low', pivotTime > highTime) unter structurePivots +
 * innerStructurePivots — und WÄHLT DABEI RÜCKWIRKEND, nicht chronologisch beim Entstehen. Zu diesem
 * Zeitpunkt sind die Kandidaten: pivot6 (1.33346) und pivot8/1.33459 — pivot9 (1.33286, zeitlich
 * NÄHER an 06.07. 21:00 als pivot8) zählt NICHT mit, weil es bis dahin schon zu 'LQ-sweep'
 * reklassifiziert wurde (markLqSweeps läuft VOR der Bruch-Prüfung bei jedem applyInnerMarketStructurePivot-
 * Aufruf, siehe Zeile 220) — und der Filter in tryConfirmUptrend verlangt exakt `type === 'low'`.
 * Damit bleibt 1.33459 als jüngster ECHTER 'low'-Kandidat übrig -> wird protected-low.
 *
 * Kurz: Philips Beobachtung war goldrichtig ("noch keine bullische Struktur zu diesem Zeitpunkt")
 * — nur bezog sie sich auf den falschen Zeitpunkt (Pivot-Entstehung statt Bestätigungs-Event 3 Tage
 * später). Die rückwirkende Auswahl selbst ist bestehendes, korrektes Verhalten.
 *
 * DER EIGENTLICHE BUG bleibt derselbe wie in der ersten Version dieser Datei: NACHDEM protectedLow
 * gesetzt ist, wird es nie wieder geprüft — auch nicht, als pivot12 (1.33421) und pivot13 (1.33222)
 * als ECHTE (nicht LQ-sweep-reklassifizierte) tiefere Lows entstehen.
 */

/**
 * PHILIPS KORREKTUR (überschreibt meinen ersten Kandidat-3-Vorschlag hier): das eigentliche Problem
 * liegt schon EINE EBENE FRÜHER als die Sweep-Mechanik — bei der PULLBACK-AUSWAHL selbst, zum
 * Bestätigungsmoment (06.07. 21:00):
 *
 *   "1.33459 ist pullback, korrekt. 1.33286 ist tieferes pullback, außerdem 1.33459 schon längst
 *   getouched. => algo muss [den] pullback, welcher ungetoucht ist[,] als protected-low nehmen.
 *   1.33286 ist zum Zeitpunkt 08.07. 23:15 ein LS geworden, aber zum Zeitpunkt 06.07. 21:00 ist das
 *   das letzte ungetouchte pullback => gilt in diesem moment als protected-low"
 *
 * Der Grund, warum tryConfirmUptrend am 06.07. 21:00 fälschlich 1.33459 statt 1.33286 wählte, war
 * NICHT (nur) der fehlende Sweep-Rücksprung — es war die AUSWAHL-Regel selbst, aus zwei Gründen:
 *
 * 1. `type === 'low'`-Filter: 1.33286 war zu diesem Zeitpunkt in der Datenstruktur (unser
 *    state0_buggy) schon als 'LQ-sweep' klassifiziert — obwohl der TATSÄCHLICHE Touch (der es zu
 *    einem LQ-sweep macht) erst am 08.07. 11:00 passiert, also NACH dem Bestätigungsmoment! `touched`
 *    ist im bisherigen Pivot-Typ ein GLOBALER Fakt (irgendwann bis zum Ende des geladenen Fensters),
 *    kein zeitlich-lokaler — markLqSweeps reklassifiziert also mit Wissen aus der "Zukunft"
 *    (relativ zum gerade verarbeiteten Bestätigungs-Schritt).
 * 2. Selbst OHNE Punkt 1 hätte die alte Regel ("zeitlich jüngster Kandidat mit type==='low'") nicht
 *    geprüft, ob ein Kandidat zum Bestätigungsmoment selbst schon (durch einen FRÜHER liegenden
 *    Touch) invalidiert war.
 *
 * UMGESETZT (marketStructureAnalysis.ts: isUntouchedAsOf + tryConfirmUptrend, siehe dort):
 * - Pivot-Typ um `touchedTime` (unix, optional) erweitert (range.type.ts) — nur intern, taucht in
 *   den Metadaten-Panels weiterhin nicht auf (pivotForDisplay filtert es genau wie pivotTime raus).
 * - qualifyingPullbacks akzeptiert jetzt `type === 'low'` ODER `type === 'LQ-sweep'` (Punkt 1).
 * - UND verlangt zusätzlich, dass der Kandidat zum Bestätigungsmoment (pivotTime des brechenden
 *   Pivots) noch ungetoucht war: `!touched || touched.touchedTime > confirmationMoment` (Punkt 2).
 * - Unter den verbleibenden Kandidaten gewinnt weiterhin der ZEITLICH JÜNGSTE, NICHT der tiefste —
 *   das bestehende rangeState7-Verhalten (test/marketStructureAnalysis.test.js, alle Kandidaten dort
 *   ungetoucht) bleibt dadurch unverändert bestehen, siehe test/marketStructureAnalysisProtectedLow.test.js.
 *
 * Für UNSEREN Fall bedeutet das: 1.33346 (pivot6, getoucht 06.07. 07:00) und 1.33459 (pivot8,
 * getoucht 03.07. 22:00) sind beide schon VOR dem Bestätigungsmoment (06.07. 21:00) getoucht ->
 * fallen raus. 1.33286 (pivot9) wird erst am 08.07. 11:00 getoucht, ist also zum 06.07. 21:00 der
 * EINZIGE noch ungetouchte Kandidat -> wird protected-low. (Und ja, damit erübrigt sich Philips
 * ursprüngliche "Sweep dann Bruch"-Zwischenstufe hier komplett: 1.33286 wird direkt zu protected-low,
 * nicht erst zu einer Zwischenform.)
 */

// Neuer Endzustand nach dem Fix — VERIFIZIERT (siehe test/marketStructureAnalysisProtectedLow.test.js
// + eine echte Kerzen-Simulation gegen test/fixtures/gbpusd-h1-trend.json, reproduziert 1:1):
const protectedLow_fixed: Pivot = { type: "protected-low", price: 1.33286, pivotAt: "06.07.2026 09:00", pivotTime: 1783321200, touched: { price: 1.33286, touchedAt: "08.07.2026 11:00" } };
const pivot8_now_plain_low: Pivot = { ...protectedLow, type: "low" as Pivot["type"] }; // 1.33459, nicht mehr protected
const state1_fixed_at_confirmation: MarketStructureState = {
  trend: "uptrend",
  currRange: { high: { price: 1.33969, type: "high", pivotAt: "06.07.2026 21:00", pivotTime: 1783364400, touched: false }, low: currRangeLow },
  structurePivots: [pivot6, pivot7, pivot8_now_plain_low, protectedLow_fixed],
  innerStructurePivots: [],
  appliedPivots: [],
};

// ZWEITE RUNDE (Philip): "1.33286 muss zum Bestätigungsmoment protected-low sein, UND zum
// Replay-Zeitpunkt 08.07. 23:15 ein 1h LQ-Sweep — das hat bis gerade eben noch funktioniert!" —
// markLqSweeps hatte 'protected-low' explizit von der Neubewertung ausgeschlossen ("anderes
// Konzept", alte Version des Kommentars dort). War falsch: ein protected-low, das seither getoucht
// wurde, aber NIE eine Kerze drunter geschlossen hat, ist strukturell derselbe bestätigte
// Liquidity-Grab wie ein normales 'low' — GEFIXT (siehe markLqSweeps in marketStructureAnalysis.ts,
// Filter jetzt inkl. 'protected-low'), verifiziert per Kerzen-Simulation: 1.33286 wird protected-low
// um 06.07. 21:00 CEST (Bestätigungsmoment) und bereits beim NÄCHSTEN verarbeiteten Pivot (06.07.
// 23:00 CEST) zu 'LQ-sweep' — bleibt das bis 08.07. 23:15. Test siehe
// test/marketStructureAnalysisProtectedLow.test.js ("wird zu 'LQ-sweep', sobald es touched ist,
// aber nie eine Kerze drunter schließt").
const protectedLow_now_lqsweep: Pivot = { ...protectedLow_fixed, type: "LQ-sweep" as Pivot["type"] };

// Endzustand zu Philips aktuellem Replay-Zeitpunkt (08.07. 23:15) — MIT BEIDEN Fixes. Bleibt noch
// die Frage aus der ersten Version dieser Datei offen: 1.33421 (pivot12) und 1.33222 (pivot13) sind
// BEIDE tiefer als 1.33286 UND echte (nicht LQ-sweep-)Lows — der Algo hat aktuell aber gar kein
// protected-low mehr aktiv (1.33286 ist jetzt LQ-sweep, keine andere Reklassifizierung setzt bisher
// ein NEUES protected-low). Ob/wie hier ein neues protected-low nachrücken soll, ist noch offen
// (Frage 1 unten).
const state2_fixed_current: MarketStructureState = {
  trend: "uptrend",
  currRange: { high: currRangeHigh, low: currRangeLow },
  structurePivots: [pivot6, pivot7, pivot8_now_plain_low, protectedLow_now_lqsweep, pivot11, pivot12, pivot13],
  innerStructurePivots: [p2_1_33775, p2_1_34103],
  appliedPivots: [],
};

// OFFENE FRAGEN für Philip (beide Fixes — Auswahl + LQ-sweep-Reklassifizierung — sind live testbar
// per Replay-Modus):
// 1. Zu Philips aktuellem Replay-Zeitpunkt (08.07. 23:15, state2_fixed_current) hat der Algo gerade
//    KEIN aktives protected-low mehr (1.33286 ist jetzt LQ-sweep, kein Ersatz rückt automatisch
//    nach) — obwohl pivot12 (1.33421) und pivot13 (1.33222) danach als ECHTE (nicht LQ-sweep-)
//    tiefere Lows entstanden sind. Soll EINER von denen (oder ein noch späterer Pivot) automatisch
//    zum neuen protected-low werden, sobald kein aktives mehr existiert? Falls ja: nach welcher
//    Regel (wieder "jüngster ungetouchter Kandidat", diesmal aus ALLEN Pivots NACH dem letzten
//    protected-low, nicht nur denen nach currRange.high)?
// 2. trend bleibt aktuell durchgehend 'uptrend', auch ohne aktives protected-low — soll er
//    zwischenzeitlich auf 'unknown' zurückfallen, solange kein protected-low aktiv ist?
// 3. 'broken-protected-low' (für den Fall eines ECHTEN Close-Bruchs, nicht nur Sweep) als eigener
//    Pivot-Typ mit eigener Chart-Darstellung, oder reicht "wird zu 'low', Linie verschwindet"
//    (aktuelles Verhalten, siehe markLqSweeps)?
