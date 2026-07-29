// Gemeinsame Darstellung für Trade-Bestätigungen (Sweep oder OB, siehe PLAN-trade-confluences.md
// #1: "von welchen Sweeps kam die Kraft für die Long/Short-Bewegung? ... auch OBs") — Gegenstück
// zu tradeTargets.ts: ein Target ist eine zukünftige Preis-Erwartung, eine Bestätigung ist bereits
// passierte Evidenz, die den Trade begründet. Teilt sich die Klick-Infrastruktur (PriceChart.vue:
// findClickedTarget) und die Alters-Einstufung (ageTier.ts) mit Targets, hat aber eine eigene
// Tabelle (trade_confirmations) und eigene Beschriftung ("Sweep" statt "Pivot").
import { businessSecondsBetween, formatAge } from "./chartTimeUtils.js";
import { classifyAge, type AgeTier } from "./ageTier";
import { fmtPrice, pricePrecisionForInstrument } from "./format.js";

export type TradeConfirmationKind = "pivot" | "ob";

export interface TradeConfirmation {
  id: number;
  price: number;
  kind: TradeConfirmationKind;
  sourceTime: number | null;
  touchedTime: number | null;
}

// "Sweep" statt "Pivot" (anders als tradeTargets.ts: kindLabel) — eine Bestätigung ist per
// Definition schon geschehen, "Pivot" allein würde das nicht ausdrücken.
const KIND_LABEL: Record<TradeConfirmationKind, string> = { pivot: "Sweep", ob: "OB" };

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

// "Sweep 1,33195 · medium (3d alt)" — ohne sourceTime (sollte praktisch nicht vorkommen, eine
// Bestätigung wird ja gerade WEIL sie schon passiert ist gewählt) nur "Sweep 1,33195".
export function formatConfirmationLabel(confirmation: TradeConfirmation, instrument: string, nowSec: number): string {
  const price = fmtPrice(confirmation.price, pricePrecisionForInstrument(instrument));
  const kind = kindLabel(confirmation.kind);
  const seconds = confirmationAgeSeconds(confirmation, nowSec);
  if (seconds == null) return `${kind} ${price}`;
  const tier = classifyAge(seconds);
  const age = formatAge(seconds);
  return `${kind} ${price} · ${tier}${age ? ` (${age} alt)` : ""}`;
}
