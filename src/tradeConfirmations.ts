// Gemeinsame Darstellung für Trade-Bestätigungen (Sweep oder OB, siehe PLAN-trade-confluences.md
// #1: "von welchen Sweeps kam die Kraft für die Long/Short-Bewegung? ... auch OBs") — Gegenstück
// zu tradeTargets.ts: ein Target ist eine zukünftige Preis-Erwartung, eine Bestätigung ist bereits
// passierte Evidenz, die den Trade begründet. Teilt sich die Klick-Infrastruktur (PriceChart.vue:
// findClickedTarget) und die Alters-Einstufung (ageTier.ts) mit Targets, hat aber eine eigene
// Tabelle (trade_confirmations) und eigene Beschriftung ("Sweep" statt "Pivot").
import { businessSecondsBetween, formatAge } from "./chartTimeUtils.js";
import { classifyAge, type AgeTier } from "./ageTier";
import { fmtPrice, pricePrecisionForInstrument } from "./format.js";

export type TradeConfirmationKind = "pivot" | "ob" | "fib" | "rsi_divergence";

export interface TradeConfirmation {
  id: number;
  price: number;
  kind: TradeConfirmationKind;
  sourceTime: number | null;
  touchedTime: number | null;
  // Nur bei kind='fib' gesetzt (siehe marketStructureAnalysis.ts: computeFibLevels) — die zwei
  // Ankerpreise, aus denen `price` (der 0,5-Wert) abgeleitet wurde. Ohne diese wäre ein
  // gespeichertes Fib später nicht mehr nachvollziehbar, sobald die live berechnete Range
  // weitergewandert ist (der ganze Grund, wieso Philip das als Trade-Bestätigung festhalten will).
  rangeLow: number | null;
  rangeHigh: number | null;
  // Nur bei kind='rsi_divergence' gesetzt (siehe src/rsi.js: detectRsiDivergence/-History) —
  // sourceTime/touchedTime tragen bereits fromTime/toTime, price bereits toPrice (wie 'ob' den
  // nahen Zonen-Rand als price führt); diese drei zusätzlichen Felder machen die Divergenz später
  // wieder als vollständigen Zwei-Bein-Konnektor zeichenbar (DivergenceLinePrimitive), nicht nur
  // als einzelne Linie.
  fromPrice: number | null;
  fromRsi: number | null;
  toRsi: number | null;
  divergenceType: "bearish" | "bullish" | null;
}

// "Sweep" statt "Pivot" (anders als tradeTargets.ts: kindLabel) — eine Bestätigung ist per
// Definition schon geschehen, "Pivot" allein würde das nicht ausdrücken.
const KIND_LABEL: Record<TradeConfirmationKind, string> = { pivot: "Sweep", ob: "OB", fib: "Fib", rsi_divergence: "Div" };

export function kindLabel(kind: TradeConfirmationKind): string {
  return KIND_LABEL[kind] ?? kind;
}

function confirmationAgeSeconds(confirmation: TradeConfirmation, nowSec: number): number | null {
  if (confirmation.sourceTime == null) return null;
  const reference = confirmation.touchedTime ?? nowSec;
  return businessSecondsBetween(confirmation.sourceTime, reference);
}

export function confirmationAgeTier(confirmation: TradeConfirmation, nowSec: number): AgeTier | null {
  const seconds = confirmationAgeSeconds(confirmation, nowSec);
  return seconds == null ? null : classifyAge(seconds);
}

// "Sweep 1,33195 · medium (3d alt) #18" — ohne sourceTime (sollte praktisch nicht vorkommen, eine
// Bestätigung wird ja gerade WEIL sie schon passiert ist gewählt) nur "Sweep 1,33195 #18". Bei
// kind='fib' zusätzlich die zwei Ankerpreise ("Fib 1,33195 (1,3273–1,3387) · ..."), sonst wäre der
// 0,5-Preis allein später nicht mehr nachvollziehbar (siehe rangeLow/rangeHigh-Kommentar oben).
// #<id> am Ende (Bug-Report Philip 2026-07-31: Chart-Box zeigte "#18", Modal-Zeile für dieselbe
// Bestätigung gar keine Id) matcht 1:1 das Chart-Label (PriceChart.vue:
// refreshTradeConfirmationLinksInternal), damit sich Modal-Zeile und Chart-Box eindeutig zuordnen
// lassen — wie schon bei formatTargetLabel.
export function formatConfirmationLabel(confirmation: TradeConfirmation, instrument: string, nowSec: number): string {
  const precision = pricePrecisionForInstrument(instrument);
  const price = fmtPrice(confirmation.price, precision);
  const kind = kindLabel(confirmation.kind);
  const rangeHint =
    confirmation.kind === "fib" && confirmation.rangeLow != null && confirmation.rangeHigh != null
      ? ` (${fmtPrice(confirmation.rangeLow, precision)}–${fmtPrice(confirmation.rangeHigh, precision)})`
      : confirmation.kind === "rsi_divergence" && confirmation.fromPrice != null
        ? ` (${confirmation.divergenceType === "bearish" ? "▽" : "△"} ${fmtPrice(confirmation.fromPrice, precision)}→${price})`
        : "";
  const seconds = confirmationAgeSeconds(confirmation, nowSec);
  if (seconds == null) return `${kind} ${price}${rangeHint} #${confirmation.id}`;
  const tier = classifyAge(seconds);
  const age = formatAge(seconds);
  return `${kind} ${price}${rangeHint} · ${tier}${age ? ` (${age} alt)` : ""} #${confirmation.id}`;
}
