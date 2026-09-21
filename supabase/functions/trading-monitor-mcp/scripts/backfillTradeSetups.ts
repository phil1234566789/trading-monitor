// Backfill für trade_setups: simuliert poi-watchers Live-Ticks über das Kerzen-Archiv und schreibt
// die dabei erkannten Setups, als hätte der Cron damals schon gelaufen.
//
// Warum überhaupt: die Tabelle entstand erst mit Migration 20260716120000, davor wurde nichts
// persistiert. Jede Auswertung in analysis/dr-reichweite/ hängt deshalb an zwei Monaten (255
// Dealing Ranges), obwohl M5- und 1H-Kerzen für ganz 2026 lückenlos im Archiv liegen.
//
// Der Lauf ist eine ECHTE Simulation, keine Einmal-Erkennung über die ganze Serie: für jede
// M5-Kerze wird derselbe Zustand hergestellt, den poi-watcher zu diesem Zeitpunkt gehabt hätte
// (300 M5-Kerzen, 3000 1H-Kerzen, nowTime = Schluss der aktuellen Kerze), und dieselben zwei
// detectTradeSetup-Aufrufe abgesetzt. Alles andere würde andere Setups finden als der Live-Pfad:
// detectTradeSetup sieht bewusst nur ein rollierendes Fenster.
//
// Drei bewusste Abweichungen vom Live-Pfad, jeweils in die konservative Richtung:
//
// 1. KEIN applyLiveTouch mit dem Live-Preis — den gibt es historisch nicht. Stattdessen werden die
//    1H-Level gegen die M5-Kerzen nachgeprüft (siehe verfeinereTouch unten). Ohne das würde ein
//    Sweep, der um 10:20 passiert, erst mit dem 11:00-Schluss der 1H-Kerze sichtbar — bis zu 60
//    Minuten Verzug, und lsMaxLeadSecH1 ist nur 120 Minuten. Genau die HTF-Setups (das stärkste
//    Qualitätsmerkmal, das wir haben) würden dadurch systematisch verloren gehen.
// 2. `notified: false`, `notified_at: null` — es wurde damals kein Alarm geschickt, also täuscht
//    der Backfill auch keine Alarm-Historie vor. Dasselbe Muster wie backfillObZones.ts.
// 3. `created_at` wird auf den SIMULIERTEN Erkennungszeitpunkt gesetzt, nicht auf jetzt. Sonst
//    filtert get_trade_setups' replayUntilSec (das auf created_at geht) jede Backfill-Zeile aus
//    jedem Backtest heraus — die Zeilen wären für genau den Zweck unbrauchbar, für den sie da sind.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... [BACKFILL_INSTRUMENTS=GBPUSD] \
//     [BACKFILL_FROM=2026-01-05] [BACKFILL_TO=2026-07-16] [BACKFILL_DRY_RUN=1] \
//     deno run --allow-net --allow-env \
//     supabase/functions/trading-monitor-mcp/scripts/backfillTradeSetups.ts
//
// GEMESSENE TREUE (Trockenlauf gegen drei Wochen, für die es Live-Zeilen gibt):
//   03.08. live 36 | simuliert 40 | reproduziert 34 (94 %) | verpasst 2 | extra 6
//   24.08. live 41 | simuliert 40 | reproduziert 40 (98 %) | verpasst 1 | extra 0
//   07.09. live 35 | simuliert 37 | reproduziert 34 (97 %) | verpasst 1 | extra 3
// Zusammen 108 von 112 Live-Setups reproduziert, +8 % zusätzliche. Die Restabweichung ist
// strukturell und nicht wegzubekommen: der Live-Pfad sieht einen Tick-Preis zwischen den
// Kerzenschlüssen und holt seine Kerzen direkt von cTrader statt aus dem Archiv. Für den Zweck --
// die Stichprobe vergrößern -- reicht das; für eine Aussage über einen EINZELNEN historischen
// Tag wäre es zu ungenau.
//
// Idempotent: derselbe onConflict-Schlüssel wie live (instrument,direction,ob_start_time).
// BACKFILL_DRY_RUN=1 schreibt nichts und meldet nur, was gefunden wurde — damit lässt sich der
// Lauf gegen einen Zeitraum prüfen, für den es schon Live-Zeilen gibt (siehe README im
// analysis-Ordner: Abnahme über 16.07.-18.09.).
import { supabase } from "../supabaseClient.ts";
import { readForexCandlesArchiveFrom } from "../../_shared/forexCandlesArchive.ts";
import { detectLiquidityLevels, type LiquidityLevel } from "../../_shared/liquidityDetection.ts";
import { isWithinTradingWindows, type TradingWindows } from "../../_shared/tradingHoursGate.ts";
import {
  detectSetupObs,
  detectTradeSetup,
  DEFAULT_TRADE_SETUP_PARAMS,
  TRADE_SETUP_M5_FRACTAL_PERIOD,
  TRADE_SETUP_H1_FRACTAL_PERIOD,
} from "../../_shared/tradeSetup.ts";

// 1:1 aus poi-watcher/index.ts — die Fenstergrößen bestimmen mit, welche Setups überhaupt
// gefunden werden, jede Abweichung würde den Backfill vom Live-Pfad wegdriften lassen.
const M5_CANDLE_LIMIT = 300;
const H1_LOOKBACK_CANDLES = 3000;

const M5_SEC = 300;
const H1_SEC = 3600;

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const instrumente = (Deno.env.get("BACKFILL_INSTRUMENTS") ?? "GBPUSD").split(",").map((s) => s.trim()).filter(Boolean);
const vonIso = (Deno.env.get("BACKFILL_FROM") ?? "2026-01-05") + "T00:00:00Z";
const bisIso = (Deno.env.get("BACKFILL_TO") ?? "2026-07-16") + "T00:00:00Z";
const trockenlauf = Deno.env.get("BACKFILL_DRY_RUN") === "1";
// Regel 2 aus dem Task "Alarm sobald die FVG steht" (21.09.2026): die Alters-Schwelle des
// Close-Checks ist ein MESSERGEBNIS, kein geratener Wert -- deshalb hier uebersteuerbar, damit
// derselbe Zeitraum mit mehreren Schwellen durchgerechnet und verglichen werden kann.
// "aus" = Check nie, "immer" = Check immer (Verhalten bis 2026-09-21), sonst Stunden als Zahl.
const schwelleRoh = Deno.env.get("BACKFILL_CLOSE_CHECK_MAX_AGE_H");
const closeCheckMaxAgeSec = schwelleRoh == null
  ? DEFAULT_TRADE_SETUP_PARAMS.closeCheckMaxAgeSec
  : schwelleRoh === "immer"
  ? Infinity
  : Number(schwelleRoh) * 3600;

// poi-watcher erkennt NICHT rund um die Uhr: außerhalb des Alarmfensters steigt der Tick mit
// "outside forex fetch window" aus, bevor überhaupt Kerzen geholt werden. Ohne dieselbe Sperre
// findet der Backfill Setups in Stunden, die der bestehende Live-Bestand strukturell gar nicht
// enthält — gemessen an einer Woche im August: 36 Live-Zeilen gegen 60 simulierte, und ALLE 12
// zusätzlichen ab 16:00 UTC lagen in Stunden mit null Live-Zeilen.
//
// Default ist das Fenster, unter dem der BESTEHENDE Bestand (16.07.-18.09.2026) gesammelt wurde:
// 420-1065 Minuten = 07:00-17:45 Berlin. Seit dem 19.09.2026 steht alarm_windows auf 480-1080
// (08:00-18:00) -- neue Zeilen decken die 07:00-Stunde also nicht mehr ab. Für einen in sich
// konsistenten Januar-bis-September-Datensatz zählt das alte Fenster, deshalb steht es hier.
const [fensterVon, fensterBis] = (Deno.env.get("BACKFILL_WINDOW") ?? "420-1065").split("-").map(Number);
const alarmFenster: TradingWindows = { weekday: [[fensterVon, fensterBis]], saturday: [], sunday: [] };

const sek = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const iso = (s: number) => new Date(s * 1000).toISOString();

// Ein 1H-Level gilt als gesweept, sobald eine M5-Kerze es überschreitet — nicht erst mit dem
// Schluss der 1H-Kerze. Ersetzt poi-watchers applyLiveTouch, das dafür den Live-Preis nimmt.
function verfeinereTouch(levels: LiquidityLevel[], richtung: "high" | "low", m5: Candle[], bisSec: number) {
  for (const lvl of levels) {
    if (lvl.touched && lvl.touchedTime != null && lvl.touchedTime <= bisSec) continue;
    for (const c of m5) {
      if (c.time <= lvl.pivotTime || c.time > bisSec) continue;
      if (richtung === "high" ? c.high >= lvl.price : c.low <= lvl.price) {
        lvl.touched = true;
        lvl.touchedTime = c.time;
        break;
      }
    }
  }
}

async function ladeKerzen(instrument: string, bar: string, vonSec: number, bisSec: number): Promise<Candle[]> {
  const rows = await readForexCandlesArchiveFrom(supabase, instrument, bar, iso(vonSec), iso(bisSec));
  return rows.map((r) => ({
    time: typeof r.time === "number" ? r.time : Math.floor(new Date(r.time as string).getTime() / 1000),
    open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume ?? 0,
  })).sort((a, b) => a.time - b.time);
}

for (const instrument of instrumente) {
  const startSec = sek(vonIso);
  const endeSec = sek(bisIso);
  // Vorlauf, damit der erste simulierte Tick dasselbe Fenster sieht wie ein Live-Tick: 300 M5-Kerzen
  // (~25h) und 3000 1H-Kerzen (~125 Handelstage). 7 Tage M5-Vorlauf, nicht 2 -- faengt der Lauf an
  // einem Montag an, liegt dazwischen ein Wochenende ohne Kerzen, und das Fenster waere zu kurz.
  const m5Alle = await ladeKerzen(instrument, "5m", startSec - 7 * 86400, endeSec);
  const h1Alle = await ladeKerzen(instrument, "1h", startSec - 200 * 86400, endeSec);
  console.log(`${instrument}: ${m5Alle.length} M5-Kerzen, ${h1Alle.length} 1H-Kerzen geladen, Fenster ${fensterVon}-${fensterBis} Min Berlin`);
  if (m5Alle.length === 0) continue;

  const gefunden = new Map<string, Record<string, unknown>>();
  let ticks = 0;
  let h1Stunde = -1;
  let h1Highs: LiquidityLevel[] = [];
  let h1Lows: LiquidityLevel[] = [];

  for (let i = 0; i < m5Alle.length; i++) {
    const jetzt = m5Alle[i].time;
    if (jetzt < startSec || jetzt >= endeSec) continue;
    if (!isWithinTradingWindows(jetzt, alarmFenster)) continue;
    const m5Fenster = m5Alle.slice(Math.max(0, i - M5_CANDLE_LIMIT + 1), i + 1);
    // Volles Fenster verlangen, kein angebrochenes: mit weniger Kerzen sehen die M5-Level weniger
    // Historie und gelten faelschlich als unberuehrt -- der Lauf fand dadurch am ersten Tag Setups,
    // die live nie entstanden sind.
    if (m5Fenster.length < M5_CANDLE_LIMIT) continue;
    ticks++;

    // 1H-Level nur bei Stundenwechsel neu erkennen — sie können sich innerhalb einer Stunde nicht
    // ändern, und detectLiquidityLevels über 3000 Kerzen bei jedem 5-Minuten-Tick wäre 12x Arbeit
    // für dasselbe Ergebnis. Der Touch wird trotzdem jeden Tick nachgezogen (siehe unten).
    const stunde = Math.floor(jetzt / H1_SEC);
    if (stunde !== h1Stunde) {
      h1Stunde = stunde;
      const h1Fenster = h1Alle.filter((c) => c.time + H1_SEC <= jetzt).slice(-H1_LOOKBACK_CANDLES);
      const erkannt = detectLiquidityLevels(h1Fenster, TRADE_SETUP_H1_FRACTAL_PERIOD);
      h1Highs = erkannt.highs;
      h1Lows = erkannt.lows;
    }
    verfeinereTouch(h1Highs, "high", m5Fenster, jetzt);
    verfeinereTouch(h1Lows, "low", m5Fenster, jetzt);

    const { highs: m5Highs, lows: m5Lows } = detectLiquidityLevels(m5Fenster, TRADE_SETUP_M5_FRACTAL_PERIOD);
    const setupObs = detectSetupObs(m5Fenster);
    const params = { ...DEFAULT_TRADE_SETUP_PARAMS, closeCheckMaxAgeSec, nowTime: jetzt };

    for (const [dir, m5Lvl, h1Lvl] of [
      [1, m5Highs, h1Highs] as const,
      [-1, m5Lows, h1Lows] as const,
    ]) {
      const setup = detectTradeSetup(dir, m5Lvl, h1Lvl, m5Lvl, setupObs, params, m5Fenster);
      if (!setup) continue;
      const direction = setup.dir === 1 ? "short" : "long";
      const key = `${direction}_${setup.obStartTime}`;
      // Erster Fund gewinnt — dieselbe Semantik wie live: poi-watcher/index.ts überspringt einen
      // bereits alarmierten Schlüssel komplett, überschreibt die Zeile also nicht mehr. Gegenprobe
      // mit "letzter gewinnt" gerechnet: der Reichweiten-Median lief noch weiter von den
      // Live-Zeilen weg (16,6 statt 15,2 gegen 12,9).
      // Schlüssel ist der bestätigende OB, nicht fractal_pivot_time — derselbe Unique-Key wie live
      // (instrument,direction,ob_start_time). Mit fractal_pivot_time konnten zwei Ticks dieselbe
      // ob_start_time unter zwei Schlüsseln ablegen, was der Upsert-Batch nicht überlebt.
      if (gefunden.has(key)) continue;
      gefunden.set(key, {
        instrument,
        direction,
        fractal_price: setup.fractal.price,
        fractal_pivot_time: iso(setup.fractal.pivotTime),
        ls_price: setup.ls.price,
        ls_pivot_time: iso(setup.ls.pivotTime),
        ls_touched_time: iso(setup.ls.touchedTime!),
        ls_timeframe: h1Lvl.includes(setup.ls) ? "1H" : "5M",
        ob_top: setup.obTop,
        ob_bottom: setup.obBottom,
        ob_start_time: iso(setup.obStartTime),
        alert_price: m5Fenster[m5Fenster.length - 1].close,
        notified: false,
        notified_at: null,
        created_at: iso(jetzt),
      });
    }
    if (ticks % 5000 === 0) console.log(`  ${ticks} Ticks, ${gefunden.size} Setups bis ${iso(jetzt).slice(0, 16)}`);
  }

  console.log(`${instrument}: ${ticks} Ticks simuliert, ${gefunden.size} Setups gefunden (closeCheckMaxAgeSec=${closeCheckMaxAgeSec})`);
  const zeilen = [...gefunden.values()];
  const htf = zeilen.filter((z) => z.ls_timeframe === "1H").length;
  console.log(`  davon 1H-Sweep: ${htf}, M5-Sweep: ${zeilen.length - htf}`);
  if (trockenlauf) {
    console.log("  TROCKENLAUF — nichts geschrieben.");
    const ziel = Deno.env.get("BACKFILL_DUMP");
    if (ziel) {
      await Deno.writeTextFile(ziel, JSON.stringify(zeilen, null, 1));
      console.log(`  Fundliste nach ${ziel} geschrieben — für den Abgleich gegen die Live-Zeilen.`);
    }
    continue;
  }

  // ob_zones-Referenz je Setup anlegen (wie live), dann die Setup-Zeilen schreiben.
  for (const z of zeilen) {
    const { data: zone, error: zoneError } = await supabase
      .from("ob_zones")
      .upsert(
        {
          instrument,
          timeframe: "5M",
          direction: z.direction,
          top: z.ob_top,
          bottom: z.ob_bottom,
          start_time: z.ob_start_time,
        },
        { onConflict: "instrument,timeframe,start_time,direction" },
      )
      .select("id")
      .single();
    if (zoneError) throw zoneError;
    z.ob_zone_id = zone.id;
  }
  for (let i = 0; i < zeilen.length; i += 200) {
    const { error } = await supabase
      .from("trade_setups")
      .upsert(zeilen.slice(i, i + 200), { onConflict: "instrument,direction,ob_start_time" });
    if (error) throw error;
    console.log(`  geschrieben: ${Math.min(i + 200, zeilen.length)}/${zeilen.length}`);
  }
}
