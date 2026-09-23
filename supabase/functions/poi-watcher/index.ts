// 4H/1H-Zonen und M5-Setups aus geschlossenen FXCM-Bid-Kerzen.
// Alarmfenster und Telegram-Schalter bleiben in der Datenbank konfiguriert.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { detectOrderBlocks, type Candle } from "../_shared/orderBlocks.ts";
import { detectLiquidityLevels, type LiquidityLevel } from "../_shared/liquidity.ts";
import { unprocessedTimeframes } from "./fxcmRefresh.js";
import { fetchAllRows } from "../_shared/fetchAllRows.ts";
import { readFxcmCandles } from "../_shared/fxcmCandles.ts";
import {
  detectSetupObs,
  detectTradeSetup,
  TRADE_SETUP_M5_FRACTAL_PERIOD,
  TRADE_SETUP_H1_FRACTAL_PERIOD,
  DEFAULT_TRADE_SETUP_PARAMS,
} from "../_shared/tradeSetup.ts";
import { computeSweepAgeHours } from "../_shared/ageTier.ts";
import { persistTradeSetupSweeps } from "../_shared/tradeSetupSweeps.ts";
import { forbiddenSessionAt, type SessionDangerConfig } from "../_shared/forbiddenSession.ts";
import {
  findLevelTouch,
  findZoneTouch,
  LIVE_TOUCH_WINDOW_SEC,
  levelTouchPrice,
  recentCandles,
  zoneTouchPrice,
} from "./liveTouch.ts";

const TIMEFRAMES: { label: "4H" | "1H" }[] = [{ label: "4H" }, { label: "1H" }];
// 300h (~12,5 Tage) reichten nicht, um lange unberührte 1H-Liquiditäts-Level (und 1H-OB-Zonen, die
// denselben Kerzensatz mitnutzen) im Blick zu behalten — Philip tradet von Ziel zu Ziel und
// braucht dafür ein paar unberührte Level ober-/unterhalb des Kurses, auch wenn die schon
// Wochen/Monate alt sind. Bug-Report 2026-08-02: ein 45 Tage alter, nie erneut erkannter Pivot
// (1,15297, 18.06.) fehlte deshalb komplett in liquidity_levels. 3000h (~125 Tage) statt 300h —
const FOREX_H1_LOOKBACK_CANDLES = 3000;
// Bug-Report Philip 2026-08-23: eine 4H-OB-Zone vom 12.05. (start_time außerhalb des alten
// CANDLE_LIMIT=300-Fensters, ~50 Tage) wurde real getouched+invalidated (Kerzen-Vollarchiv-
// Neuberechnung bestätigt: 19.08. ~13:00 UTC), blieb in der DB aber für immer touched=false —
// derselbe Fensterblindfleck wie oben bei FOREX_H1_LOOKBACK_CANDLES, nur diesmal beim 4H-Fetch, der
// bis dahin bei den alten 300 Kerzen (~50 Tage) belassen wurde. Auf dieselbe Größenordnung wie 1H
// angehoben (3000 4H-Kerzen = ~500 Tage) — das Archiv liefert die geschlossenen Kerzen ohne
// zusätzlichen Broker-Abruf.
const FOREX_H4_LOOKBACK_CANDLES = 3000;
const LIQUIDITY_FRACTAL_PERIOD = 5; // siehe LIQUIDITY_FRACTAL_PERIOD in PriceChart.vue

// Trade-Setup-Tuning-Parameter (Liquidity Sweep + Protected M5-Fraktal + M5-OB) jetzt in
// _shared/tradeSetup.ts (DEFAULT_TRADE_SETUP_PARAMS/TRADE_SETUP_M5_FRACTAL_PERIOD/
// TRADE_SETUP_H1_FRACTAL_PERIOD) — dieselben Werte, die get_data_snapshot (trading-monitor-mcp)
// für die Live-Erkennung braucht, DRY statt zweiter Kopie (Task "Live-Trade-Setup-Erkennung
// serverseitig für Lana", 2026-09-05).
const TRADE_SETUP_M5_CANDLE_LIMIT = 300; // ~25h M5-Historie, deutlich mehr als der Lookback (siehe DEFAULT_TRADE_SETUP_PARAMS.maxLookbackSec)

// Explizit typisiert statt auf die select-String-Typinferenz von supabase-js zu vertrauen —
// die kollabiert bei einem untypisierten Client (kein Database-Generic bei createClient) ab
// einer gewissen Spaltenzahl im select() auf `{}` (siehe Chat 2026-07-23: TS-Fehler beim
// Erweitern um top/bottom/invalidated).
interface ObZoneRow {
  start_time: string;
  direction: string;
  touched: boolean;
  notified: boolean;
  notified_at: string | null;
  alert_price: number | null;
  top: number;
  bottom: number;
  invalidated: boolean;
}

interface LiquidityLevelRow {
  pivot_time: string;
  direction: string;
  price: number;
  touched: boolean;
  notified: boolean;
  notified_at: string | null;
  end_time: string | null;
  alert_price: number | null;
}

interface InstrumentConfig {
  instrument: string;
  sendTelegram: boolean;
  pricePrecision: number;
}

// Pin-Touch-Alarm (siehe resolvePinTouch/Deno.serve unten) — explizit typisiert wie ObZoneRow/
// LiquidityLevelRow oben, gleicher Grund (PostgREST-Embed-Typinferenz kollabiert sonst auf `{}`).
// Die drei Embeds sind je nach `kind` gesetzt, sonst null (PostgREST liefert null fürs nicht
// zutreffende Embed, kein zusätzlicher Filter nötig — gleiches Muster wie trading-monitor-mcp/
// db.ts: getPinContext).
interface PinAlarmRow {
  id: number;
  kind: string;
  note: string | null;
  m5_liquidity_instrument: string | null;
  m5_liquidity_direction: string | null;
  m5_liquidity_price: number | null;
  ob_zones: { instrument: string; timeframe: string; direction: string; top: number; bottom: number; touched: boolean; invalidated: boolean } | null;
  liquidity_levels: { instrument: string; timeframe: string; direction: string; price: number; touched: boolean } | null;
  trade_setups: { instrument: string; direction: string; ob_top: number; ob_bottom: number } | null;
}

interface PinTouchHit {
  instrument: string;
  message: string;
}

// EURUSD bleibt in der Liste (Erkennung/Persistierung läuft weiter, damit die Historie für eine
// spätere Auswertung nicht abreißt), schickt aber keine Telegram-Alarme mehr — Philip handelt
// zurzeit nur GBPUSD. Zum Reaktivieren genügt sendTelegram: true.
const INSTRUMENTS: InstrumentConfig[] = [
  { instrument: "GBPUSD", sendTelegram: true, pricePrecision: 5 },
  { instrument: "EURUSD", sendTelegram: false, pricePrecision: 5 },
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const DRY_RUN = (Deno.env.get("DRY_RUN") ?? "false").toLowerCase() === "true";
// FXCM-H4 folgt dem New-York-Handelstag. Archiv-Lesen pro Tick vermeidet
// starre UTC-Grenzen und verpasst auch verspätet eingetroffene Kerzen nicht.
async function fetchForexBatch(
  db: SupabaseClient, symbol: string,
): Promise<{ currentPrice: number; candlesByTf: Map<string, Candle[]> }> {
  const specs = [
    { key: "M5", period: "5m", count: TRADE_SETUP_M5_CANDLE_LIMIT },
    { key: "1H", period: "1h", count: FOREX_H1_LOOKBACK_CANDLES },
    { key: "4H", period: "4h", count: FOREX_H4_LOOKBACK_CANDLES },
  ];
  const results = await Promise.all(specs.map(s => readFxcmCandles(db, symbol, s.period, s.count)));
  if (results.some(rows => !rows.length)) throw new Error(`FXCM history missing: ${symbol}`);
  const latest = results[0][results[0].length - 1];
  // An LIVE_TOUCH_WINDOW_SEC gekoppelt, nicht zufaellig gleich: haengt der Feed weiter zurueck als
  // das Touch-Fenster reicht, faellt jede geladene Kerze aus dem Fenster und recentCandles liefert
  // leer — der Lauf pruefte dann still ueberhaupt keinen Touch mehr. Lieber laut abbrechen.
  if (Date.now() / 1000 - latest.time > LIVE_TOUCH_WINDOW_SEC) throw new Error(`FXCM M5 feed stale: ${symbol}`);
  return { currentPrice: latest.close, candlesByTf: new Map(specs.map((s, i) => [s.key, results[i]])) };
}

async function sendTelegram(text: string) {
  if (DRY_RUN) {
    console.log("[DRY_RUN] Telegram-Nachricht (nicht gesendet):", text);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });
  if (!res.ok) console.error("Telegram send failed:", await res.text());
}

function fmt(n: number, precision: number) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: precision });
}

// Prüft, ob eine gepinnte Stelle gerade vom Preis erreicht ist — null, wenn (a) noch nicht
// getroffen, oder (b) das zugehörige Instrument diesen Tick nicht gefetcht wurde (siehe
// currentPriceByInstrument-Kommentar im Deno.serve-Handler). Für ob_zone/liquidity_level liest
// das einfach die JETZT (im Haupt-Loop oben) frisch upgeserteten touched-Flags der referenzierten
// Zeile — kein zweites detectOrderBlocks/detectLiquidityLevels nötig. trade_setup hat selbst
// keine touched-Spalte; "getroffen" bedeutet hier Preis zurück im M5-Entry-OB (ob_top/ob_bottom)
// — der eigentliche Trade-Trigger, nicht ls_touched_time (das ist längst wahr, sobald das Setup
// überhaupt erkannt wurde, sonst gäbe es die Zeile nicht). m5_liquidity_level ist ein reiner
// Rohdaten-Snapshot ohne DB-Live-Status — hier direkter Preisvergleich gegen die beim Pinnen
// eingefrorenen Grenzen.
function resolvePinTouch(row: PinAlarmRow, currentPriceByInstrument: Record<string, number>): PinTouchHit | null {
  const precisionFor = (instrument: string) => INSTRUMENTS.find((i) => i.instrument === instrument)?.pricePrecision ?? 2;

  if (row.kind === "ob_zone" && row.ob_zones) {
    const z = row.ob_zones;
    const price = currentPriceByInstrument[z.instrument];
    if (price == null) return null;
    const label = z.direction === "long" ? "Bullish" : "Bearish";
    const p = precisionFor(z.instrument);
    // M5-ob_zones-Zeilen sind reine, beim Pinnen einmalig persistierte Snapshots (Task
    // "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 6) — anders als 1H/4H
    // erkennt/aktualisiert poi-watcher touched/invalidated für sie nie live (M5 bleibt bewusst
    // Live-Recompute fürs Indikator-Overlay, siehe PLAN-chart-objekte-forex.md Abschnitt 5), daher
    // hier derselbe direkte Preis-Grenzen-Vergleich wie vorher bei kind='m5_ob'. Für 1H/4H bleibt
    // der bestehende touched/invalidated-Weg.
    if (z.timeframe === "5M") {
      if (price > z.top || price < z.bottom) return null;
      return {
        instrument: z.instrument,
        message: `📌 ${z.instrument} M5-OB (${label}, gepinnt) erreicht\nZone: ${fmt(z.bottom, p)} – ${fmt(z.top, p)}\nPreis: ${fmt(price, p)}`,
      };
    }
    if (!z.touched || z.invalidated) return null;
    return {
      instrument: z.instrument,
      message: `📌 ${z.instrument} ${z.timeframe} ${label} OB (gepinnt) erreicht\nZone: ${fmt(z.bottom, p)} – ${fmt(z.top, p)}\nPreis: ${fmt(price, p)}`,
    };
  }
  if (row.kind === "liquidity_level" && row.liquidity_levels) {
    const l = row.liquidity_levels;
    const price = currentPriceByInstrument[l.instrument];
    if (price == null || !l.touched) return null;
    const label = l.direction === "high" ? "Hoch" : "Tief";
    const p = precisionFor(l.instrument);
    return {
      instrument: l.instrument,
      message: `📌 ${l.instrument} ${l.timeframe} Liquiditäts-Level (${label}, gepinnt) angetestet\nLevel: ${fmt(l.price, p)}\nPreis: ${fmt(price, p)}`,
    };
  }
  if (row.kind === "trade_setup" && row.trade_setups) {
    const s = row.trade_setups;
    const price = currentPriceByInstrument[s.instrument];
    if (price == null || price > s.ob_top || price < s.ob_bottom) return null;
    const label = s.direction === "short" ? "Short" : "Long";
    const p = precisionFor(s.instrument);
    return {
      instrument: s.instrument,
      message: `📌 ${s.instrument} Trade-Setup (${label}, gepinnt): Preis im M5-Entry-OB\nM5-OB: ${fmt(s.ob_bottom, p)} – ${fmt(s.ob_top, p)}\nPreis: ${fmt(price, p)}`,
    };
  }
  if (row.kind === "m5_liquidity_level" && row.m5_liquidity_instrument != null) {
    const price = currentPriceByInstrument[row.m5_liquidity_instrument];
    if (price == null) return null;
    const touched = row.m5_liquidity_direction === "high" ? price >= row.m5_liquidity_price! : price <= row.m5_liquidity_price!;
    if (!touched) return null;
    const label = row.m5_liquidity_direction === "high" ? "Hoch" : "Tief";
    const p = precisionFor(row.m5_liquidity_instrument);
    return {
      instrument: row.m5_liquidity_instrument,
      message: `📌 ${row.m5_liquidity_instrument} Liquiditäts-Level (${label}, gepinnt) angetestet\nLevel: ${fmt(row.m5_liquidity_price!, p)}\nPreis: ${fmt(price, p)}`,
    };
  }
  return null;
}

// Handelszeiten/Alarmfenster kommen seit 2026-07-25 pro Instrument aus `trading_schedules`
// (Dashboard-Seite "Handelszeiten") statt aus einem einzigen festen 8:00-17:30-Fenster — Auslöser
// war ein Telegram-Alarm an einem SAMSTAG (Bug-Report Philip): die alte isTradingHours() prüfte
// nur die Uhrzeit, nie den Wochentag, und Twelve Data liefert auch am Wochenende weiter Candles.
// Format je Zeile: {"weekday": [[fromMin,toMin], ...], "saturday": [...], "sunday": [...]}
// (Minuten seit Mitternacht, lokale Zeit).
type WindowPair = [number, number];
type WeekdayWindows = { weekday: WindowPair[]; saturday: WindowPair[]; sunday: WindowPair[] };

function localMinutesAndWeekday(date: Date): { minutesSinceMidnight: number; group: keyof WeekdayWindows } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  const weekday = parts.find((p) => p.type === "weekday")!.value; // "Mon".."Sun"
  const group: keyof WeekdayWindows = weekday === "Sat" ? "saturday" : weekday === "Sun" ? "sunday" : "weekday";
  return { minutesSinceMidnight: hour * 60 + minute, group };
}

function isInWindows(
  date: Date, windows: WeekdayWindows | undefined, startBufferMin = 0, endBufferMin = 0,
): boolean {
  if (!windows) return false;
  const { minutesSinceMidnight, group } = localMinutesAndWeekday(date);
  return windows[group].some(([from, to]) =>
    minutesSinceMidnight >= from - startBufferMin && minutesSinceMidnight < to + endBufferMin);
}

// Nachts/am Wochenende (außerhalb des Alarmfensters) werden fürs Forex-Zonen-Fetching keine
// Requests gebraucht (Philip schläft bzw. tradet nicht, kein Alarm bringt was) — spart unnötige
// Archiv-Abfragen (ursprünglich gegen Twelve Datas Free-Tier-Rate-Limit gedacht, 800/Tag,
// 8/Min; bleibt aber auch ohne dieses Limit sinnvoll, um außerhalb der Handelszeiten keine
// Zonen-Erkennung/DB-Schreibvorgänge zu verursachen, die eh niemand ansieht). FETCH_START_BUFFER_MIN
// Minuten VOR Fensterstart schon wieder
// holen (nicht erst exakt zum Fensterbeginn) — ein einziger Lauf davor reicht, um über Nacht
// liegengebliebene Touches noch außerhalb des Fensters (shouldSend=false) still nachzuholen,
// damit beim tatsächlichen Fensterstart kein Nachhol-Alarm-Schwall für längst vergangene Touches
// losgeht (gleicher Grund wie beim früheren 24/7-Cron, nur jetzt auf ein kurzes Vorlauf-Fenster
// verkürzt).
const FETCH_START_BUFFER_MIN = 10;
// Gegenstueck am Fensterende: die letzte 1H-Kerze des Fensters SCHLIESST erst zur Fenstergrenze
// (17:00-Kerze bei Fensterende 18:00) — ohne Nachlauf sah kein Lauf sie je, ihre OB-Zonen tauchten
// erst am naechsten Morgen auf. Wie der Vorlauf nur fuers Fetchen/Persistieren; shouldSend prueft
// weiterhin ungepuffert, es geht also kein Telegram nach Fensterende raus.
const FETCH_END_BUFFER_MIN = 10;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Wartungsaufruf darf auch außerhalb des normalen Auswertungsfensters laufen.
    let forceH1Refresh = false;
    try {
      const body = await req.json();
      forceH1Refresh = body?.forceH1Refresh === true;
    } catch {
      // Kein/kein valides JSON-Body (regulärer Cron-Aufruf mit leerem Body) — kein Fehler, einfach false.
    }

    // Ein/Aus-Schalter je Alarm-Typ (siehe "Alarme"-Seite im Dashboard) — steuert NUR den
    // Telegram-Versand, nie die Erkennung/Persistierung selbst (siehe Kommentare unten an den
    // einzelnen shouldSend-Stellen). Fail-open (fehlende Zeile = an), falls die Migration mal
    // hinter einem neuen Key zurückhängt — ein stiller Alarm-Ausfall wäre schlimmer als ein
    // ungewollter Alarm.
    const { data: alarmRows, error: alarmSelectError } = await supabase.from("alarm_settings").select("key, enabled");
    if (alarmSelectError) throw alarmSelectError;
    const alarmEnabledMap = new Map((alarmRows ?? []).map((r) => [r.key, r.enabled]));
    const isAlarmOn = (key: string) => alarmEnabledMap.get(key) ?? true;

    // Handelszeiten/Alarmfenster je Instrument (siehe "Handelszeiten"-Seite im Dashboard) — fail-
    // closed bei fehlender Zeile (leere Windows), anders als bei alarm_settings: ein Instrument
    // ohne Schedule-Zeile hier zu bevorzugt-an zu setzen würde denselben Wochenend-Alarm-Bug
    // riskieren, den diese Tabelle gerade beheben soll.
    const { data: scheduleRows, error: scheduleSelectError } = await supabase
      .from("trading_schedules")
      .select("instrument, alarm_windows, trading_windows");
    if (scheduleSelectError) throw scheduleSelectError;
    const alarmWindowsByInstrument = new Map<string, WeekdayWindows>(
      (scheduleRows ?? []).map((r) => [r.instrument, r.alarm_windows as WeekdayWindows]),
    );
    // Chart-Sessions (Sessions-Modal), nur fürs Trade-Setup-Alarm-Gating unten gebraucht: der
    // Chart versteckt Setups, deren M5-OB in einer 'forbidden'-Session entstanden ist, poi-watcher
    // alarmierte sie bis 09/2026 trotzdem. Ein Select für alle Instrumente, wie bei den Schedules.
    const { data: sessionRows, error: sessionSelectError } = await supabase
      .from("sessions")
      .select("instrument, label, from_minutes, to_minutes, danger, days")
      .eq("danger", "forbidden");
    if (sessionSelectError) throw sessionSelectError;
    const forbiddenSessionsByInstrument = new Map<string, SessionDangerConfig[]>();
    for (const r of sessionRows ?? []) {
      const list = forbiddenSessionsByInstrument.get(r.instrument as string) ?? [];
      list.push({
        label: r.label as string | null,
        fromMinutes: r.from_minutes as number,
        toMinutes: r.to_minutes as number,
        danger: r.danger as string | null,
        days: r.days as number[] | null,
      });
      forbiddenSessionsByInstrument.set(r.instrument as string, list);
    }
    const now = new Date();
    const summary: Record<string, unknown> = { dryRun: DRY_RUN, instruments: {} };
    // Für den Pin-Touch-Alarm-Durchlauf ganz unten (nach diesem Loop) — der braucht pro Instrument
    // den aktuellen Preis UND das Alarm-Gating, hat aber selbst keinen eigenen Fetch (reine
    // Nachlese auf dem, was hier oben ohnehin schon geholt/berechnet wurde). Bleibt für ein
    // Instrument leer, wenn dieser Tick es übersprungen hat (außerhalb des Forex-Fetch-Fensters,
    // siehe forexFetchWindow-Check unten) — dann kann für M5-OB/M5-Liquidity-Pins in diesem Lauf
    // kein frischer Preis-Vergleich stattfinden, der nächste Lauf im Fenster holt das nach
    // (gleiches Throttling-Prinzip wie der Rest dieser Datei).
    const currentPriceByInstrument: Record<string, number> = {};
    const shouldSendByInstrument: Record<string, boolean> = {};

    for (const cfg of INSTRUMENTS) {
      const alarmWindows = alarmWindowsByInstrument.get(cfg.instrument);
      const forexFetchWindow = isInWindows(now, alarmWindows, FETCH_START_BUFFER_MIN, FETCH_END_BUFFER_MIN);
      if (!forexFetchWindow && !forceH1Refresh) {
        (summary.instruments as Record<string, unknown>)[cfg.instrument] = { skipped: "outside forex fetch window" };
        continue;
      }
      const forexBatch = await fetchForexBatch(supabase, cfg.instrument);
      const h1CandlesForSetup = forexBatch.candlesByTf.get("1H")!;
      const h4LastTime = forexBatch.candlesByTf.get("4H")!.at(-1)!.time;
      const { data: checkpoint, error: checkpointError } = await supabase.from("forex_h1_cache")
        .select("candles,h4_last_time").eq("instrument", cfg.instrument).maybeSingle();
      if (checkpointError) throw checkpointError;
      forexBatch.candlesByTf = unprocessedTimeframes(forexBatch.candlesByTf, {
        "1H": (checkpoint?.candles as Candle[] | undefined)?.at(-1)?.time,
        "4H": checkpoint?.h4_last_time,
      });
      const currentPrice = forexBatch.currentPrice;
      // Touch-Fenster für die 1H/4H-Objekte weiter unten (siehe liveTouch.ts): dieselben
      // M5-Kerzen, die ohnehin für die Trade-Setup-Erkennung geladen werden.
      const recentM5 = recentCandles(
        forexBatch.candlesByTf.get("M5")!,
        Math.floor(now.getTime() / 1000),
      );
      // Zonen werden für jedes Instrument immer erkannt/gespeichert (Dashboard-Charts brauchen
      // das weiterhin) — `shouldSend` entscheidet nur, ob dafür auch wirklich eine
      // Telegram-Nachricht rausgeht (nur innerhalb des Alarmfensters aus trading_schedules,
      // siehe oben).
      const shouldSend = cfg.sendTelegram && isInWindows(now, alarmWindows);
      currentPriceByInstrument[cfg.instrument] = currentPrice;
      shouldSendByInstrument[cfg.instrument] = shouldSend;
      const instrumentSummary: Record<string, unknown> = {};

      for (const tf of TIMEFRAMES) {
        // z.B. "ob_zone_4h"/"ob_zone_1h" — je Timeframe einzeln umschaltbar.
        const alarmActive = shouldSend && isAlarmOn(`ob_zone_${tf.label.toLowerCase()}`);
        const candles = forexBatch.candlesByTf.get(tf.label);

        const existingRows = await fetchAllRows<ObZoneRow>((from, to) => supabase
          .from("ob_zones")
          .select("start_time, direction, touched, notified, notified_at, alert_price, top, bottom, invalidated")
          .eq("instrument", cfg.instrument)
          .eq("timeframe", tf.label)
          .order("id").range(from, to).returns<ObZoneRow[]>());

        let notifiedCount = 0;

        if (candles) {
          // Voller Durchlauf: Zonen frisch aus den Kerzen erkennen (structural touched/
          // invalidated ändert sich nur, wenn neue Kerzen dazukommen) und mit dem DB-Stand
          // mergen. Beide Timeframes werden aus dem aktuellen FXCM-Archiv gelesen.
          // tf.label ("4H"/"1H") explizit mitgeben statt implizit undefined (Chat 2026-07-29) —
          // beides bleibt HTF-Verhalten (nur "1m"/"3m"/"5m" gelten als Lower-TF), aber so ist
          // derselbe Aufrufer-Stil wie bei detectSetupObs (immer explizites Timeframe-Label).
          const zones = detectOrderBlocks(candles, tf.label);
          const existingMap = new Map(
            (existingRows ?? []).map((r) => [
              `${r.direction}_${Math.floor(new Date(r.start_time).getTime() / 1000)}`,
              r,
            ]),
          );

          const pendingRows: Record<string, unknown>[] = [];
          const pendingAlerts: string[] = [];
          for (const z of zones) {
            const direction = z.dir === 1 ? "long" : "short";
            const existing = existingMap.get(`${direction}_${z.startTime}`);
            const wasTouchedInDb = existing?.touched ?? false;

            // Live-Touch aus den M5-Kerzen: FXCM liefert nur geschlossene Kerzen, ohne das
            // hier wuerde ein Touch erst beim Schluss der vollen 1H/4H-Kerze erkannt (bis zu
            // 59min Verzoegerung). Gegen die Kerzen statt gegen den Tick-Preis, weil ein Docht
            // zwischen zwei Ticks sonst komplett durchrutscht (siehe liveTouch.ts).
            // Einmal getouched bleibt getouched (auch wenn detectOrderBlocks() die noch offene
            // Kerze dementsprechend noch nicht sieht) — sonst faellt der Wert beim naechsten Run
            // auf false zurueck und der Alarm geht beim echten Kerzenschluss ein zweites Mal raus.
            // wasTouchedInDb bewusst OHNE !z.invalidated-Guard (Bug-Report Philip: eine
            // getouchte, danach durchbrochene Zone fiel beim naechsten Refresh-Tick auf
            // touched=false zurueck — Telegram-Alarm raus, aber im /protokoll unsichtbar, weil
            // fetchTouchedZones auf touched=true filtert). Nur ein NEUER Live-Touch setzt
            // eine bereits invalidierte Zone nicht mehr auf touched.
            const liveHit = z.touched || z.invalidated ? null : findZoneTouch(recentM5, z.top, z.bottom);
            if (!z.touched && (wasTouchedInDb || liveHit)) {
              z.touched = true;
            }

            const justTouched = z.touched && !wasTouchedInDb;
            const alertPrice = liveHit ? zoneTouchPrice(liveHit, z.top, z.bottom) : currentPrice;

            pendingRows.push(
              {
                instrument: cfg.instrument,
                timeframe: tf.label,
                direction,
                top: z.top,
                bottom: z.bottom,
                touched: z.touched,
                invalidated: z.invalidated,
                // Retest bestätigt (Feature Philip 05.09.2026, siehe orderblöcke.md#retest-status)
                // — für 1H/4H: eine spätere Kerze derselben TF schließt komplett außerhalb der Zone.
                retested: z.retested,
                start_time: new Date(z.startTime * 1000).toISOString(),
                // end_time kommt direkt aus der Zonen-Erkennung: waechst mit jeder Kerze, bis die
                // Zone touched/invalidated ist, dann friert es automatisch ein (siehe
                // detectOrderBlocks in _shared/orderBlocks.ts) — deterministisch aus der
                // Kerzenhistorie, keine eigene Wanduhr-Bookkeeping noetig.
                end_time: new Date(z.endTime * 1000).toISOString(),
                // alert_price: der Preis im Moment des Touches, einmal eingefroren (wie
                // end_time) — unabhaengig davon, ob dafuer auch wirklich eine TG-Nachricht
                // rausging (alarmActive/Session steuern nur notified_at, nicht diesen Wert).
                alert_price: justTouched ? alertPrice : existing?.alert_price ?? null,
                notified: existing ? existing.notified || justTouched : z.touched,
                // notified_at nur bei einem echten Versand setzen (existing muss vorhanden sein,
                // sonst ist es ein historischer Alt-Touch ohne echten Alarm) — sonst würde ein
                // beim Deploy schon getouchtes Alt-Zone-Backlog faelschlich den Deploy-Zeitpunkt
                // als "gerade eben benachrichtigt" zeigen.
                notified_at: justTouched && existing && alarmActive ? new Date().toISOString() : existing?.notified_at ?? null,
              },
            );

            // Bei brandneuen Zonen (kein `existing`), die schon beim ersten Erkennen touched
            // sind, nicht alarmieren — das waere ein historischer Alt-Touch, kein "jetzt gerade".
            if (justTouched && existing && alarmActive) {
              notifiedCount++;
              const label = direction === "long" ? "Bullish" : "Bearish";
              pendingAlerts.push(
                `📍 ${cfg.instrument} ${tf.label} ${label} OB erreicht\n` +
                  `Zone: ${fmt(z.bottom, cfg.pricePrecision)} – ${fmt(z.top, cfg.pricePrecision)}\n` +
                  `Preis: ${fmt(alertPrice, cfg.pricePrecision)}`,
              );
            }
          }

          // Ein gemeinsamer Schreibzugriff statt hunderter HTTP-Roundtrips pro Zeitrahmen.
          // Nachrichten erst nach erfolgreicher Speicherung senden.
          if (pendingRows.length) {
            const { error } = await supabase.from("ob_zones").upsert(pendingRows, { onConflict: "instrument,timeframe,start_time,direction" });
            if (error) throw error;
          }
          for (const message of pendingAlerts) await sendTelegram(message);

          // Bug-Report Philip 2026-08-23 (analog zum liquidity_levels-Fix weiter unten): eine Zone,
          // deren start_time außerhalb des gerade geholten Kerzenfensters liegt, taucht in `zones`
          // gar nicht erst auf und wurde vom Loop oben nie wieder angefasst — für immer eingefroren,
          // selbst wenn der Preis sie inzwischen längst berührt hat. Dasselbe M5-Kerzen-Sicherheitsnetz
          // wie im "else"-Zweig unten, hier zusätzlich auch an einem Refresh-Tick, nicht nur an einem
          // Skip-Tick. Kein Ersatz für die volle Kerzenhistorie (ein Touch, der länger als
          // LIVE_TOUCH_WINDOW_SEC zurückliegt, braucht weiterhin die einmalige Archiv-Korrektur,
          // siehe backfillObZones.ts), aber besser als "nie wieder geprüft".
          const zoneKeysInWindow = new Set(zones.map((z) => `${z.dir === 1 ? "long" : "short"}_${z.startTime}`));
          for (const row of existingRows ?? []) {
            if (row.invalidated || row.touched) continue;
            const rowStartSec = Math.floor(new Date(row.start_time).getTime() / 1000);
            if (zoneKeysInWindow.has(`${row.direction}_${rowStartSec}`)) continue;
            const hit = findZoneTouch(recentM5, row.top, row.bottom);
            if (!hit) continue;
            const alertPrice = zoneTouchPrice(hit, row.top, row.bottom);

            const { error: updateOffWindowError } = await supabase
              .from("ob_zones")
              .update({
                touched: true,
                notified: true,
                alert_price: alertPrice,
                notified_at: alarmActive ? new Date().toISOString() : row.notified_at ?? null,
              })
              .eq("instrument", cfg.instrument)
              .eq("timeframe", tf.label)
              .eq("direction", row.direction)
              .eq("start_time", row.start_time);
            if (updateOffWindowError) throw updateOffWindowError;

            if (alarmActive) {
              notifiedCount++;
              const label = row.direction === "long" ? "Bullish" : "Bearish";
              await sendTelegram(
                `📍 ${cfg.instrument} ${tf.label} ${label} OB erreicht\n` +
                  `Zone: ${fmt(row.bottom, cfg.pricePrecision)} – ${fmt(row.top, cfg.pricePrecision)}\n` +
                  `Preis: ${fmt(alertPrice, cfg.pricePrecision)}`,
              );
            }
          }

          instrumentSummary[tf.label] = { zonesSeen: zones.length, notified: notifiedCount };
        } else {
          // 4H außerhalb eines neuen H4-Kerzen: keine frischen Kerzen (siehe
          // unprocessedTimeframes) — zwischen zwei 4H-Kerzenschlüssen kann sich die
          // ZONENLISTE selbst nicht ändern, nur ob der Preis inzwischen eine schon bekannte
          // Zone berührt hat (dafür die jüngsten M5-Kerzen, siehe liveTouch.ts). Der DB-Stand
          // reicht als Zonenliste, kein detectOrderBlocks nötig — nur ein leichtes UPDATE statt
          // des vollen Upserts oben.
          for (const row of existingRows ?? []) {
            if (row.invalidated || row.touched) continue;
            const hit = findZoneTouch(recentM5, row.top, row.bottom);
            if (!hit) continue;
            const alertPrice = zoneTouchPrice(hit, row.top, row.bottom);

            const { error: updateError } = await supabase
              .from("ob_zones")
              .update({
                touched: true,
                notified: true,
                alert_price: alertPrice,
                notified_at: alarmActive ? new Date().toISOString() : row.notified_at ?? null,
              })
              .eq("instrument", cfg.instrument)
              .eq("timeframe", tf.label)
              .eq("direction", row.direction)
              .eq("start_time", row.start_time);
            if (updateError) throw updateError;

            if (alarmActive) {
              notifiedCount++;
              const label = row.direction === "long" ? "Bullish" : "Bearish";
              await sendTelegram(
                `📍 ${cfg.instrument} ${tf.label} ${label} OB erreicht\n` +
                  `Zone: ${fmt(row.bottom, cfg.pricePrecision)} – ${fmt(row.top, cfg.pricePrecision)}\n` +
                  `Preis: ${fmt(alertPrice, cfg.pricePrecision)}`,
              );
            }
          }

          instrumentSummary[tf.label] = { zonesSeen: (existingRows ?? []).length, notified: notifiedCount, cached: true };
        }
      }

      // HTF-Liquiditäts-Level (Fractal-Sweeps, siehe _shared/liquidity.ts) — 1H UND 4H (Task
      // "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Nachbesserung 2026-08-23,
      // Philip: Preisnahe relevante 4H-Level zusätzlich zu 1H). Läuft über dieselbe TIMEFRAMES-
      // Schleife wie die OB-Zonen oben und nutzt dieselben schon geholten `candlesByTf`-Kerzen —
      // kein zusätzlicher Fetch, 4H bleibt automatisch an unprocessedTimeframes gekoppelt (siehe
      // fetchForexBatch), genau wie bei den OB-Zonen. Gleiches M5-Kerzen-Sofort-Touch-Muster wie
      // oben bei den OB-Zonen (die Datenquelle liefert nur geschlossene Kerzen, sonst bis zu 59min
      // Verzoegerung bis zum Alarm; gegen die Kerzen statt gegen den Tick-Preis, siehe
      // liveTouch.ts).
      for (const tf of TIMEFRAMES) {
        const alarmActive = shouldSend && isAlarmOn(`liquidity_${tf.label.toLowerCase()}`);
        const candlesForTf = forexBatch.candlesByTf.get(tf.label);

        const existingLiqRows = await fetchAllRows<LiquidityLevelRow>((from, to) => supabase
          .from("liquidity_levels")
          .select("pivot_time, direction, price, touched, notified, notified_at, end_time, alert_price")
          .eq("instrument", cfg.instrument)
          .eq("timeframe", tf.label)
          .order("id").range(from, to).returns<LiquidityLevelRow[]>());

        let liqNotifiedCount = 0;

        if (candlesForTf) {
          const { highs, lows } = detectLiquidityLevels(candlesForTf, LIQUIDITY_FRACTAL_PERIOD);
          const levels = [
            ...highs.map((l) => ({ ...l, direction: "high" as const })),
            ...lows.map((l) => ({ ...l, direction: "low" as const })),
          ];

          const existingLiqMap = new Map(
            (existingLiqRows ?? []).map((r) => [
              `${r.direction}_${Math.floor(new Date(r.pivot_time).getTime() / 1000)}`,
              r,
            ]),
          );

          const pendingRows: Record<string, unknown>[] = [];
          const pendingAlerts: string[] = [];
          for (const lvl of levels) {
            const existing = existingLiqMap.get(`${lvl.direction}_${lvl.pivotTime}`);
            const wasTouchedInDb = existing?.touched ?? false;

            const liveHit = lvl.touched ? null : findLevelTouch(recentM5, lvl.price, lvl.direction);
            if (!lvl.touched && (wasTouchedInDb || liveHit)) {
              lvl.touched = true;
            }

            const justTouched = lvl.touched && !wasTouchedInDb;
            const alertPrice = liveHit ? levelTouchPrice(liveHit, lvl.direction) : currentPrice;

            // end_time: bevorzugt der aus der Kerzenhistorie abgeleitete Zeitpunkt (deterministisch,
            // siehe buildLevel in _shared/liquidity.ts), danach die M5-Kerze, die den Touch
            // gebracht hat. lvl.touchedTime ist nur dann null, wenn touched hier gerade erst vor
            // dem HTF-Kerzenschluss oder ueber wasTouchedInDb gesetzt wurde: bei einem brandneuen
            // Touch (justTouched) ist "jetzt" korrekt, bei einem laengst bekannten Touch, der nur
            // aus dem geladenen Kerzenfenster gefallen ist, bleibt der bestehende end_time-Wert
            // stehen (sonst wuerde er bei jedem Cron-Lauf erneut auf "jetzt" springen — derselbe
            // Bug, den end_time hier ueberhaupt erst ersetzen soll).
            const endTimeIso = !lvl.touched
              ? null
              : lvl.touchedTime != null
                ? new Date(lvl.touchedTime * 1000).toISOString()
                : liveHit
                  ? new Date(liveHit.time * 1000).toISOString()
                  : justTouched
                    ? new Date().toISOString()
                    : existing?.end_time ?? new Date().toISOString();

            pendingRows.push(
              {
                instrument: cfg.instrument,
                timeframe: tf.label,
                direction: lvl.direction,
                price: lvl.price,
                pivot_time: new Date(lvl.pivotTime * 1000).toISOString(),
                touched: lvl.touched,
                end_time: endTimeIso,
                alert_price: justTouched ? alertPrice : existing?.alert_price ?? null,
                notified: existing ? existing.notified || justTouched : lvl.touched,
                notified_at: justTouched && existing && alarmActive ? new Date().toISOString() : existing?.notified_at ?? null,
              },
            );

            // Neue Level, die schon beim ersten Erkennen touched sind, waeren ein
            // historischer Alt-Touch (z.B. direkt nach Deploy) — kein "jetzt gerade".
            if (justTouched && existing && alarmActive) {
              liqNotifiedCount++;
              const label = lvl.direction === "high" ? "Hoch" : "Tief";
              pendingAlerts.push(
                `💧 ${cfg.instrument} ${tf.label} Liquiditäts-Level (${label}) angetestet\n` +
                  `Level: ${fmt(lvl.price, cfg.pricePrecision)}\n` +
                  `Preis: ${fmt(alertPrice, cfg.pricePrecision)}`,
              );
            }
          }

          // Ein gemeinsamer Schreibzugriff statt hunderter HTTP-Roundtrips pro Zeitrahmen.
          // Nachrichten erst nach erfolgreicher Speicherung senden.
          if (pendingRows.length) {
            const { error } = await supabase.from("liquidity_levels").upsert(pendingRows, { onConflict: "instrument,timeframe,direction,pivot_time" });
            if (error) throw error;
          }
          for (const message of pendingAlerts) await sendTelegram(message);

          // Bug-Report Philip 2026-08-23: ein Feb-Pivot (weit außerhalb des rollierenden
          // FOREX_H1_LOOKBACK_CANDLES-Fensters) wurde am 21.08. um 09:00 UTC (Stundenkerze, also
          // exakt der nächste Auswertungslauf) tatsächlich vom Preis erreicht, blieb aber für
          // immer touched=false. Ursache: dieser "if"-Zweig prüft nur `levels` (frisch aus dem
          // AKTUELL geladenen Fenster erkannt) gegen currentPrice — ein Level, dessen Pivot
          // außerhalb dieses Fensters liegt, taucht in `levels` nie wieder auf und wird hier nie
          // geprüft. Der "else"-Zweig unten deckt genau das ab (alle DB-Zeilen gegen currentPrice),
          // läuft aber nur in den ANDEREN ~55 Minuten der Stunde (kein frisches 1H-Kerzen-Fetch) —
          // ausgerechnet zur vollen Stunde (wenn ein Spike in genau dieser Kerze auftritt und bis
          // zum nächsten 5-Min-Tick schon wieder abgeklungen ist) entsteht so ein permanenter
          // blinder Fleck. Fix: dieselbe Live-Preis-Prüfung wie im "else"-Zweig zusätzlich für
          // jede existierende DB-Zeile, die NICHT in `levels` (also außerhalb des Fensters) liegt.
          const levelsKeySet = new Set(levels.map((l) => `${l.direction}_${l.pivotTime}`));
          for (const row of existingLiqRows ?? []) {
            const rowPivotSec = Math.floor(new Date(row.pivot_time).getTime() / 1000);
            if (levelsKeySet.has(`${row.direction}_${rowPivotSec}`)) continue;
            if (row.touched) continue;
            const hit = findLevelTouch(recentM5, row.price, row.direction as "high" | "low");
            if (!hit) continue;
            const alertPrice = levelTouchPrice(hit, row.direction as "high" | "low");

            const { error: updateOffWindowLiqError } = await supabase
              .from("liquidity_levels")
              .update({
                touched: true,
                notified: true,
                alert_price: alertPrice,
                end_time: new Date(hit.time * 1000).toISOString(),
                notified_at: alarmActive ? new Date().toISOString() : row.notified_at ?? null,
              })
              .eq("instrument", cfg.instrument)
              .eq("timeframe", tf.label)
              .eq("direction", row.direction)
              .eq("pivot_time", row.pivot_time);
            if (updateOffWindowLiqError) throw updateOffWindowLiqError;

            if (alarmActive) {
              liqNotifiedCount++;
              const label = row.direction === "high" ? "Hoch" : "Tief";
              await sendTelegram(
                `💧 ${cfg.instrument} ${tf.label} Liquiditäts-Level (${label}) angetestet\n` +
                  `Level: ${fmt(row.price, cfg.pricePrecision)}\n` +
                  `Preis: ${fmt(alertPrice, cfg.pricePrecision)}`,
              );
            }
          }

          instrumentSummary[`${tf.label}_liquidity`] = { levelsSeen: levels.length, notified: liqNotifiedCount };
        } else {
          // Skip-Tick (siehe unprocessedTimeframes/unprocessedTimeframes oben): keine frischen Kerzen für
          // diesen Timeframe, also auch keine neuen Fraktale möglich — nur den DB-Stand gegen die
          // jüngsten M5-Kerzen pruefen, gleiches Muster wie beim OB-Zonen-Skip-Pfad.
          for (const row of existingLiqRows ?? []) {
            if (row.touched) continue;
            const hit = findLevelTouch(recentM5, row.price, row.direction as "high" | "low");
            if (!hit) continue;
            const alertPrice = levelTouchPrice(hit, row.direction as "high" | "low");

            const { error: updateLiqError } = await supabase
              .from("liquidity_levels")
              .update({
                touched: true,
                notified: true,
                alert_price: alertPrice,
                end_time: new Date(hit.time * 1000).toISOString(),
                notified_at: alarmActive ? new Date().toISOString() : row.notified_at ?? null,
              })
              .eq("instrument", cfg.instrument)
              .eq("timeframe", tf.label)
              .eq("direction", row.direction)
              .eq("pivot_time", row.pivot_time);
            if (updateLiqError) throw updateLiqError;

            if (alarmActive) {
              liqNotifiedCount++;
              const label = row.direction === "high" ? "Hoch" : "Tief";
              await sendTelegram(
                `💧 ${cfg.instrument} ${tf.label} Liquiditäts-Level (${label}) angetestet\n` +
                  `Level: ${fmt(row.price, cfg.pricePrecision)}\n` +
                  `Preis: ${fmt(alertPrice, cfg.pricePrecision)}`,
              );
            }
          }

          instrumentSummary[`${tf.label}_liquidity`] = { levelsSeen: (existingLiqRows ?? []).length, notified: liqNotifiedCount, cached: true };
        }
      }

      // Trade-Setup: Liquidity Sweep + Protected M5-Fraktal + M5-OB, in dieser Reihenfolge
      // (siehe tv-indikator/src/tradesetup.pine, portiert nach _shared/tradeSetup.ts).
      // dir=1 (Short/Protected High) und dir=-1 (Long/Protected Low) laufen mit denselben
      // Kerzen, nur gespiegelt (siehe checkShortSetup/checkLongSetup im Original).
      {
        const alarmActive = shouldSend && isAlarmOn("trade_setup");
        const m5Candles = forexBatch.candlesByTf.get("M5")!;
        const candles1hForSetup = h1CandlesForSetup!;
        const { highs: m5Highs, lows: m5Lows } = detectLiquidityLevels(m5Candles, TRADE_SETUP_M5_FRACTAL_PERIOD);
        const { highs: h1HighsSetup, lows: h1LowsSetup } = detectLiquidityLevels(candles1hForSetup, TRADE_SETUP_H1_FRACTAL_PERIOD);
        const setupObs = detectSetupObs(m5Candles);

        // Live-Preis-Sofort-Touch, gleiches Muster wie bei den 1H-Liquiditäts-Leveln oben —
        // sonst würde ein Fraktalbruch/Sweep erst beim nächsten Kerzenschluss erkannt (bis zu
        // 5min bei M5, bis zu 1h bei H1) und ein längst gebrochenes "Protected" fälschlich
        // noch als gültig gelten.
        const nowSec = Math.floor(Date.now() / 1000);
        const applyLiveTouch = (levels: LiquidityLevel[], direction: "high" | "low") => {
          for (const lvl of levels) {
            if (!lvl.touched && (direction === "high" ? currentPrice >= lvl.price : currentPrice <= lvl.price)) {
              lvl.touched = true;
              lvl.touchedTime = nowSec;
            }
          }
        };
        applyLiveTouch(m5Highs, "high");
        applyLiveTouch(m5Lows, "low");
        applyLiveTouch(h1HighsSetup, "high");
        applyLiveTouch(h1LowsSetup, "low");

        const tradeSetupParams = { ...DEFAULT_TRADE_SETUP_PARAMS, nowTime: m5Candles[m5Candles.length - 1].time };

        const detected = [
          detectTradeSetup(1, m5Highs, h1HighsSetup, m5Highs, setupObs, tradeSetupParams, m5Candles),
          detectTradeSetup(-1, m5Lows, h1LowsSetup, m5Lows, setupObs, tradeSetupParams, m5Candles),
        ].filter((s): s is NonNullable<typeof s> => s !== null);

        // Schlüssel ist seit 2026-09-20 der bestätigende OB, nicht mehr fractal_pivot_time — ein
        // Setup ist durch ihn identifiziert, nicht durch den Pfad, über den es gefunden wurde
        // (siehe detectTradeSetup). Der Unique-Index deckelt Duplikate damit schon in der DB; die
        // frühere ob_zone_id-Alarmsperre ist dadurch ersatzlos entfallen.
        //
        // Gefragt wird NUR nach den gerade erkannten OBs (höchstens zwei), nicht nach dem ganzen
        // Bestand: PostgREST deckelt eine Antwort server-seitig bei 1000 Zeilen, ohne Fehler (siehe
        // CLAUDE.md). GBPUSD stand am 20.09. bei 930 Zeilen und wuchs ~4/Tag — ein Voll-Select
        // hätte ab Anfang Oktober stillschweigend die JÜNGSTEN Zeilen verloren, und genau die
        // entscheiden hier: fehlt eine, gilt ihr Setup als nie alarmiert und Telegram feuert ein
        // zweites Mal.
        const notifiedByKey = new Map<string, boolean>();
        const hasAnySetupRow = { short: false, long: false };
        if (detected.length > 0) {
          const { data: existingSetupRows, error: setupSelectError } = await supabase
            .from("trade_setups")
            .select("direction, ob_start_time, notified")
            .eq("instrument", cfg.instrument)
            .in("ob_start_time", detected.map((s) => new Date(s.obStartTime * 1000).toISOString()));
          if (setupSelectError) throw setupSelectError;
          for (const r of existingSetupRows ?? []) {
            notifiedByKey.set(`${r.direction}_${Math.floor(new Date(r.ob_start_time).getTime() / 1000)}`, r.notified as boolean);
          }

          // Existenzfrage je Richtung — fiel früher als Nebenprodukt des Voll-Selects ab, ist aber
          // eine andere Frage als der Dedupe oben und braucht deshalb eine eigene Abfrage.
          for (const richtung of ["short", "long"] as const) {
            const { data: ersteZeile, error: ersteZeileError } = await supabase
              .from("trade_setups")
              .select("id")
              .eq("instrument", cfg.instrument)
              .eq("direction", richtung)
              .limit(1);
            if (ersteZeileError) throw ersteZeileError;
            hasAnySetupRow[richtung] = (ersteZeile ?? []).length > 0;
          }
        }

        let tradeSetupNotifiedCount = 0;
        let tradeSetupForbiddenCount = 0;
        const forbiddenSessions = forbiddenSessionsByInstrument.get(cfg.instrument) ?? [];
        for (const setup of detected) {
          const direction: "short" | "long" = setup.dir === 1 ? "short" : "long";
          const key = `${direction}_${setup.obStartTime}`;
          // Schon alarmiert = fertig. Eine vorhandene, aber NIE alarmierte Zeile bleibt dagegen
          // alarmfähig: entsteht ein Setup außerhalb des Alarmfensters, soll es den Alarm beim
          // ersten Tick im Fenster noch bekommen (früher kam der übers Path-A-Zwillingsexemplar
          // ~10min später, das es jetzt nicht mehr gibt — im Abnahmelauf betraf das 5 Zonen, z.B.
          // #175 um 04:50 stumm, #181 um 07:10 der echte Alarm). maxLookbackSec (6h) deckelt, wie
          // lange ein Setup so nachalarmieren kann.
          if (notifiedByKey.get(key) === true) continue;

          // Erstes Setup überhaupt für dieses Instrument+Richtung (kein "existing" überhaupt)
          // ist ein Alt-Bestand direkt nach Deploy, kein "gerade eben" — kein Alarm, analog zum
          // ob_zones/liquidity_levels-Verhalten beim allerersten Lauf.
          // Entstand der bestätigende M5-OB in einer 'forbidden'-Session (Asia/Spread Hour), zeigt
          // der Chart das Setup gar nicht erst an — dann auch kein Telegram, sonst alarmiert
          // poi-watcher auf etwas, das Philip nirgends nachschauen kann. obStartTime statt
          // fractal.pivotTime, exakt wie notForbidden in usePriceChartTradeSetups.js (der OB ist
          // der früheste plausible Entry-Zeitpunkt), sonst entsteht nur ein neues Gefälle.
          // Die ZEILE entsteht trotzdem: analysis/dr-reichweite/ wertet den Bestand aus, ein
          // stilles Loch darin wäre schlimmer als ein stiller Alarm.
          const forbiddenLabel = forbiddenSessionAt(forbiddenSessions, setup.obStartTime);
          if (forbiddenLabel) tradeSetupForbiddenCount++;
          const alertNow = hasAnySetupRow[direction] && alarmActive && !forbiddenLabel;
          // Ferne OB-Kante = das von widenObForSweep aufgezogene Sweep-Extrem (siehe
          // deriveSetupEntryInvalidation in der JS-Kopie) — in der DB die generierte Spalte
          // trade_setups.invalidation, hier fürs Telegram nochmal direkt aus dem Setup.
          const invalidation = direction === "short" ? setup.obTop : setup.obBottom;

          // Herkunft und Alter des Sweeps — beides wird persistiert und geht in den Alarmtext,
          // weil die Auswertung analysis/dr-reichweite/ (19.09.2026) beide als Qualitätsmerkmale
          // belegt hat: 1H-Sweep Reichweiten-Median 28,7 vs. 11,3 Pips bei M5, und ein Level, das
          // vor dem Sweep schon >=24h bestand, kommt auf ~29 statt 11,9. Den Timeframe vergibt
          // seit dem Sammeln ALLER Sweeps die Erkennung selbst (SetupSweep, _shared/tradeSetup.ts)
          // statt hier per includes() — dieselbe Zuordnung, nur nicht mehr je Schreiber nachgebaut.
          const lsFromH1 = setup.sweeps[0].timeframe === "1H";
          const sweepAgeHours = computeSweepAgeHours(setup.ls.touchedTime!, setup.ls.pivotTime);

          // Läuft gerade eine Dealing Range der Gegenrichtung? Laut derselben Auswertung der
          // schlechteste Zustand überhaupt — als schwächere Seite gegen eine lebende Gegen-DR
          // kommt die Reichweite nur auf 7,4 statt 14,8 Pips Median, und 41% aller DRs entstehen
          // in dieser Lage. "Lebend" heißt: früher entstanden und ihr Extrem-Fraktal seitdem nicht
          // berührt (Philips Definition: eine Gegen-DR ist gefährlich, solange sie weder
          // invalidiert noch am Ziel ist). Geprüft gegen die ohnehin geladenen M5-Kerzen.
          const oppositeDir = direction === "short" ? "long" : "short";
          const { data: oppRows, error: oppError } = await supabase
            .from("trade_setups")
            .select("invalidation, ob_start_time")
            .eq("instrument", cfg.instrument)
            .eq("direction", oppositeDir)
            .gte("ob_start_time", new Date((setup.obStartTime - 24 * 3600) * 1000).toISOString())
            .lt("ob_start_time", new Date(setup.obStartTime * 1000).toISOString())
            .order("ob_start_time", { ascending: false })
            .limit(20);
          if (oppError) throw oppError;
          const liveOpposite = (oppRows ?? []).some((o) => {
            const fromSec = Math.floor(new Date(o.ob_start_time).getTime() / 1000);
            const invalidiert = m5Candles.some(
              (c) => c.time >= fromSec && (oppositeDir === "long" ? c.low <= o.invalidation : c.high >= o.invalidation),
            );
            return !invalidiert;
          });

          // Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren": das M5-OB, das
          // dieses Setup bestätigt, wird jetzt zusätzlich als eigene ob_zones-Zeile referenziert
          // (statt nur ob_top/ob_bottom/ob_start_time als Kopie zu führen) — direction entspricht
          // hier exakt der Setup-Direction selbst (siehe Migration
          // 20260822100000_trade_setups_confirmations_ob_zone_id.sql für die Herleitung dieser
          // Äquivalenz). Nur die tatsächlich referenzierte Teilmenge der M5-OBs landet so in
          // ob_zones, nicht das gesamte M5-Universum (bewusste Entscheidung, siehe Plan-Datei).
          // Normaler Upsert statt ignoreDuplicates, damit .select() bei einem bereits vorhandenen
          // Konflikt trotzdem die id zurückgibt (touched/invalidated bleiben hier bewusst auf
          // Default false — dieses Referenz-Objekt wird nicht live nachverfolgt, das übernimmt
          // weiterhin die Indikator-Overlay-Live-Erkennung).
          const { data: setupObZone, error: obZoneUpsertError } = await supabase
            .from("ob_zones")
            .upsert(
              {
                instrument: cfg.instrument,
                timeframe: "5M",
                direction,
                top: setup.obTop,
                bottom: setup.obBottom,
                start_time: new Date(setup.obStartTime * 1000).toISOString(),
              },
              { onConflict: "instrument,timeframe,start_time,direction" },
            )
            .select("id")
            .single();
          if (obZoneUpsertError) throw obZoneUpsertError;

          const { data: setupRow, error: setupUpsertError } = await supabase
            .from("trade_setups")
            .upsert(
              {
                instrument: cfg.instrument,
                direction,
                fractal_price: setup.fractal.price,
                fractal_pivot_time: new Date(setup.fractal.pivotTime * 1000).toISOString(),
                ls_price: setup.ls.price,
                ls_pivot_time: new Date(setup.ls.pivotTime * 1000).toISOString(),
                ls_touched_time: new Date(setup.ls.touchedTime! * 1000).toISOString(),
                ls_timeframe: lsFromH1 ? "1H" : "5M",
                ob_top: setup.obTop,
                ob_bottom: setup.obBottom,
                ob_start_time: new Date(setup.obStartTime * 1000).toISOString(),
                ob_zone_id: setupObZone.id,
                alert_price: currentPrice,
                notified: alertNow,
                notified_at: alertNow ? new Date().toISOString() : null,
              },
              { onConflict: "instrument,direction,ob_start_time" },
            )
            .select("id")
            .single();
          if (setupUpsertError) throw setupUpsertError;

          // ALLE abgeräumten Level, nicht nur das entscheidende (Philip 21.09.2026: "Je mehr
          // Bestätigungs-LQ-Sweeps desto besser") — 44 % der Setups haben mehr als eins, siehe
          // Migration 20260921210000. Der entscheidende steht zusätzlich weiterhin in ls_*.
          await persistTradeSetupSweeps(supabase, setupRow.id as number, setup.sweeps);

          if (alertNow) {
            tradeSetupNotifiedCount++;
            const label = direction === "short" ? "Short (Protected High)" : "Long (Protected Low)";
            // Alter des Sweep-Levels gerundet: die Auswertung zeigt nur zwischen "<24h" und
            // ">=24h" einen Unterschied, Major (>=120h) und Medium (24-120h) sind mit 29,2 vs.
            // 29,3 Pips nicht unterscheidbar — eine feinere Angabe würde Genauigkeit vortäuschen.
            const ageText = sweepAgeHours >= 24 ? `${Math.round(sweepAgeHours / 24)}d alt` : `${Math.round(sweepAgeHours)}h alt`;
            // Mehrere abgeräumte Level sind mehrere Bestätigungen derselben Idee. Die Zahl hängt
            // am entscheidenden Sweep statt in einer eigenen Zeile — der Text ist schon fünfzeilig.
            const weitereSweeps = setup.sweeps.length > 1 ? `, +${setup.sweeps.length - 1} weitere` : "";
            const warnung = liveOpposite ? `\n⚠️ Gegenläufige Dealing Range noch aktiv${lsFromH1 ? "" : " — und dieses Setup hat nur einen M5-Sweep"}` : "";
            await sendTelegram(
              `🎯 ${cfg.instrument} Trade-Setup: ${label}\n` +
                // Seit 2026-09-20 die Invalidierung (ferne OB-Kante) statt fractal.price: ohne
                // bestätigtes Protected-Pivot zeigte das aufs gesweepte Level statt aufs Extrem.
                `Invalidierung: ${fmt(invalidation, cfg.pricePrecision)}\n` +
                `LS-Sweep: ${fmt(setup.ls.price, cfg.pricePrecision)} (${lsFromH1 ? "1H" : "M5"}, ${ageText}${weitereSweeps})\n` +
                `M5-OB: ${fmt(setup.obBottom, cfg.pricePrecision)} – ${fmt(setup.obTop, cfg.pricePrecision)}\n` +
                `Preis: ${fmt(currentPrice, cfg.pricePrecision)}` +
                warnung,
            );
          }
        }

        instrumentSummary["tradeSetups"] = { detected: detected.length, notified: tradeSetupNotifiedCount, forbiddenSession: tradeSetupForbiddenCount };
      }

      // Erst nach einem vollständigen Lauf markieren; ein Fehler muss erneut versucht werden.
      if (forexBatch.candlesByTf.has("1H") || forexBatch.candlesByTf.has("4H")) {
        const { error } = await supabase.from("forex_h1_cache").upsert({
          instrument: cfg.instrument, candles: h1CandlesForSetup, h4_last_time: h4LastTime,
        });
        if (error) throw error;
      }
      (summary.instruments as Record<string, unknown>)[cfg.instrument] = { currentPrice, shouldSend, ...instrumentSummary };
    }

    // Pin-Touch-Alarm (Chat 2026-08-17, siehe Task "Pin-Kontext: MCP-Write, fehlende
    // Chart-Highlights, Touch-Alarm") — EIN konsolidierter Durchlauf über pin_context statt in
    // die Timeframe-/Instrument-Schleifen oben verwoben, weil pin_context quer über alle Kinds/
    // Instrumente geht und für ob_zone/liquidity_level/trade_setup ohnehin nur die JETZT (oben)
    // frisch upgeserteten touched-Zustände der referenzierten Zeilen nachliest (kein zweites
    // detectOrderBlocks/detectLiquidityLevels nötig; M5-ob_zones-Zeilen sind die Ausnahme, siehe
    // resolvePinTouch). m5_liquidity_level (reiner Rohdaten-Snapshot ohne eigene Tabelle) wird hier
    // direkt gegen currentPriceByInstrument geprüft. rsi_divergence bewusst NICHT hier — eigener,
    // separater Task ("RSI-Divergenz: Telegram-Alarm bei Entstehung") mit Formations- statt
    // Touch-Semantik.
    const { data: pinRows, error: pinSelectError } = await supabase
      .from("pin_context")
      .select(
        "id, kind, note, notified, " +
          "m5_liquidity_instrument, m5_liquidity_direction, m5_liquidity_price, " +
          "ob_zones(instrument, timeframe, direction, top, bottom, touched, invalidated), " +
          "liquidity_levels(instrument, timeframe, direction, price, touched), " +
          "trade_setups(instrument, direction, ob_top, ob_bottom)",
      )
      .eq("notified", false)
      .returns<PinAlarmRow[]>();
    if (pinSelectError) throw pinSelectError;

    let pinNotifiedCount = 0;
    for (const row of pinRows ?? []) {
      const hit = resolvePinTouch(row, currentPriceByInstrument);
      if (!hit) continue; // (noch) nicht getroffen, oder Instrument diesen Tick nicht gefetcht

      const alarmActive = (shouldSendByInstrument[hit.instrument] ?? false) && isAlarmOn("pin_context");
      if (!alarmActive) continue; // getroffen, aber außerhalb des Alarmfensters — nächster Lauf versucht's erneut

      const { error: pinUpdateError } = await supabase
        .from("pin_context")
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq("id", row.id);
      if (pinUpdateError) throw pinUpdateError;

      pinNotifiedCount++;
      const noteLine = row.note ? `\n📝 ${row.note}` : "";
      await sendTelegram(`${hit.message}${noteLine}`);
    }
    (summary as Record<string, unknown>).pinNotified = pinNotifiedCount;

    return new Response(JSON.stringify(summary), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("poi-watcher error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
