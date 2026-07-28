// Gemeinsame Darstellung für Trade-Targets (Pivot oder OB, Chat 2026-07-28: "entweder ein Pivot
// ... oder einen OB") — genutzt von TradesTable.vue, TradeEditModal.vue UND PriceChart.vue
// (refreshTradeTargetLinksInternal), damit Tabellen-Text und Chart-Label/-Linienstärke aus
// derselben Quelle kommen statt an mehreren Stellen leicht abweichend nachgebaut zu werden.
import { businessSecondsBetween, formatAge } from "./chartTimeUtils.js";
import { classifyAge, type AgeTier } from "./ageTier";
import { fmtPrice, pricePrecisionForInstrument } from "./format.js";

export type TradeTargetKind = "pivot" | "ob";

export interface TradeTarget {
  id: number;
  price: number;
  kind: TradeTargetKind;
  // Wann der zugrundeliegende Pivot/die OB-Zone entstanden ist — null bei Alt-Targets von vor
  // diesem Feature (nur Preis bekannt, siehe Migration 20260728140000), dann auch keine
  // Alters-/Linien-Darstellung möglich.
  sourceTime: number | null;
  // Falls beim Anklicken schon geswept/getouched — sonst null, die Linie wächst dann wie bei einem
  // aktiven Liquiditäts-Level bis "jetzt" mit (siehe PriceChart.vue).
  touchedTime: number | null;
}

const KIND_LABEL: Record<TradeTargetKind, string> = { pivot: "Pivot", ob: "OB" };

export function kindLabel(kind: TradeTargetKind): string {
  return KIND_LABEL[kind] ?? kind;
}

// businessSeconds vom Entstehen bis zum Sweep/Touch, oder bis nowSec, falls noch aktiv — dieselbe
// Referenzpunkt-Regel wie ageSuffix in tradeSetupCockpit.ts (Bug-Report Philip 2026-07-27: Alter
// meint "bis zum Sweep", nicht "bis jetzt", sobald es einen Sweep-Zeitpunkt gibt).
function targetAgeSeconds(target: TradeTarget, nowSec: number): number | null {
  if (target.sourceTime == null) return null;
  const reference = target.touchedTime ?? nowSec;
  return businessSecondsBetween(target.sourceTime, reference);
}

export function targetAgeTier(target: TradeTarget, nowSec: number): AgeTier | null {
  const seconds = targetAgeSeconds(target, nowSec);
  return seconds == null ? null : classifyAge(seconds);
}

// "Pivot 1,33003 · medium (3d alt)" — ohne sourceTime (Alt-Targets) nur "Pivot 1,33003".
export function formatTargetLabel(target: TradeTarget, instrument: string, nowSec: number): string {
  const price = fmtPrice(target.price, pricePrecisionForInstrument(instrument));
  const kind = kindLabel(target.kind);
  const seconds = targetAgeSeconds(target, nowSec);
  if (seconds == null) return `${kind} ${price}`;
  const tier = classifyAge(seconds);
  const age = formatAge(seconds);
  return `${kind} ${price} · ${tier}${age ? ` (${age} alt)` : ""}`;
}
