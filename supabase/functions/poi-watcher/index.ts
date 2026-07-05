// D2 (vereinfacht): 4H+1H-Zonen-Wächter für BTC-USDT. Erkennt Order-Block-Zonen aus
// OKX-Kerzen, persistiert sie in `ob_zones` und schickt eine Telegram-Nachricht, sobald
// eine Zone zum ersten Mal vom Preis berührt wird. Kein M1/Claude-Entry-Check (D3) —
// das kommt erst, wenn die Strategie ein Regelwerk für Claude hat.
import { createClient } from "npm:@supabase/supabase-js@2";
import { detectOrderBlocks, type Candle } from "../_shared/orderBlocks.ts";

const OKX_BASE_URL = "https://www.okx.com";
const INST_ID = "BTC-USDT";
const TIMEFRAMES: { label: "4H" | "1H"; bar: string }[] = [
  { label: "4H", bar: "4H" },
  { label: "1H", bar: "1H" },
];
const CANDLE_LIMIT = 300;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const DRY_RUN = (Deno.env.get("DRY_RUN") ?? "false").toLowerCase() === "true";

async function fetchCandles(bar: string): Promise<Candle[]> {
  const url = `${OKX_BASE_URL}/api/v5/market/candles?instId=${INST_ID}&bar=${bar}&limit=${CANDLE_LIMIT}`;
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

async function fetchCurrentPrice(): Promise<number> {
  const res = await fetch(`${OKX_BASE_URL}/api/v5/market/ticker?instId=${INST_ID}`);
  const json = await res.json();
  if (json.code !== "0") throw new Error(`OKX ticker error ${json.code}: ${json.msg}`);
  return Number(json.data[0].last);
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

function fmt(n: number) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

// Schlaffenster 23-5 Uhr lokal (Europe/Berlin) — Zonen werden weiterhin normal erkannt/
// upgedatet (Kontinuität für die touched-Erkennung), nur der Telegram-Versand pausiert.
function isQuietHours(date: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(date),
  );
  return hour >= 23 || hour < 5;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const currentPrice = await fetchCurrentPrice();
  const quietHours = isQuietHours(new Date());
  const summary: Record<string, unknown> = {
    instrument: INST_ID,
    currentPrice,
    dryRun: DRY_RUN,
    quietHours,
    timeframes: {},
  };

  for (const tf of TIMEFRAMES) {
    const candles = await fetchCandles(tf.bar);
    const zones = detectOrderBlocks(candles);

    const { data: existingRows, error: selectError } = await supabase
      .from("ob_zones")
      .select("start_time, direction, touched, invalidated, notified, notified_at, touched_at, invalidated_at")
      .eq("instrument", INST_ID)
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
      const justTouched = z.touched && !(existing?.touched ?? false);
      const justInvalidated = z.invalidated && !(existing?.invalidated ?? false);

      const { error: upsertError } = await supabase.from("ob_zones").upsert(
        {
          instrument: INST_ID,
          timeframe: tf.label,
          direction,
          top: z.top,
          bottom: z.bottom,
          weak: z.weak,
          touched: z.touched,
          invalidated: z.invalidated,
          start_time: new Date(z.startTime * 1000).toISOString(),
          notified: existing ? existing.notified || justTouched : z.touched,
          // notified_at nur bei einem echten Versand setzen (existing muss vorhanden sein,
          // sonst ist es ein historischer Alt-Touch ohne echten Alarm) — sonst würde ein
          // beim Deploy schon getouchtes Alt-Zone-Backlog faelschlich den Deploy-Zeitpunkt
          // als "gerade eben benachrichtigt" zeigen.
          notified_at: justTouched && existing ? new Date().toISOString() : existing?.notified_at ?? null,
          // touched_at/invalidated_at: unabhaengig vom Versand immer beim jeweiligen
          // Uebergang eingefroren — fuers Protokoll (immer sichtbare Zeit) und fuers
          // Chart (Zonen-Box dort stoppen, nicht bis "jetzt" weiterziehen).
          touched_at: justTouched ? new Date().toISOString() : existing?.touched_at ?? null,
          invalidated_at: justInvalidated ? new Date().toISOString() : existing?.invalidated_at ?? null,
        },
        { onConflict: "instrument,timeframe,start_time,direction" },
      );
      if (upsertError) throw upsertError;

      // Bei brandneuen Zonen (kein `existing`), die schon beim ersten Erkennen touched
      // sind, nicht alarmieren — das waere ein historischer Alt-Touch, kein "jetzt gerade".
      // Waehrend der Schlaf-Ruhezeit (23-5 Uhr) wird der Touch trotzdem als notified
      // vermerkt (kein nachtraeglicher Alarm beim Aufwachen), nur der Versand entfaellt.
      if (justTouched && existing) {
        if (!quietHours) {
          notifiedCount++;
          const label = direction === "long" ? "Bullish" : "Bearish";
          await sendTelegram(
            `📍 BTC-USDT ${tf.label} ${label} OB erreicht\n` +
              `Zone: ${fmt(z.bottom)} – ${fmt(z.top)}${z.weak ? " (schwach)" : ""}\n` +
              `Preis: ${fmt(currentPrice)}`,
          );
        }
      }
    }

    (summary.timeframes as Record<string, unknown>)[tf.label] = { zonesSeen: zones.length, notified: notifiedCount };
  }

  return new Response(JSON.stringify(summary), { headers: { "Content-Type": "application/json" } });
});
