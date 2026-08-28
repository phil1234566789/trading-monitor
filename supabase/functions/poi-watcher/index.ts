// D2 (vereinfacht): 4H+1H-Zonen-Wächter für die Forex-Instrumente (GBPUSD/EURUSD via cTrader
// Open API). Erkennt Order-Block-Zonen, persistiert sie in `ob_zones` und schickt eine
// Telegram-Nachricht, sobald eine Zone zum ersten Mal vom Preis berührt wird — aber nur für
// Instrumente mit `sendTelegram: true` (siehe INSTRUMENTS unten). Kein M1/Claude-Entry-Check
// (D3) — das kommt erst, wenn die Strategie ein Regelwerk für Claude hat.
//
// (BTC-USDT lief hier bis 2026-08-21 über OKX mit; Philip tradet BTC mit der aktuellen Strategie
// nicht mehr, der OKX-Zweig ist komplett raus — bereits erkannte BTC-Zonen bleiben unangetastet
// in der DB, nur die Erkennung/der Alarm-Pfad läuft nicht mehr.)
//
// Zurück von Twelve Data zu cTrader (2026-08-03, siehe PLAN-notifications.md "Status: cTrader
// Open API"): Twelve Data ist ein 60+-Liquiditätsprovider-Aggregat, dessen Preisglättung die
// Docht-Extreme kappt, auf denen FVG/OB-Erkennung aufbaut (Bug-Report 2026-07-27, Setups auf
// FOREXCOM sichtbar, auf Twelve Data nicht) — strukturelles Problem, kein Bug in
// orderBlocks.ts/liquidity.ts. Neu diesmal: ein reguläres Pepperstone-Razor-Demokonto statt
// einer Prop-Firm-Challenge (die beiden vorherigen cTrader-Ausfälle waren beide ein
// deaktiviertes Challenge-Konto, kein Spotware/cTrader-Problem selbst).
import { createClient } from "npm:@supabase/supabase-js@2";
import { detectOrderBlocks, type Candle } from "../_shared/orderBlocks.ts";
import { detectLiquidityLevels, type LiquidityLevel } from "../_shared/liquidity.ts";
import { fetchTrendbarsBatch, type RefreshedTokens } from "../_shared/ctrader/client.ts";
import { detectSetupObs, detectTradeSetup } from "../_shared/tradeSetup.ts";

const TIMEFRAMES: { label: "4H" | "1H" }[] = [{ label: "4H" }, { label: "1H" }];
// 300h (~12,5 Tage) reichten nicht, um lange unberührte 1H-Liquiditäts-Level (und 1H-OB-Zonen, die
// denselben Kerzensatz mitnutzen) im Blick zu behalten — Philip tradet von Ziel zu Ziel und
// braucht dafür ein paar unberührte Level ober-/unterhalb des Kurses, auch wenn die schon
// Wochen/Monate alt sind. Bug-Report 2026-08-02: ein 45 Tage alter, nie erneut erkannter Pivot
// (1,15297, 18.06.) fehlte deshalb komplett in liquidity_levels. 3000h (~125 Tage) statt 300h —
// cTraders Hard-Limit ist 14000 Bars/Request (siehe fetchOneTrendbar in _shared/ctrader/client.ts),
// 3000 ist also unproblematisch. Weiterhin nur EIN Fetch pro Stunde (Konsistenz mit dem
// bestehenden Cache-Verhalten, nicht mehr aus Rate-Limit-Gründen wie bei Twelve Data) — der
// nächste isH1RefreshTick-Lauf erkennt/backfillt fehlende ältere Level automatisch.
const FOREX_H1_LOOKBACK_CANDLES = 3000;
// Bug-Report Philip 2026-08-23: eine 4H-OB-Zone vom 12.05. (start_time außerhalb des alten
// CANDLE_LIMIT=300-Fensters, ~50 Tage) wurde real getouched+invalidated (Kerzen-Vollarchiv-
// Neuberechnung bestätigt: 19.08. ~13:00 UTC), blieb in der DB aber für immer touched=false —
// derselbe Fensterblindfleck wie oben bei FOREX_H1_LOOKBACK_CANDLES, nur diesmal beim 4H-Fetch, der
// bis dahin bei den alten 300 Kerzen (~50 Tage) belassen wurde. Auf dieselbe Größenordnung wie 1H
// angehoben (3000 4H-Kerzen = ~500 Tage) — läuft nur an isH4RefreshTick-Ticks (alle 4h), also kein
// zusätzlicher API-Druck.
const FOREX_H4_LOOKBACK_CANDLES = 3000;
const LIQUIDITY_FRACTAL_PERIOD = 5; // siehe LIQUIDITY_FRACTAL_PERIOD in PriceChart.vue

// Trade-Setup-Parameter (Liquidity Sweep + Protected M5-Fraktal + M5-OB, siehe
// _shared/tradeSetup.ts) — 1:1 aus den getunten Defaults in tv-indikator/src/inputs.pine
// übernommen (TRADE-SETUP-Gruppen), nicht neu erraten.
const TRADE_SETUP_M5_FRACTAL_PERIOD = 5; // liqM5Period
const TRADE_SETUP_H1_FRACTAL_PERIOD = 10; // liqH1Period — bewusst ANDERS als LIQUIDITY_FRACTAL_PERIOD oben (eigene 1H-Notification, andere Abstimmung)
const TRADE_SETUP_M5_CANDLE_LIMIT = 300; // ~25h M5-Historie, deutlich mehr als der Lookback unten
const TRADE_SETUP_GRACE_SEC = 5 * 60; // eine M5-Kerzenlänge (m5FractalGraceMs)
const TRADE_SETUP_LS_MAX_LEAD_SEC_H1 = 120 * 60; // lsMaxLeadMinutesH1 — H1-Sweep liegt typischerweise
// deutlich länger vor dem Fraktal als ein M5-Sweep, daher eigenes größeres Fenster (Bug-Report
// 2026-07-17: ein gemeinsames Fenster war für M5 zu großzügig oder für H1 zu eng, siehe
// tv-indikator "fix short setups für 1h LS und M5 LS")
const TRADE_SETUP_LS_MAX_LEAD_SEC_M5 = 45 * 60; // lsMaxLeadMinutesM5
const TRADE_SETUP_PIP_SIZE = 0.0001; // pipSize im Indikator — gilt für beide FX-Paare (GBPUSD/EURUSD)
const TRADE_SETUP_LS_MAX_DISTANCE_M5 = 5.0 * TRADE_SETUP_PIP_SIZE; // lsMaxDistancePipsM5=5 — ein M5-LS,
// das weiter als das vom Fraktal entfernt liegt, ist kein Liquidity Sweep mehr sondern ein
// gewöhnlicher Strukturbruch (Klärung Philip, 2026-07-17). NUR für M5, H1 bekommt kein Limit
// (siehe tv-indikator "M5 LS auf 5 pips eingrenzen").
const TRADE_SETUP_OB_MAX_DELAY_SEC = 60 * 60; // obMaxDelayMinutes
const TRADE_SETUP_LOOKBACK_SEC = 6 * 60 * 60; // protectedHighLookbackHours

// Explizit typisiert statt auf die select-String-Typinferenz von supabase-js zu vertrauen —
// die kollabiert bei einem untypisierten Client (kein Database-Generic bei createClient) ab
// einer gewissen Spaltenzahl im select() auf `{}` (siehe Chat 2026-07-23: TS-Fehler beim
// Erweitern um top/bottom/weak/invalidated).
interface ObZoneRow {
  start_time: string;
  direction: string;
  touched: boolean;
  notified: boolean;
  notified_at: string | null;
  alert_price: number | null;
  top: number;
  bottom: number;
  weak: boolean;
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

const INSTRUMENTS: InstrumentConfig[] = [
  { instrument: "GBPUSD", sendTelegram: true, pricePrecision: 5 },
  { instrument: "EURUSD", sendTelegram: true, pricePrecision: 5 },
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const DRY_RUN = (Deno.env.get("DRY_RUN") ?? "false").toLowerCase() === "true";
const CTRADER_CLIENT_ID = Deno.env.get("CTRADER_CLIENT_ID")!;
const CTRADER_CLIENT_SECRET = Deno.env.get("CTRADER_CLIENT_SECRET")!;
// Fallback fürs allererste Deployment vor der ersten `ctrader_oauth_tokens`-Zeile — siehe
// selbes Muster in forex-candles/index.ts.
const CTRADER_ACCESS_TOKEN_FALLBACK = Deno.env.get("CTRADER_ACCESS_TOKEN") ?? "";
const CTRADER_REFRESH_TOKEN_FALLBACK = Deno.env.get("CTRADER_REFRESH_TOKEN") ?? "";

// Nur beim ersten Lauf nach einem Kerzenschluss neu holen (Chat 2026-07-23: "da ändert sich
// doch in 4h/1h nichts") — zwischen zwei Kerzenschlüssen liefert die Datenquelle (nur
// geschlossene Kerzen, empirisch verifiziert für Twelve Data UND cTrader) exakt dieselbe
// Kerzenreihe, ein Refetch alle 5min war reine Verschwendung. UTC statt Europe/Berlin, weil
// sich sowohl der pg_cron-Tick als auch die Kerzen-Bucket-Grenzen an UTC ausrichten.
// isH4RefreshTick-Ticks sind automatisch eine Teilmenge von isH1RefreshTick-Ticks (jede
// 4H-Grenze ist auch eine 1H-Grenze).
function isH1RefreshTick(date: Date): boolean {
  return date.getUTCMinutes() === 0;
}
function isH4RefreshTick(date: Date): boolean {
  return date.getUTCHours() % 4 === 0 && date.getUTCMinutes() === 0;
}

interface CtraderCreds {
  accessToken: string;
  refreshToken: string;
  onTokenRefresh: (tokens: RefreshedTokens) => Promise<void>;
}

// Ein Connect/Auth-Handshake pro Forex-Instrument für alle benötigten Timeframes in einem
// Rutsch (fetchTrendbarsBatch, siehe _shared/ctrader/client.ts) — anders als beim
// zwischenzeitlichen Twelve-Data-Umweg, der das mangels Batch-API in parallele Einzel-REST-
// Calls aufteilen musste. Kein eigener M1-Preis-Call (Chat 2026-07-23, gilt weiterhin) — der
// Close der letzten M5-Kerze reicht für den Live-Touch-Check. 1H fehlt in candlesByTf, wenn
// includeH1=false — der Aufrufer muss dann auf den forex_h1_cache-Stand zurückfallen (siehe
// Deno.serve unten), fürs Trade-Setup UND die 1H-Zonen/Liquidity-Level.
async function fetchForexBatch(
  symbol: string,
  includeH1: boolean,
  includeH4: boolean,
  creds: CtraderCreds,
): Promise<{ currentPrice: number; candlesByTf: Map<string, Candle[]> }> {
  const requestSpecs: { key: string; period: string; count: number }[] = [
    { key: "M5", period: "M5", count: TRADE_SETUP_M5_CANDLE_LIMIT },
  ];
  if (includeH1) requestSpecs.push({ key: "1H", period: "H1", count: FOREX_H1_LOOKBACK_CANDLES });
  if (includeH4) requestSpecs.push({ key: "4H", period: "H4", count: FOREX_H4_LOOKBACK_CANDLES });

  const results = await fetchTrendbarsBatch({
    clientId: CTRADER_CLIENT_ID,
    clientSecret: CTRADER_CLIENT_SECRET,
    accessToken: creds.accessToken,
    refreshToken: creds.refreshToken,
    onTokenRefresh: creds.onTokenRefresh,
    requests: requestSpecs.map(({ period, count }) => ({ symbolName: symbol, period, count })),
  });

  const candlesByTf = new Map(requestSpecs.map((spec, i) => [spec.key, results[i]]));
  const m5Candles = candlesByTf.get("M5")!;
  return { currentPrice: m5Candles[m5Candles.length - 1].close, candlesByTf };
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

function isInWindows(date: Date, windows: WeekdayWindows | undefined, startBufferMin = 0): boolean {
  if (!windows) return false;
  const { minutesSinceMidnight, group } = localMinutesAndWeekday(date);
  return windows[group].some(([from, to]) => minutesSinceMidnight >= from - startBufferMin && minutesSinceMidnight < to);
}

// Nachts/am Wochenende (außerhalb des Alarmfensters) werden fürs Forex-Zonen-Fetching keine
// Requests gebraucht (Philip schläft bzw. tradet nicht, kein Alarm bringt was) — spart unnötige
// cTrader-Connects (ursprünglich gegen Twelve Datas Free-Tier-Rate-Limit gedacht, 800/Tag,
// 8/Min; bleibt aber auch ohne dieses Limit sinnvoll, um außerhalb der Handelszeiten keine
// Zonen-Erkennung/DB-Schreibvorgänge zu verursachen, die eh niemand ansieht). FETCH_START_BUFFER_MIN
// Minuten VOR Fensterstart schon wieder
// holen (nicht erst exakt zum Fensterbeginn) — ein einziger Lauf davor reicht, um über Nacht
// liegengebliebene Touches noch außerhalb des Fensters (shouldSend=false) still nachzuholen,
// damit beim tatsächlichen Fensterstart kein Nachhol-Alarm-Schwall für längst vergangene Touches
// losgeht (gleicher Grund wie beim früheren 24/7-Cron, nur jetzt auf ein kurzes Vorlauf-Fenster
// verkürzt).
const FETCH_START_BUFFER_MIN = 10;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Manueller Override für den regulären isH1RefreshTick-Gate (nur volle UTC-Stunde) — der
    // 5min-Cron schickt immer `{}` (siehe poi_watcher_cron_5min-Migration), also bleibt das
    // reguläre Throttling für den Cron unverändert; nur ein gezielter manueller Aufruf mit
    // {"forceH1Refresh": true} im Body erzwingt einen sofortigen H1-Refetch (z.B. um nach der
    // FOREX_H1_LOOKBACK_CANDLES-Erhöhung 2026-08-02 nicht bis zur nächsten vollen Stunde zu warten).
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
      .select("instrument, alarm_windows");
    if (scheduleSelectError) throw scheduleSelectError;
    const alarmWindowsByInstrument = new Map<string, WeekdayWindows>(
      (scheduleRows ?? []).map((r) => [r.instrument, r.alarm_windows as WeekdayWindows]),
    );

    // cTrader-Access-/Refresh-Token: `ctrader_oauth_tokens` ist die eigentliche Quelle (siehe
    // Migration 20260722120000), die CTRADER_ACCESS_TOKEN/REFRESH_TOKEN-Secrets nur ein
    // Fallback fürs allererste Deployment vor der ersten Zeile — gleiches Muster wie in
    // forex-candles/index.ts. onTokenRefresh schreibt ein automatisch refreshtes Token zurück,
    // damit der nächste Cron-Tick (und forex-candles) das frische Token sieht.
    const { data: tokenRow, error: tokenSelectError } = await supabase
      .from("ctrader_oauth_tokens")
      .select("access_token, refresh_token")
      .eq("id", 1)
      .maybeSingle();
    if (tokenSelectError) throw tokenSelectError;
    const ctraderCreds: CtraderCreds = {
      accessToken: tokenRow?.access_token ?? CTRADER_ACCESS_TOKEN_FALLBACK,
      refreshToken: tokenRow?.refresh_token ?? CTRADER_REFRESH_TOKEN_FALLBACK,
      onTokenRefresh: async (fresh) => {
        const { error } = await supabase
          .from("ctrader_oauth_tokens")
          .upsert({ id: 1, access_token: fresh.accessToken, refresh_token: fresh.refreshToken });
        if (error) console.error("poi-watcher: failed to persist refreshed cTrader token:", error);
      },
    };

    const now = new Date();
    const h4RefreshTick = isH4RefreshTick(now);
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
      const forexFetchWindow = isInWindows(now, alarmWindows, FETCH_START_BUFFER_MIN);
      if (!forexFetchWindow && !forceH1Refresh) {
        (summary.instruments as Record<string, unknown>)[cfg.instrument] = { skipped: "outside forex fetch window" };
        continue;
      }
      // 1H fürs Trade-Setup (candles1hForSetup unten) braucht IMMER eine Kerzenreihe, egal ob
      // dieser Lauf frisch fetcht oder nicht — anders als die 1H-OB-Zonen/Liquidity-Level unten,
      // die bei einem Skip-Tick bewusst NUR den DB-Stand fürs Touch-Update anfassen (kein Sinn
      // in einem eigenen "Fraktal touched"-Konzept). Deshalb hier der forex_h1_cache-Fallback,
      // nicht direkt candlesByTf — sonst würde jeder Skip-Tick trotzdem wieder volle Arbeit
      // machen und der Cache brächte nichts.
      let h1RefreshTick = isH1RefreshTick(now) || forceH1Refresh;
      let h1CandlesForSetup: Candle[] | undefined;
      if (!h1RefreshTick) {
        const { data: h1CacheRow, error: h1CacheError } = await supabase
          .from("forex_h1_cache")
          .select("candles")
          .eq("instrument", cfg.instrument)
          .maybeSingle();
        if (h1CacheError) throw h1CacheError;
        if (h1CacheRow) {
          h1CandlesForSetup = h1CacheRow.candles as Candle[];
        } else {
          h1RefreshTick = true; // Bootstrap: noch kein Cache-Eintrag, erzwungener Fetch
        }
      }

      const forexBatch = await fetchForexBatch(cfg.instrument, h1RefreshTick, h4RefreshTick, ctraderCreds);
      const freshH1Candles = forexBatch.candlesByTf.get("1H");
      if (freshH1Candles) {
        h1CandlesForSetup = freshH1Candles;
        const { error: h1CacheWriteError } = await supabase
          .from("forex_h1_cache")
          .upsert({ instrument: cfg.instrument, candles: freshH1Candles });
        if (h1CacheWriteError) throw h1CacheWriteError;
      }
      const currentPrice = forexBatch.currentPrice;
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

        const { data: existingRows, error: selectError } = await supabase
          .from("ob_zones")
          .select("start_time, direction, touched, notified, notified_at, alert_price, top, bottom, weak, invalidated")
          .eq("instrument", cfg.instrument)
          .eq("timeframe", tf.label)
          .returns<ObZoneRow[]>();
        if (selectError) throw selectError;

        let notifiedCount = 0;

        if (candles) {
          // Voller Durchlauf: Zonen frisch aus den Kerzen erkennen (structural touched/
          // invalidated ändert sich nur, wenn neue Kerzen dazukommen) und mit dem DB-Stand
          // mergen. Läuft bei 1H jeden Tick, bei 4H nur an isH4RefreshTick-Ticks (siehe
          // fetchForexBatch).
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

          for (const z of zones) {
            const direction = z.dir === 1 ? "long" : "short";
            const existing = existingMap.get(`${direction}_${z.startTime}`);
            const wasTouchedInDb = existing?.touched ?? false;

            // Live-Preis-Touch: sowohl Twelve Data als auch cTrader liefern nur geschlossene
            // Kerzen, d.h. ohne das hier wuerde ein Touch erst erkannt, wenn die volle 1H/4H-
            // Kerze schliesst (bis zu 59min
            // Verzoegerung). Einmal getouched bleibt getouched (auch wenn detectOrderBlocks()
            // die noch offene Kerze dementsprechend noch nicht sieht) — sonst faellt der Wert
            // beim naechsten Run auf false zurueck und der Alarm geht beim echten Kerzenschluss
            // ein zweites Mal raus.
            if (!z.invalidated && !z.touched && (wasTouchedInDb || (currentPrice <= z.top && currentPrice >= z.bottom))) {
              z.touched = true;
            }

            const justTouched = z.touched && !wasTouchedInDb;

            const { error: upsertError } = await supabase.from("ob_zones").upsert(
              {
                instrument: cfg.instrument,
                timeframe: tf.label,
                direction,
                top: z.top,
                bottom: z.bottom,
                weak: z.weak,
                touched: z.touched,
                invalidated: z.invalidated,
                start_time: new Date(z.startTime * 1000).toISOString(),
                // end_time kommt direkt aus der Zonen-Erkennung: waechst mit jeder Kerze, bis die
                // Zone touched/invalidated ist, dann friert es automatisch ein (siehe
                // detectOrderBlocks in _shared/orderBlocks.ts) — deterministisch aus der
                // Kerzenhistorie, keine eigene Wanduhr-Bookkeeping noetig.
                end_time: new Date(z.endTime * 1000).toISOString(),
                // alert_price: der Preis im Moment des Touches, einmal eingefroren (wie
                // end_time) — unabhaengig davon, ob dafuer auch wirklich eine TG-Nachricht
                // rausging (alarmActive/Session steuern nur notified_at, nicht diesen Wert).
                alert_price: justTouched ? currentPrice : existing?.alert_price ?? null,
                notified: existing ? existing.notified || justTouched : z.touched,
                // notified_at nur bei einem echten Versand setzen (existing muss vorhanden sein,
                // sonst ist es ein historischer Alt-Touch ohne echten Alarm) — sonst würde ein
                // beim Deploy schon getouchtes Alt-Zone-Backlog faelschlich den Deploy-Zeitpunkt
                // als "gerade eben benachrichtigt" zeigen.
                notified_at: justTouched && existing && alarmActive ? new Date().toISOString() : existing?.notified_at ?? null,
              },
              { onConflict: "instrument,timeframe,start_time,direction" },
            );
            if (upsertError) throw upsertError;

            // Bei brandneuen Zonen (kein `existing`), die schon beim ersten Erkennen touched
            // sind, nicht alarmieren — das waere ein historischer Alt-Touch, kein "jetzt gerade".
            if (justTouched && existing && alarmActive) {
              notifiedCount++;
              const label = direction === "long" ? "Bullish" : "Bearish";
              await sendTelegram(
                `📍 ${cfg.instrument} ${tf.label} ${label} OB erreicht\n` +
                  `Zone: ${fmt(z.bottom, cfg.pricePrecision)} – ${fmt(z.top, cfg.pricePrecision)}${z.weak ? " (schwach)" : ""}\n` +
                  `Preis: ${fmt(currentPrice, cfg.pricePrecision)}`,
              );
            }
          }

          // Bug-Report Philip 2026-08-23 (analog zum liquidity_levels-Fix weiter unten): eine Zone,
          // deren start_time außerhalb des gerade geholten Kerzenfensters liegt, taucht in `zones`
          // gar nicht erst auf und wurde vom Loop oben nie wieder angefasst — für immer eingefroren,
          // selbst wenn der Preis sie inzwischen längst berührt hat. Dasselbe simple Live-Preis-
          // Sicherheitsnetz wie im "else"-Zweig unten, hier zusätzlich auch an einem Refresh-Tick,
          // nicht nur an einem Skip-Tick. Kein Ersatz für die volle Kerzenhistorie (ein Spike, der
          // sich vor dem nächsten poi-watcher-Lauf schon wieder zurückzieht, rutscht weiterhin durch
          // — dafür braucht es die einmalige Archiv-Korrektur, siehe backfillObZones.ts), aber besser
          // als "nie wieder geprüft".
          const zoneKeysInWindow = new Set(zones.map((z) => `${z.dir === 1 ? "long" : "short"}_${z.startTime}`));
          for (const row of existingRows ?? []) {
            if (row.invalidated || row.touched) continue;
            const rowStartSec = Math.floor(new Date(row.start_time).getTime() / 1000);
            if (zoneKeysInWindow.has(`${row.direction}_${rowStartSec}`)) continue;
            if (currentPrice > row.top || currentPrice < row.bottom) continue;

            const { error: updateOffWindowError } = await supabase
              .from("ob_zones")
              .update({
                touched: true,
                notified: true,
                alert_price: currentPrice,
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
                  `Zone: ${fmt(row.bottom, cfg.pricePrecision)} – ${fmt(row.top, cfg.pricePrecision)}${row.weak ? " (schwach)" : ""}\n` +
                  `Preis: ${fmt(currentPrice, cfg.pricePrecision)}`,
              );
            }
          }

          instrumentSummary[tf.label] = { zonesSeen: zones.length, notified: notifiedCount };
        } else {
          // 4H außerhalb eines isH4RefreshTick-Ticks: keine frischen Kerzen (siehe
          // fetchForexBatch/isH4RefreshTick) — zwischen zwei 4H-Kerzenschlüssen kann sich die
          // ZONENLISTE selbst nicht ändern, nur ob der Preis inzwischen eine schon bekannte
          // Zone berührt hat. Dafür reicht der DB-Stand als Zonenliste, kein detectOrderBlocks
          // nötig — nur ein leichtes UPDATE statt des vollen Upserts oben.
          for (const row of existingRows ?? []) {
            if (row.invalidated || row.touched) continue;
            if (currentPrice > row.top || currentPrice < row.bottom) continue;

            const { error: updateError } = await supabase
              .from("ob_zones")
              .update({
                touched: true,
                notified: true,
                alert_price: currentPrice,
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
                  `Zone: ${fmt(row.bottom, cfg.pricePrecision)} – ${fmt(row.top, cfg.pricePrecision)}${row.weak ? " (schwach)" : ""}\n` +
                  `Preis: ${fmt(currentPrice, cfg.pricePrecision)}`,
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
      // kein zusätzlicher Fetch, 4H bleibt automatisch an isH4RefreshTick gekoppelt (siehe
      // fetchForexBatch), genau wie bei den OB-Zonen. Gleiches Live-Preis-Sofort-Touch-Muster wie
      // oben bei den OB-Zonen (die Datenquelle liefert nur geschlossene Kerzen, sonst bis zu 59min
      // Verzoegerung bis zum Alarm).
      for (const tf of TIMEFRAMES) {
        const alarmActive = shouldSend && isAlarmOn(`liquidity_${tf.label.toLowerCase()}`);
        const candlesForTf = forexBatch.candlesByTf.get(tf.label);

        const { data: existingLiqRows, error: liqSelectError } = await supabase
          .from("liquidity_levels")
          .select("pivot_time, direction, price, touched, notified, notified_at, end_time, alert_price")
          .eq("instrument", cfg.instrument)
          .eq("timeframe", tf.label)
          .returns<LiquidityLevelRow[]>();
        if (liqSelectError) throw liqSelectError;

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

          for (const lvl of levels) {
            const existing = existingLiqMap.get(`${lvl.direction}_${lvl.pivotTime}`);
            const wasTouchedInDb = existing?.touched ?? false;

            if (
              !lvl.touched &&
              (wasTouchedInDb || (lvl.direction === "high" ? currentPrice >= lvl.price : currentPrice <= lvl.price))
            ) {
              lvl.touched = true;
            }

            const justTouched = lvl.touched && !wasTouchedInDb;

            // end_time: bevorzugt der aus der Kerzenhistorie abgeleitete Zeitpunkt (deterministisch,
            // siehe buildLevel in _shared/liquidity.ts). lvl.touchedTime ist nur dann null, wenn
            // touched hier gerade erst per Live-Preis (vor Kerzenschluss) oder ueber
            // wasTouchedInDb gesetzt wurde: bei einem brandneuen Touch (justTouched) ist "jetzt"
            // korrekt, bei einem laengst bekannten Touch, der nur aus dem geladenen
            // Kerzenfenster gefallen ist, bleibt der bestehende end_time-Wert stehen (sonst
            // wuerde er bei jedem Cron-Lauf erneut auf "jetzt" springen — derselbe Bug, den
            // end_time hier ueberhaupt erst ersetzen soll).
            const endTimeIso = !lvl.touched
              ? null
              : lvl.touchedTime != null
                ? new Date(lvl.touchedTime * 1000).toISOString()
                : justTouched
                  ? new Date().toISOString()
                  : existing?.end_time ?? new Date().toISOString();

            const { error: upsertLiqError } = await supabase.from("liquidity_levels").upsert(
              {
                instrument: cfg.instrument,
                timeframe: tf.label,
                direction: lvl.direction,
                price: lvl.price,
                pivot_time: new Date(lvl.pivotTime * 1000).toISOString(),
                touched: lvl.touched,
                end_time: endTimeIso,
                alert_price: justTouched ? currentPrice : existing?.alert_price ?? null,
                notified: existing ? existing.notified || justTouched : lvl.touched,
                notified_at: justTouched && existing && alarmActive ? new Date().toISOString() : existing?.notified_at ?? null,
              },
              { onConflict: "instrument,timeframe,direction,pivot_time" },
            );
            if (upsertLiqError) throw upsertLiqError;

            // Neue Level, die schon beim ersten Erkennen touched sind, waeren ein
            // historischer Alt-Touch (z.B. direkt nach Deploy) — kein "jetzt gerade".
            if (justTouched && existing && alarmActive) {
              liqNotifiedCount++;
              const label = lvl.direction === "high" ? "Hoch" : "Tief";
              await sendTelegram(
                `💧 ${cfg.instrument} ${tf.label} Liquiditäts-Level (${label}) angetestet\n` +
                  `Level: ${fmt(lvl.price, cfg.pricePrecision)}\n` +
                  `Preis: ${fmt(currentPrice, cfg.pricePrecision)}`,
              );
            }
          }

          // Bug-Report Philip 2026-08-23: ein Feb-Pivot (weit außerhalb des rollierenden
          // FOREX_H1_LOOKBACK_CANDLES-Fensters) wurde am 21.08. um 09:00 UTC (Stundenkerze, also
          // exakt der isH1RefreshTick-Zeitpunkt) tatsächlich vom Preis erreicht, blieb aber für
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
            const touchedNow = row.direction === "high" ? currentPrice >= row.price : currentPrice <= row.price;
            if (!touchedNow) continue;

            const { error: updateOffWindowLiqError } = await supabase
              .from("liquidity_levels")
              .update({
                touched: true,
                notified: true,
                alert_price: currentPrice,
                end_time: new Date().toISOString(),
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
                  `Preis: ${fmt(currentPrice, cfg.pricePrecision)}`,
              );
            }
          }

          instrumentSummary[`${tf.label}_liquidity`] = { levelsSeen: levels.length, notified: liqNotifiedCount };
        } else {
          // Skip-Tick (siehe isH1RefreshTick/isH4RefreshTick oben): keine frischen Kerzen für
          // diesen Timeframe, also auch keine neuen Fraktale möglich — nur den DB-Stand gegen den
          // aktuellen Preis pruefen, gleiches Muster wie beim OB-Zonen-Skip-Pfad.
          for (const row of existingLiqRows ?? []) {
            if (row.touched) continue;
            const touchedNow = row.direction === "high" ? currentPrice >= row.price : currentPrice <= row.price;
            if (!touchedNow) continue;

            const { error: updateLiqError } = await supabase
              .from("liquidity_levels")
              .update({
                touched: true,
                notified: true,
                alert_price: currentPrice,
                end_time: new Date().toISOString(),
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
                  `Preis: ${fmt(currentPrice, cfg.pricePrecision)}`,
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

        const tradeSetupParams = {
          graceSec: TRADE_SETUP_GRACE_SEC,
          lsMaxLeadSecH1: TRADE_SETUP_LS_MAX_LEAD_SEC_H1,
          lsMaxLeadSecM5: TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
          maxDistanceM5: TRADE_SETUP_LS_MAX_DISTANCE_M5,
          maxLookbackSec: TRADE_SETUP_LOOKBACK_SEC,
          obMaxDelaySec: TRADE_SETUP_OB_MAX_DELAY_SEC,
          nowTime: m5Candles[m5Candles.length - 1].time,
        };

        const detected = [
          detectTradeSetup(1, m5Highs, h1HighsSetup, m5Highs, setupObs, tradeSetupParams, m5Candles),
          detectTradeSetup(-1, m5Lows, h1LowsSetup, m5Lows, setupObs, tradeSetupParams, m5Candles),
        ].filter((s): s is NonNullable<typeof s> => s !== null);

        const { data: existingSetupRows, error: setupSelectError } = await supabase
          .from("trade_setups")
          .select("direction, fractal_pivot_time")
          .eq("instrument", cfg.instrument);
        if (setupSelectError) throw setupSelectError;

        const existingSetupKeys = new Set(
          (existingSetupRows ?? []).map(
            (r) => `${r.direction}_${Math.floor(new Date(r.fractal_pivot_time).getTime() / 1000)}`,
          ),
        );
        const hasAnySetupRow = { short: false, long: false };
        for (const r of existingSetupRows ?? []) hasAnySetupRow[r.direction as "short" | "long"] = true;

        let tradeSetupNotifiedCount = 0;
        for (const setup of detected) {
          const direction: "short" | "long" = setup.dir === 1 ? "short" : "long";
          const key = `${direction}_${setup.fractal.pivotTime}`;
          if (existingSetupKeys.has(key)) continue; // schon erkannt/gespeichert — ein Fraktal bricht nie "zurück"

          // Erstes Setup überhaupt für dieses Instrument+Richtung (kein "existing" überhaupt)
          // ist ein Alt-Bestand direkt nach Deploy, kein "gerade eben" — kein Alarm, analog zum
          // ob_zones/liquidity_levels-Verhalten beim allerersten Lauf.
          const shouldAlert = hasAnySetupRow[direction] && alarmActive;

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

          const { error: setupUpsertError } = await supabase.from("trade_setups").upsert(
            {
              instrument: cfg.instrument,
              direction,
              fractal_price: setup.fractal.price,
              fractal_pivot_time: new Date(setup.fractal.pivotTime * 1000).toISOString(),
              ls_price: setup.ls.price,
              ls_pivot_time: new Date(setup.ls.pivotTime * 1000).toISOString(),
              ls_touched_time: new Date(setup.ls.touchedTime! * 1000).toISOString(),
              ob_top: setup.obTop,
              ob_bottom: setup.obBottom,
              ob_start_time: new Date(setup.obStartTime * 1000).toISOString(),
              ob_zone_id: setupObZone.id,
              alert_price: currentPrice,
              notified: shouldAlert,
              notified_at: shouldAlert ? new Date().toISOString() : null,
            },
            { onConflict: "instrument,direction,fractal_pivot_time" },
          );
          if (setupUpsertError) throw setupUpsertError;

          if (shouldAlert) {
            tradeSetupNotifiedCount++;
            const label = direction === "short" ? "Short (Protected High)" : "Long (Protected Low)";
            await sendTelegram(
              `🎯 ${cfg.instrument} Trade-Setup: ${label}\n` +
                `Protected: ${fmt(setup.fractal.price, cfg.pricePrecision)}\n` +
                `LS-Sweep: ${fmt(setup.ls.price, cfg.pricePrecision)}\n` +
                `M5-OB: ${fmt(setup.obBottom, cfg.pricePrecision)} – ${fmt(setup.obTop, cfg.pricePrecision)}\n` +
                `Preis: ${fmt(currentPrice, cfg.pricePrecision)}`,
            );
          }
        }

        instrumentSummary["tradeSetups"] = { detected: detected.length, notified: tradeSetupNotifiedCount };
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
