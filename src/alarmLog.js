import { supabase } from "./supabaseClient.js";
import { fetchTouchedZones } from "./poiZones.js";
import { fmtPrice, pricePrecisionForInstrument } from "./format.js";

// Rohe (nicht auf Chart-Primitives gemappte) Zeilen fürs Protokoll — analog zu
// fetchTouchedZones in poiZones.js, nur für liquidity_levels statt ob_zones.
async function fetchTouchedLiquidityLevels(instrument) {
  const { data, error } = await supabase
    .from("liquidity_levels")
    .select("*")
    .eq("instrument", instrument)
    .eq("touched", true)
    .order("end_time", { ascending: false });

  if (error) throw error;
  return data;
}

// trade_setups hat keine touched-Spalte — sobald das Fraktal bricht, verschwindet die Zeile
// nie wieder (siehe Migration), jede vorhandene Zeile ist also bereits ein "erreichtes" Setup.
async function fetchTradeSetups(instrument) {
  const { data, error } = await supabase
    .from("trade_setups")
    .select("*")
    .eq("instrument", instrument)
    .order("ls_touched_time", { ascending: false });

  if (error) throw error;
  return data;
}

// Vereinheitlicht alle drei Alarm-Typen (siehe alarmSettings.js ALARM_TYPES) in eine
// gemeinsame, chronologisch sortierte Zeitleiste fürs Protokoll — jeder Typ bringt sein
// eigenes DB-Schema mit, hier nur auf die fürs Protokoll gemeinsamen Anzeige-Felder gemappt.
export async function fetchAlarmLog(instrument) {
  const precision = pricePrecisionForInstrument(instrument);
  const [zones, liquidity, setups] = await Promise.all([
    fetchTouchedZones(instrument),
    fetchTouchedLiquidityLevels(instrument),
    fetchTradeSetups(instrument),
  ]);

  const rows = [
    // time: bevorzugt notified_at, damit die Zeitangabe im Protokoll IMMER exakt mit dem
    // Zeitpunkt der Telegram-Nachricht übereinstimmt (auf Philips Wunsch) — nur wenn nie
    // gesendet (Alarm aus, außerhalb der Session, oder Alt-Bestand vor diesem Feature),
    // fällt es auf die reine Erkennungszeit zurück, damit die Zeile trotzdem einsortierbar bleibt.
    ...zones.map((z) => ({
      id: `ob-${z.id}`,
      time: z.notified_at ?? z.end_time,
      typeLabel: `${z.timeframe} OB`,
      direction: z.direction,
      directionLabel: z.direction === "long" ? "Long" : "Short",
      detail: `${fmtPrice(z.bottom, precision)} – ${fmtPrice(z.top, precision)}${z.weak ? " (schwach)" : ""}`,
      price: fmtPrice(z.alert_price, precision),
      notifiedAt: z.notified_at,
    })),
    ...liquidity.map((l) => ({
      id: `liq-${l.id}`,
      time: l.notified_at ?? l.end_time,
      typeLabel: "1H Liquidität",
      direction: l.direction === "high" ? "short" : "long",
      directionLabel: l.direction === "high" ? "Hoch" : "Tief",
      detail: fmtPrice(l.price, precision),
      price: fmtPrice(l.alert_price, precision),
      notifiedAt: l.notified_at,
    })),
    ...setups.map((s) => ({
      id: `setup-${s.id}`,
      time: s.notified_at ?? s.ls_touched_time,
      typeLabel: "Trade-Setup",
      direction: s.direction,
      directionLabel: s.direction === "long" ? "Long" : "Short",
      detail: `M5-OB ${fmtPrice(s.ob_bottom, precision)} – ${fmtPrice(s.ob_top, precision)}`,
      price: fmtPrice(s.alert_price, precision),
      notifiedAt: s.notified_at,
    })),
  ];

  rows.sort((a, b) => new Date(b.time) - new Date(a.time));
  return rows;
}
