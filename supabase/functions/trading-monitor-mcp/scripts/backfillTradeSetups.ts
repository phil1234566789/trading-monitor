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
import { markIgnored } from "../../_shared/ignoredCandles.ts";
import { getSessions } from "../db.ts";
import type { TradingWindows } from "../../_shared/tradingHoursGate.ts";
import { persistTradeSetupSweeps } from "../../_shared/tradeSetupSweeps.ts";
import {
  DEFAULT_TRADE_SETUP_PARAMS,
  type SetupSweep,
} from "../../_shared/tradeSetup.ts";

import { replaySetup1 } from "./setup1Replay.ts";


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
const candleTable = Deno.env.get('BACKFILL_SOURCE') === 'fxcm' ? 'fxcm_candles' : 'forex_candles';
if (candleTable === 'fxcm_candles' && !trockenlauf) throw new Error('FXCM source comparison requires BACKFILL_DRY_RUN=1');
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


async function ladeKerzen(instrument: string, bar: string, vonSec: number, bisSec: number): Promise<Candle[]> {
  const rows = await readForexCandlesArchiveFrom(supabase, instrument, bar, iso(vonSec), iso(bisSec), candleTable);
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
  // Einmal markieren statt je Tick — die Fenster unten sind Slices und tragen das Flag mit.
  // Muss identisch zu poi-watcher sein, sonst laufen Simulation und Produktion auseinander.
  const ignoreSessions = await getSessions(instrument);
  const m5Alle = markIgnored(await ladeKerzen(instrument, "5m", startSec - 7 * 86400, endeSec), ignoreSessions);
  const h1Alle = markIgnored(await ladeKerzen(instrument, "1h", startSec - 200 * 86400, endeSec), ignoreSessions);
  console.log(`${instrument}: ${m5Alle.length} M5-Kerzen, ${h1Alle.length} 1H-Kerzen geladen, Fenster ${fensterVon}-${fensterBis} Min Berlin`);
  if (m5Alle.length === 0) continue;

  const { rows: zeilen, ticks } = replaySetup1({ instrument, m5Alle, h1Alle, startSec, endeSec,
    configuration: { ...DEFAULT_TRADE_SETUP_PARAMS, closeCheckMaxAgeSec }, alarmFenster,
    // Bestehende Backfill-Aufrufe behalten ihre bisherige Zeitsemantik.
    recognitionDelaySec: 0,
  });
  console.log(`${instrument}: ${ticks} Ticks simuliert, ${zeilen.length} Setups gefunden (closeCheckMaxAgeSec=${closeCheckMaxAgeSec})`);
  const htf = zeilen.filter((z) => z.ls_timeframe === "1H").length;
  console.log(`  davon 1H-Sweep: ${htf}, M5-Sweep: ${zeilen.length - htf}`);
  const verteilung = new Map<number, number>();
  for (const z of zeilen) {
    const n = (z.sweeps as unknown[]).length;
    verteilung.set(n, (verteilung.get(n) ?? 0) + 1);
  }
  const mehrfach = zeilen.filter((z) => (z.sweeps as unknown[]).length > 1).length;
  console.log(`  Sweeps je OB: ${[...verteilung.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}x:${c}`).join(" ")}`);
  console.log(`  mit mehr als einem Sweep: ${mehrfach} (${Math.round((mehrfach / zeilen.length) * 100)} %)`);
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
  const schluessel = (direction: unknown, obStartTime: unknown) =>
    `${direction}_${Math.floor(new Date(obStartTime as string).getTime() / 1000)}`;
  for (let i = 0; i < zeilen.length; i += 200) {
    const teil = zeilen.slice(i, i + 200);
    // `sweeps` ist keine Spalte von trade_setups — abtrennen, sonst kippt der Upsert. Die ids
    // kommen zurück, weil die Kindtabelle sie braucht (dieselbe Reihenfolge ist nicht garantiert,
    // deshalb über den natürlichen Schlüssel zugeordnet statt über den Index).
    const { data: geschrieben, error } = await supabase
      .from("trade_setups")
      .upsert(teil.map(({ sweeps: _sweeps, ...zeile }) => zeile), { onConflict: "instrument,direction,ob_start_time" })
      .select("id, direction, ob_start_time");
    if (error) throw error;
    const idJeSchluessel = new Map((geschrieben ?? []).map((r) => [schluessel(r.direction, r.ob_start_time), r.id as number]));
    for (const z of teil) {
      const id = idJeSchluessel.get(schluessel(z.direction, z.ob_start_time));
      if (id != null) await persistTradeSetupSweeps(supabase, id, z.sweeps as SetupSweep[]);
    }
    console.log(`  geschrieben: ${Math.min(i + 200, zeilen.length)}/${zeilen.length}`);
  }
}
