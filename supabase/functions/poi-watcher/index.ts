// D2 (vereinfacht): 4H+1H-Zonen-Wächter, jetzt Multi-Instrument (BTC-USDT via OKX,
// GBPUSD/EURUSD via cTrader). Erkennt Order-Block-Zonen, persistiert sie in `ob_zones` und
// schickt eine Telegram-Nachricht, sobald eine Zone zum ersten Mal vom Preis berührt wird —
// aber nur für Instrumente mit `sendTelegram: true` (siehe INSTRUMENTS unten). BTC lief nur
// zum Testen der Pipeline; Philip tradet Forex, daher jetzt GBPUSD/EURUSD live, BTC stumm
// (Zonen werden weiter erkannt/im Dashboard angezeigt, nur der Versand ist aus). Kein M1/
// Claude-Entry-Check (D3) — das kommt erst, wenn die Strategie ein Regelwerk für Claude hat.
import { createClient } from "npm:@supabase/supabase-js@2";
import { detectOrderBlocks, type Candle } from "../_shared/orderBlocks.ts";
import { fetchTrendbarsBatch } from "../_shared/ctrader/client.ts";

const OKX_BASE_URL = "https://www.okx.com";
const TIMEFRAMES: { label: "4H" | "1H"; okxBar: string; ctraderPeriod: string }[] = [
  { label: "4H", okxBar: "4H", ctraderPeriod: "H4" },
  { label: "1H", okxBar: "1H", ctraderPeriod: "H1" },
];
const CANDLE_LIMIT = 300;

interface InstrumentConfig {
  instrument: string;
  source: "okx" | "ctrader";
  sendTelegram: boolean;
  pricePrecision: number;
}

const INSTRUMENTS: InstrumentConfig[] = [
  { instrument: "BTC-USDT", source: "okx", sendTelegram: false, pricePrecision: 2 },
  { instrument: "GBPUSD", source: "ctrader", sendTelegram: true, pricePrecision: 5 },
  { instrument: "EURUSD", source: "ctrader", sendTelegram: true, pricePrecision: 5 },
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const DRY_RUN = (Deno.env.get("DRY_RUN") ?? "false").toLowerCase() === "true";
const CTRADER_CLIENT_ID = Deno.env.get("CTRADER_CLIENT_ID")!;
const CTRADER_CLIENT_SECRET = Deno.env.get("CTRADER_CLIENT_SECRET")!;
const CTRADER_ACCESS_TOKEN = Deno.env.get("CTRADER_ACCESS_TOKEN")!;

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

// Ein Connect/Auth-Handshake pro Forex-Instrument statt drei (Preis + je Timeframe) — holt
// den "aktuellen Preis" (Close der letzten M1-Bar, kein eigener Ticker-Endpunkt verdrahtet)
// und alle Timeframe-Kerzen in einem Rutsch. Reihenfolge der Requests = Reihenfolge der
// Ergebnisse: [M1-Preis-Bar, ...TIMEFRAMES].
async function fetchCtraderBatch(symbol: string): Promise<{ currentPrice: number; candlesByTf: Map<string, Candle[]> }> {
  const [priceBars, ...tfCandles] = await fetchTrendbarsBatch({
    clientId: CTRADER_CLIENT_ID,
    clientSecret: CTRADER_CLIENT_SECRET,
    accessToken: CTRADER_ACCESS_TOKEN,
    requests: [
      { symbolName: symbol, period: "M1", count: 1 },
      ...TIMEFRAMES.map((tf) => ({ symbolName: symbol, period: tf.ctraderPeriod, count: CANDLE_LIMIT })),
    ],
  });
  const candlesByTf = new Map(TIMEFRAMES.map((tf, i) => [tf.label, tfCandles[i]]));
  return { currentPrice: priceBars[priceBars.length - 1].close, candlesByTf };
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
  return minutesSinceMidnight >= 8 * 60 && minutesSinceMidnight < 17 * 60 + 30;
}

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const tradingHours = isTradingHours(new Date());
    const summary: Record<string, unknown> = { dryRun: DRY_RUN, tradingHours, instruments: {} };

    for (const cfg of INSTRUMENTS) {
      const ctraderBatch = cfg.source === "ctrader" ? await fetchCtraderBatch(cfg.instrument) : null;
      const currentPrice = cfg.source === "okx" ? await fetchOkxPrice(cfg.instrument) : ctraderBatch!.currentPrice;
      // Zonen werden für jedes Instrument immer erkannt/gespeichert (Dashboard-Charts brauchen
      // das weiterhin) — `shouldSend` entscheidet nur, ob dafür auch wirklich eine
      // Telegram-Nachricht rausgeht (BTC: nie, per `sendTelegram: false`; sonst: nur innerhalb
      // der Trading-Session).
      const shouldSend = cfg.sendTelegram && tradingHours;
      const instrumentSummary: Record<string, unknown> = {};

      for (const tf of TIMEFRAMES) {
        const candles =
          cfg.source === "okx" ? await fetchOkxCandles(cfg.instrument, tf.okxBar) : ctraderBatch!.candlesByTf.get(tf.label)!;
        const zones = detectOrderBlocks(candles);

        const { data: existingRows, error: selectError } = await supabase
          .from("ob_zones")
          .select("start_time, direction, touched, notified, notified_at")
          .eq("instrument", cfg.instrument)
          .eq("timeframe", tf.label);
        if (selectError) throw selectError;

        const existingMap = new Map(
          (existingRows ?? []).map((r) => [
            `${r.direction}_${Math.floor(new Date(r.start_time).getTime() / 1000)}`,
            r,
          ]),
        );

        let notifiedCount = 0;
        for (const z of zones) {
          const direction = z.dir === 1 ? "long" : "short";
          const existing = existingMap.get(`${direction}_${z.startTime}`);
          const wasTouchedInDb = existing?.touched ?? false;

          // Live-Preis-Touch: cTrader liefert nur geschlossene Kerzen, d.h. ohne das hier
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
              notified: existing ? existing.notified || justTouched : z.touched,
              // notified_at nur bei einem echten Versand setzen (existing muss vorhanden sein,
              // sonst ist es ein historischer Alt-Touch ohne echten Alarm) — sonst würde ein
              // beim Deploy schon getouchtes Alt-Zone-Backlog faelschlich den Deploy-Zeitpunkt
              // als "gerade eben benachrichtigt" zeigen.
              notified_at: justTouched && existing && shouldSend ? new Date().toISOString() : existing?.notified_at ?? null,
            },
            { onConflict: "instrument,timeframe,start_time,direction" },
          );
          if (upsertError) throw upsertError;

          // Bei brandneuen Zonen (kein `existing`), die schon beim ersten Erkennen touched
          // sind, nicht alarmieren — das waere ein historischer Alt-Touch, kein "jetzt gerade".
          if (justTouched && existing && shouldSend) {
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
