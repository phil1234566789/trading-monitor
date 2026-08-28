// Gemeinsame Darstellung für Trade-Evidenz — Confirmations (Sweep/OB, geben tatsächlich das GO)
// UND Confluences (Fib/RSI-Divergenz, geben nur zusätzliche Sicherheit, kein GO), siehe
// trading-Repo trade-from-poi.md#confirmation-confluence-und-anti-confluence--wie-eine-dealing-
// range-go-bekommt für die Begriffsdefinition und PLAN-trade-confluences.md #1 für die
// Entstehungsgeschichte. Bis 2026-08-28 hieß diese Datei tradeConfirmations.ts und die Tabelle
// trade_confirmations — umbenannt, weil beide inzwischen BEIDE Kategorien tragen, nicht mehr nur
// GO-Signale (siehe Migration 20260828120000). Gegenstück zu tradeTargets.ts: ein Target ist eine
// zukünftige Preis-Erwartung, Evidenz ist bereits Passiertes, das den Trade begründet. Teilt sich
// die Klick-Infrastruktur (PriceChart.vue: findClickedTarget) und die Alters-Einstufung
// (ageTier.ts) mit Targets, hat aber eine eigene Tabelle (trade_evidence) und eigene Beschriftung
// ("Sweep" statt "Pivot").
import { businessSecondsBetween, formatAge } from "./chartTimeUtils.js";
import { classifyAge, type AgeTier } from "./ageTier";
import { fmtPrice, pricePrecisionForInstrument } from "./format.js";

export type TradeEvidenceKind = "pivot" | "ob" | "fib" | "rsi_divergence";
export type TradeEvidenceCategory = "confirmation" | "confluence";

export interface TradeEvidence {
  id: number;
  price: number;
  kind: TradeEvidenceKind;
  // Generierte Spalte (siehe Migration 20260828120000) — 'pivot'/'ob' -> 'confirmation' (GO-Signal),
  // 'fib'/'rsi_divergence' -> 'confluence' (zusätzliche Sicherheit, kein GO). Immer aus kind
  // abgeleitet, nie eigenständig gesetzt.
  category: TradeEvidenceCategory;
  sourceTime: number | null;
  touchedTime: number | null;
  // Nur bei kind='fib' gesetzt (siehe marketStructureAnalysis.ts: computeFibLevels) — die zwei
  // Ankerpreise, aus denen `price` (der 0,5-Wert) abgeleitet wurde. Ohne diese wäre ein
  // gespeichertes Fib später nicht mehr nachvollziehbar, sobald die live berechnete Range
  // weitergewandert ist (der ganze Grund, wieso Philip das als Trade-Evidenz festhalten will).
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

// "Sweep" statt "Pivot" (anders als tradeTargets.ts: kindLabel) — eine Bestätigung/ein
// Zusatzargument ist per Definition schon geschehen, "Pivot" allein würde das nicht ausdrücken.
const KIND_LABEL: Record<TradeEvidenceKind, string> = { pivot: "Sweep", ob: "OB", fib: "Fib", rsi_divergence: "Div" };

export function kindLabel(kind: TradeEvidenceKind): string {
  return KIND_LABEL[kind] ?? kind;
}

function evidenceAgeSeconds(evidence: TradeEvidence, nowSec: number): number | null {
  if (evidence.sourceTime == null) return null;
  const reference = evidence.touchedTime ?? nowSec;
  return businessSecondsBetween(evidence.sourceTime, reference);
}

export function evidenceAgeTier(evidence: TradeEvidence, nowSec: number): AgeTier | null {
  const seconds = evidenceAgeSeconds(evidence, nowSec);
  return seconds == null ? null : classifyAge(seconds);
}

// "Sweep 1,33195 · medium (3d) #18" — ohne sourceTime (sollte praktisch nicht vorkommen, ein
// Eintrag wird ja gerade WEIL er schon passiert ist gewählt) nur "Sweep 1,33195 #18". Bei
// kind='fib' zusätzlich die zwei Ankerpreise ("Fib 1,33195 (1,3273–1,3387) · ..."), sonst wäre der
// 0,5-Preis allein später nicht mehr nachvollziehbar (siehe rangeLow/rangeHigh-Kommentar oben).
// #<id> am Ende (Bug-Report Philip 2026-07-31: Chart-Box zeigte "#18", Modal-Zeile für denselben
// Eintrag gar keine Id) matcht 1:1 das Chart-Label (PriceChart.vue:
// refreshTradeConfirmationLinksInternal), damit sich Modal-Zeile und Chart-Box eindeutig zuordnen
// lassen — wie schon bei formatTargetLabel.
export function formatEvidenceLabel(evidence: TradeEvidence, instrument: string, nowSec: number): string {
  const precision = pricePrecisionForInstrument(instrument);
  const price = fmtPrice(evidence.price, precision);
  const kind = kindLabel(evidence.kind);
  const rangeHint =
    evidence.kind === "fib" && evidence.rangeLow != null && evidence.rangeHigh != null
      ? ` (${fmtPrice(evidence.rangeLow, precision)}–${fmtPrice(evidence.rangeHigh, precision)})`
      : evidence.kind === "rsi_divergence" && evidence.fromPrice != null
        ? ` (${evidence.divergenceType === "bearish" ? "▽" : "△"} ${fmtPrice(evidence.fromPrice, precision)}→${price})`
        : "";
  const seconds = evidenceAgeSeconds(evidence, nowSec);
  if (seconds == null) return `${kind} ${price}${rangeHint} #${evidence.id}`;
  const tier = classifyAge(seconds);
  const age = formatAge(seconds);
  return `${kind} ${price}${rangeHint} · ${tier}${age ? ` (${age})` : ""} #${evidence.id}`;
}
