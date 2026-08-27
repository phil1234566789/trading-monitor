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

// "Pivot 1,33003 · medium (3d) #12" — ohne sourceTime (Alt-Targets) nur "Pivot 1,33003 #12".
// #<id> am Ende (Bug-Report Philip 2026-07-31: die Chart-Box zeigt "#18", das TradeEditModal
// zeigte für dieselbe Zeile gar keine Id — "die #18 kann man nicht zuordnen") matcht 1:1 das
// Chart-Label (PriceChart.vue: refreshTradeTargetLinksInternal), damit sich Modal-Zeile und
// Chart-Box wieder eindeutig zuordnen lassen.
export function formatTargetLabel(target: TradeTarget, instrument: string, nowSec: number): string {
  const price = fmtPrice(target.price, pricePrecisionForInstrument(instrument));
  const kind = kindLabel(target.kind);
  const seconds = targetAgeSeconds(target, nowSec);
  if (seconds == null) return `${kind} ${price} #${target.id}`;
  const tier = classifyAge(seconds);
  const age = formatAge(seconds);
  return `${kind} ${price} · ${tier}${age ? ` (${age})` : ""} #${target.id}`;
}

// Erreicht = der Exit-Preis ist mindestens bis zum Target gelaufen (Chat 2026-07-28: "kann man ja
// ganz einfach durch den Exit-Preis prüfen ... brauchen wir später mal für die Statistik") —
// bewusst als eigene, kleine, reine Funktion statt inline in TradesTable.vue, damit eine spätere
// Auswertung (Trefferquote je Target-Art/-Tier) dieselbe Regel nutzt statt sie zu duplizieren.
// null = noch kein Exit-Preis, also (noch) nicht beurteilbar — kein "false", das wäre inhaltlich
// falsch (ein offener Trade hat das Ziel weder erreicht noch verfehlt).
export function isTargetReached(direction: "long" | "short", exitPrice: number | null, targetPrice: number): boolean | null {
  if (exitPrice == null) return null;
  return direction === "short" ? exitPrice <= targetPrice : exitPrice >= targetPrice;
}
