import { strongestSetupSweeps } from './tradeSetup.js';

const toSec = (iso) => Math.floor(new Date(iso).getTime() / 1000);

// Ein gesweeptes Level in der Form, die die Live-Erkennung liefert — sowohl für ls als auch für die
// Kind-Zeilen, damit die Zeichnung DB- und Live-Setups nicht unterscheiden muss.
function sweepLevel(price, pivotTimeIso, touchedTimeIso, dir) {
  const touchedTime = toSec(touchedTimeIso);
  return { price, dir, pivotTime: toSec(pivotTimeIso), touched: true, touchedTime, endTime: touchedTime };
}

// Zurück in dieselbe Form, die detectTradeSetups() (tradeSetup.js) liefert — Zeichnung, Hittest und
// TSC erwarten ein Setup einheitlich so, egal ob live erkannt oder aus der DB gelesen. Exportiert,
// weil fetchTradeSetupForCockpit (tradeIntake.js) dieselbe Umformung braucht.
export function tradeSetupFromRow(row) {
  const dir = row.direction === "short" ? 1 : -1;
  const ls = sweepLevel(row.ls_price, row.ls_pivot_time, row.ls_touched_time, dir);
  // sweeps[0] ist per Vertrag der entscheidende (älteste) Sweep — der steht autoritativ in ls_*,
  // die Kindtabelle liefert nur die übrigen dazu. Zeilen von vor dem 21.09.2026 haben gar keine
  // Kind-Zeilen, dort bleibt der eine Sweep die ganze Liste.
  // Altbestände mit mehr Kind-Zeilen lesend begrenzen, ohne ihre historischen Originale zu löschen.
  const sweeps = strongestSetupSweeps([
    { level: ls, timeframe: row.ls_timeframe ?? "5M" },
    ...(row.trade_setup_sweeps ?? [])
      .filter((sw) => !sw.is_primary)
      .map((sw) => ({ level: sweepLevel(sw.price, sw.pivot_time, sw.touched_time, dir), timeframe: sw.timeframe })),
  ]);
  // Ohne eigenes bestätigtes Fraktal steht in beiden Spalten dasselbe (Path B, siehe
  // detectTradeSetups: `fractal: fractal ?? ls`) — dann dieselbe OBJEKTREFERENZ statt nur derselbe
  // Preis: die Zeichnung entscheidet genau an `fractal !== ls`, ob sie ein zweites "PP"-Label an
  // dieselbe Stelle schreibt (usePriceChartTradeSetupDrawing.js).
  const eigenesFraktal = row.fractal_price !== row.ls_price || row.fractal_pivot_time !== row.ls_pivot_time;
  return {
    instrument: row.instrument,
    source: row.source ?? null,
    detectorVersion: row.detector_version ?? null,
    configHash: row.config_hash ?? null,
    inputSetId: row.input_set_id ?? null,
    dir,
    label: dir === 1 ? "Short" : "Long",
    // Die Historie-Nummerierung existiert nur für die Live-Erkennung (siehe computeTradeSetups) —
    // für gemischte Setups setzt sie diese dort selbst neu.
    setupNumber: null,
    fractal: eigenesFraktal
      ? {
          price: row.fractal_price,
          dir,
          pivotTime: toSec(row.fractal_pivot_time),
          touched: false,
          touchedTime: null,
          // Wann das Fraktal gebrochen ist, steht nicht in der Tabelle -> bis zur letzten geladenen
          // Kerze zeichnen wie eine noch aktive OB-Zone (snapToBarTime deckelt auf das Kerzenende).
          endTime: Infinity,
        }
      : ls,
    ls,
    sweeps,
    obTop: row.ob_top,
    obBottom: row.ob_bottom,
    obStartTime: toSec(row.ob_start_time),
    // Groesse der bestaetigenden FVG in Preiseinheiten, wie sie detectTradeSetups selbst liefert —
    // fehlte hier, wodurch ein aus der DB gelesenes Setup als einziges keine FVG trug. Altzeilen
    // von vor der ob_fvg-Migration haben null.
    obFvg: row.ob_fvg ?? null,
    tradeSetupId: row.id,
    // Rohzeit beibehalten; setup1RecognitionTime berücksichtigt zusätzlich den FVG-Schluss.
    createdAt: row.created_at ? new Date(row.created_at).getTime() / 1000 : null,
    invalidation: row.invalidation ?? null,
    // Nur-DB-Setup = die beiden Erkennungs-Kopien sind auseinandergelaufen. Steht im
    // Debug-Metadaten-Export (debugMetadata.js) und macht den Fall damit nachweisbar, statt ihn
    // still zu verschlucken.
    fromDb: true,
  };
}


// Gegenstück zu tradeSetupFromRow: die Erkennungsfelder einer trade_setups-Zeile (wie poi-watcher sie
// schreibt) plus trade_setup_sweeps. Damit urteilt LS-Reaktion über ein frisch erkanntes Setup (get_data_snapshot)
// mit derselben Funktion wie über eine gespeicherte Zeile (lsReactionRowVerdicts, dob-watcher).
/** @param {any} setup @param {{ id?: any, instrument: string, createdAt?: number | null }} options */
export function tradeSetupToRow(setup, { id = null, instrument, createdAt = null }) {
  const iso = (t) => new Date(t * 1000).toISOString();
  return { id, instrument, direction: setup.dir === 1 ? 'short' : 'long',
    fractal_price: setup.fractal.price, fractal_pivot_time: iso(setup.fractal.pivotTime),
    ls_price: setup.ls.price, ls_pivot_time: iso(setup.ls.pivotTime), ls_touched_time: iso(setup.ls.touchedTime),
    ls_timeframe: setup.sweeps[0].timeframe, ob_top: setup.obTop, ob_bottom: setup.obBottom, ob_fvg: setup.obFvg,
    ob_start_time: iso(setup.obStartTime), ...(createdAt == null ? {} : { created_at: iso(createdAt) }),
    trade_setup_sweeps: strongestSetupSweeps(setup.sweeps).map((sw, i) => ({ price: sw.level.price, timeframe: sw.timeframe,
      is_primary: i === 0, pivot_time: iso(sw.level.pivotTime), touched_time: iso(sw.level.touchedTime) })) };
}
