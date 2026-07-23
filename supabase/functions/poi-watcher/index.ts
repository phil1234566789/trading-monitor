// D2 (vereinfacht): 4H+1H-Zonen-Wächter, jetzt Multi-Instrument (BTC-USDT via OKX,
// GBPUSD/EURUSD via Twelve Data). Erkennt Order-Block-Zonen, persistiert sie in `ob_zones` und
// schickt eine Telegram-Nachricht, sobald eine Zone zum ersten Mal vom Preis berührt wird —
// aber nur für Instrumente mit `sendTelegram: true` (siehe INSTRUMENTS unten). BTC lief nur
// zum Testen der Pipeline; Philip tradet Forex, daher jetzt GBPUSD/EURUSD live, BTC stumm
// (Zonen werden weiter erkannt/im Dashboard angezeigt, nur der Versand ist aus). Kein M1/
// Claude-Entry-Check (D3) — das kommt erst, wenn die Strategie ein Regelwerk für Claude hat.
import { createClient } from "npm:@supabase/supabase-js@2";
import { detectOrderBlocks, type Candle } from "../_shared/orderBlocks.ts";
import { detectLiquidityLevels, type LiquidityLevel } from "../_shared/liquidity.ts";
import { fetchCandles as fetchForexCandles } from "../_shared/twelvedata/client.ts";
import { detectSetupObs, detectTradeSetup } from "../_shared/tradeSetup.ts";

const OKX_BASE_URL = "https://www.okx.com";
const TIMEFRAMES: { label: "4H" | "1H"; okxBar: string; forexPeriod: string }[] = [
  { label: "4H", okxBar: "4H", forexPeriod: "4h" },
  { label: "1H", okxBar: "1H", forexPeriod: "1h" },
];
const CANDLE_LIMIT = 300;
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

interface InstrumentConfig {
  instrument: string;
  source: "okx" | "twelvedata";
  sendTelegram: boolean;
  pricePrecision: number;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { instrument: "BTC-USDT", source: "okx", sendTelegram: false, pricePrecision: 2 },
  { instrument: "GBPUSD", source: "twelvedata", sendTelegram: true, pricePrecision: 5 },
  { instrument: "EURUSD", source: "twelvedata", sendTelegram: true, pricePrecision: 5 },
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const DRY_RUN = (Deno.env.get("DRY_RUN") ?? "false").toLowerCase() === "true";
const TWELVEDATA_API_KEY = Deno.env.get("TWELVEDATA_API_KEY")!;

async function fetchOkxCandles(instId: string, bar: string): Promise<Candle[]> {
  const url = `${OKX_BASE_URL}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${CANDLE_LIMIT}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.code !== "0") throw new Error(`OKX candles error ${json.code}: ${json.msg}`);
  return (json.data as string[][])
    .map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
    }))
    .reverse(); // älteste zuerst
}

async function fetchOkxPrice(instId: string): Promise<number> {
  const res = await fetch(`${OKX_BASE_URL}/api/v5/market/ticker?instId=${instId}`);
  const json = await res.json();
  if (json.code !== "0") throw new Error(`OKX ticker error ${json.code}: ${json.msg}`);
  return Number(json.data[0].last);
}

// Nur beim ersten Lauf nach einem 4H-Kerzenschluss neu holen (Chat 2026-07-23: "da ändert
// sich doch in 4h nichts") — 4H-Kerzen werden NUR für die 4H-OB-Zonenerkennung gebraucht,
// sonst nirgends referenziert (anders als 1H, siehe candles1hForSetup), Refetch alle 5min
// war also reine Verschwendung von Twelve-Data-Requests. UTC statt Europe/Berlin, weil sich
// sowohl der pg_cron-Tick als auch Twelve Datas eigene 4H-Bucket-Grenzen an UTC ausrichten.
function isH4RefreshTick(date: Date): boolean {
  return date.getUTCHours() % 4 === 0 && date.getUTCMinutes() === 0;
}

// Ein REST-Call pro Forex-Instrument+Timeframe (parallel statt sequentiell wie beim alten
// cTrader-Handshake — Twelve Data hat keine "mehrere Requests über eine Verbindung"
// Batch-API, das Rate-Limit ist ohnehin pro Minute übers ganze Konto, nicht pro Verbindung).
// Kein eigener M1-Preis-Call mehr (Chat 2026-07-23) — der Close der letzten M5-Kerze reicht
// für den Live-Touch-Check völlig, spart einen von vier Calls pro Instrument.
async function fetchForexBatch(symbol: string, includeH4: boolean): Promise<{ currentPrice: number; candlesByTf: Map<string, Candle[]> }> {
  const [h1Candles, m5Candles, h4Candles] = await Promise.all([
    fetchForexCandles({ apiKey: TWELVEDATA_API_KEY, symbolName: symbol, period: "1h", count: CANDLE_LIMIT }),
    fetchForexCandles({ apiKey: TWELVEDATA_API_KEY, symbolName: symbol, period: "5m", count: TRADE_SETUP_M5_CANDLE_LIMIT }),
    includeH4 ? fetchForexCandles({ apiKey: TWELVEDATA_API_KEY, symbolName: symbol, period: "4h", count: CANDLE_LIMIT }) : Promise.resolve(null),
  ]);
  const candlesByTf = new Map<string, Candle[]>([["1H", h1Candles], ["M5", m5Candles]]);
  if (h4Candles) candlesByTf.set("4H", h4Candles);
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

// Trading-Session-Fenster 8:00-17:30 lokal (Europe/Berlin) — Zonen werden weiterhin normal
// erkannt/upgedatet (Kontinuität für die touched-Erkennung, kein Nachhol-Alarm-Schwall beim
// Fenster-Start), nur der Telegram-Versand ist auf die Session begrenzt. Cron laeuft bewusst
// trotzdem rund um die Uhr weiter (siehe poi_watcher_cron Migration) — wuerde der Cron selbst
// pausieren, wuerden ueber Nacht liegengebliebene Touches beim naechsten Lauf faelschlich als
// "gerade eben" markiert und alle auf einmal gemeldet.
function isTradingHours(date: Date): boolean {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= TRADING_START_MIN && minutesSinceMidnight < TRADING_END_MIN;
}

// Nachts (außerhalb der Trading-Session) werden fürs Forex-Zonen-Fetching keine Twelve-Data-
// Requests gebraucht (Philip schläft, kein Alarm um 18/22/3 Uhr bringt was) — spart den
// Großteil der ~2.300 Twelve-Data-Calls/Tag, die der 24/7-Cron sonst verursacht hätte (Free-
// Tier: 800/Tag, 8/Min). FETCH_START_BUFFER_MIN Minuten VOR Sessionstart schon wieder holen
// (nicht erst genau um 8:00) — ein einziger Lauf davor reicht, um über Nacht liegengebliebene
// Touches noch außerhalb der Session (shouldSend=false) still nachzuholen, damit beim
// tatsächlichen Sessionstart kein Nachhol-Alarm-Schwall für längst vergangene Touches losgeht
// (gleicher Grund wie beim 24/7-Cron davor, nur jetzt auf ein kurzes Vorlauf-Fenster verkürzt).
const TRADING_START_MIN = 8 * 60;
const TRADING_END_MIN = 17 * 60 + 30;
const FETCH_START_BUFFER_MIN = 10;

function isForexFetchWindow(date: Date): boolean {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= TRADING_START_MIN - FETCH_START_BUFFER_MIN && minutesSinceMidnight < TRADING_END_MIN;
}

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const tradingHours = isTradingHours(new Date());

    // Ein/Aus-Schalter je Alarm-Typ (siehe "Alarme"-Seite im Dashboard) — steuert NUR den
    // Telegram-Versand, nie die Erkennung/Persistierung selbst (siehe Kommentare unten an den
    // einzelnen shouldSend-Stellen). Fail-open (fehlende Zeile = an), falls die Migration mal
    // hinter einem neuen Key zurückhängt — ein stiller Alarm-Ausfall wäre schlimmer als ein
    // ungewollter Alarm.
    const { data: alarmRows, error: alarmSelectError } = await supabase.from("alarm_settings").select("key, enabled");
    if (alarmSelectError) throw alarmSelectError;
    const alarmEnabledMap = new Map((alarmRows ?? []).map((r) => [r.key, r.enabled]));
    const isAlarmOn = (key: string) => alarmEnabledMap.get(key) ?? true;

    const now = new Date();
    const forexFetchWindow = isForexFetchWindow(now);
    const h4RefreshTick = isH4RefreshTick(now);
    const summary: Record<string, unknown> = { dryRun: DRY_RUN, tradingHours, forexFetchWindow, instruments: {} };

    for (const cfg of INSTRUMENTS) {
      if (cfg.source === "twelvedata" && !forexFetchWindow) {
        (summary.instruments as Record<string, unknown>)[cfg.instrument] = { skipped: "outside forex fetch window" };
        continue;
      }
      const forexBatch = cfg.source === "twelvedata" ? await fetchForexBatch(cfg.instrument, h4RefreshTick) : null;
      const currentPrice = cfg.source === "okx" ? await fetchOkxPrice(cfg.instrument) : forexBatch!.currentPrice;
      // Zonen werden für jedes Instrument immer erkannt/gespeichert (Dashboard-Charts brauchen
      // das weiterhin) — `shouldSend` entscheidet nur, ob dafür auch wirklich eine
      // Telegram-Nachricht rausgeht (BTC: nie, per `sendTelegram: false`; sonst: nur innerhalb
      // der Trading-Session).
      const shouldSend = cfg.sendTelegram && tradingHours;
      const instrumentSummary: Record<string, unknown> = {};

      for (const tf of TIMEFRAMES) {
        // z.B. "ob_zone_4h"/"ob_zone_1h" — je Timeframe einzeln umschaltbar.
        const alarmActive = shouldSend && isAlarmOn(`ob_zone_${tf.label.toLowerCase()}`);
        const candles =
          cfg.source === "okx" ? await fetchOkxCandles(cfg.instrument, tf.okxBar) : forexBatch!.candlesByTf.get(tf.label);

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
          // mergen. Läuft bei 1H/OKX jeden Tick, bei 4H nur an isH4RefreshTick-Ticks (siehe
          // fetchForexBatch).
          const zones = detectOrderBlocks(candles);
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

            // Live-Preis-Touch: Twelve Data liefert nur geschlossene Kerzen, d.h. ohne das hier
            // wuerde ein Touch erst erkannt, wenn die volle 1H/4H-Kerze schliesst (bis zu 59min
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

      // 1H-Liquiditäts-Level (Fractal-Sweeps, siehe src/liquidity.js) — nur für die
      // Forex-Instrumente (GBPUSD/EURUSD), Philip wollte das explizit nicht für BTC.
      // Gleiches Live-Preis-Sofort-Touch-Muster wie oben bei den OB-Zonen (Twelve Data liefert
      // nur geschlossene Kerzen, sonst bis zu 59min Verzoegerung bis zum Alarm).
      if (cfg.source === "twelvedata") {
        const alarmActive = shouldSend && isAlarmOn("liquidity_1h");
        const candles1h = forexBatch!.candlesByTf.get("1H")!;
        const { highs, lows } = detectLiquidityLevels(candles1h, LIQUIDITY_FRACTAL_PERIOD);
        const levels = [
          ...highs.map((l) => ({ ...l, direction: "high" as const })),
          ...lows.map((l) => ({ ...l, direction: "low" as const })),
        ];

        const { data: existingLiqRows, error: liqSelectError } = await supabase
          .from("liquidity_levels")
          .select("pivot_time, direction, touched, notified, notified_at, end_time, alert_price")
          .eq("instrument", cfg.instrument)
          .eq("timeframe", "1H");
        if (liqSelectError) throw liqSelectError;

        const existingLiqMap = new Map(
          (existingLiqRows ?? []).map((r) => [
            `${r.direction}_${Math.floor(new Date(r.pivot_time).getTime() / 1000)}`,
            r,
          ]),
        );

        let liqNotifiedCount = 0;
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
              timeframe: "1H",
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
              `💧 ${cfg.instrument} 1H Liquiditäts-Level (${label}) angetestet\n` +
                `Level: ${fmt(lvl.price, cfg.pricePrecision)}\n` +
                `Preis: ${fmt(currentPrice, cfg.pricePrecision)}`,
            );
          }
        }

        instrumentSummary["1H_liquidity"] = { levelsSeen: levels.length, notified: liqNotifiedCount };
      }

      // Trade-Setup: Liquidity Sweep + Protected M5-Fraktal + M5-OB, in dieser Reihenfolge
      // (siehe tv-indikator/src/tradesetup.pine, portiert nach _shared/tradeSetup.ts). Läuft
      // nur für die Forex-Instrumente — braucht M5-Kerzen, die nur dort abgerufen werden.
      // dir=1 (Short/Protected High) und dir=-1 (Long/Protected Low) laufen mit denselben
      // Kerzen, nur gespiegelt (siehe checkShortSetup/checkLongSetup im Original).
      if (cfg.source === "twelvedata") {
        const alarmActive = shouldSend && isAlarmOn("trade_setup");
        const m5Candles = forexBatch!.candlesByTf.get("M5")!;
        const candles1hForSetup = forexBatch!.candlesByTf.get("1H")!;
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
          detectTradeSetup(1, m5Highs, h1HighsSetup, m5Highs, setupObs, tradeSetupParams),
          detectTradeSetup(-1, m5Lows, h1LowsSetup, m5Lows, setupObs, tradeSetupParams),
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
