// Filter der Pin-Liste (Asset, Objektzeitpunkt, Chart-Objekt) — rein lokal auf den schon geladenen Pins, ohne DB.
import { chartObjectType } from "./chartObjectRegistry.js";

// Lesbare Namen der festen Pin-Arten; Registry-Arten bringen ihren Namen selbst mit (def.name).
const KIND_NAMES = {
  trade_position: "Trade", ob_zone: "OB-Zone", trade_setup: "Trade-Setup", trade_confirmation: "Bestätigung",
  liquidity_level: "LQ-Level (HTF)", m5_liquidity_level: "LQ-Level", rsi_divergence: "RSI-Divergenz",
  double_order_block: "Doppel-OB", dob_trade: "DOB-Trade", simulation_dr: "Simulations-DR",
  simulation_checkpoint: "Simulations-Checkpoint", simulation_entry: "Simulations-Entry",
};

export function pinTypeKey(entry) {
  return entry.kind === "chart_object" ? `chart_object:${entry.chartObject.type}` : entry.kind;
}

export function pinTypeName(typeKey) {
  if (typeKey.startsWith("chart_object:")) {
    const type = typeKey.slice("chart_object:".length);
    return chartObjectType(type)?.name ?? type;
  }
  return KIND_NAMES[typeKey] ?? typeKey;
}

const tradeOf = (entry, trades) => (entry.kind === "trade_position" ? trades.find((t) => t.id === entry.tradePositionId) : null);

export function pinInstrument(entry, trades = []) {
  return entry.chartObject?.instrument ?? entry.obZone?.instrument ?? entry.liquidityLevel?.instrument ?? entry.m5Liquidity?.instrument
    ?? entry.rsiDivergence?.instrument ?? entry.tradeSetup?.instrument ?? entry.dobContext?.pair?.instrument
    ?? entry.dobTradeContext?.instrument ?? entry.simulationContext?.instrument ?? tradeOf(entry, trades)?.instrument ?? null;
}

const toSec = (v) => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : /^\d+$/.test(v) ? Number(v) : Date.parse(v) / 1000;
  return Number.isFinite(n) ? (n > 1e12 ? n / 1000 : n) : null;
};

function objectTime(entry, trades) {
  switch (entry.kind) {
    case "chart_object": return chartObjectType(entry.chartObject.type)?.time(entry.chartObject.snapshot);
    case "ob_zone": return entry.obZone?.startTime;
    case "liquidity_level": return entry.liquidityLevel?.pivotTime;
    case "m5_liquidity_level": return entry.m5Liquidity?.pivotTime;
    case "rsi_divergence": return entry.rsiDivergence?.fromTime;
    case "trade_setup": return entry.tradeSetup?.obStartTime;
    case "trade_confirmation": return entry.tradeConfirmation?.touchedTime;
    case "double_order_block": return entry.dobContext?.pair?.firstOrderBlock?.startTime;
    case "dob_trade": return entry.dobTradeContext?.entry_time;
    case "trade_position": return tradeOf(entry, trades)?.entryTime;
    default: return entry.simulationContext?.entry?.time?.unix ?? entry.simulationContext?.recognizedAt?.unix;
  }
}

// { time: Unix-Sekunden, fromCreatedAt } — ohne bekannten Objektzeitpunkt zählt der Anlegezeitpunkt des Pins.
export function pinTime(entry, trades = []) {
  const time = toSec(objectTime(entry, trades));
  return time != null ? { time, fromCreatedAt: false } : { time: toSec(entry.createdAt), fromCreatedAt: true };
}

// filter: { instruments: [] = alle, types: [] = alle, from/to: Unix-Sekunden oder null }
export function filterPins(entries, filter, trades = []) {
  const { instruments = [], types = [], from = null, to = null } = filter ?? {};
  return entries.filter((e) => {
    if (instruments.length && !instruments.includes(pinInstrument(e, trades))) return false;
    if (types.length && !types.includes(pinTypeKey(e))) return false;
    if (from == null && to == null) return true;
    const { time } = pinTime(e, trades);
    return time != null && (from == null || time >= from) && (to == null || time <= to);
  });
}
