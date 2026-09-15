// Die EINE Stelle für die Kraftabwägung (kontext-analyse.md#kraft--herleitung-im-kontext-der-trade-
// ableitung: 4H-OB-Reaktionen + 1H-OB-Reaktionen + Inducements). Vorher dreifach implementiert —
// biasEngine.determineTrendForce (Schritt 3), fallClassifier.assessInducement (Schritt 5),
// get_validation_evidence (Schritt 6) — mit widersprüchlichen Ausgaben: am 09.09.2026 meldete
// Schritt 3 für 1.35652 "sauber durchbrochen ---> bullische Kraft", während Schritt 5 zeitgleich
// "Major Inducement angelaufen ---> Kraft nach unten" lieferte.
//
// Zwei Quellen, bewusst unterschiedliche Mechanik (03-htf-bias.md: "hier gilt NICHT das OB-Schema"):
//   LQ-Level — die Kraft kommt aus dem LEVEL (gesweeptes Hoch = Kraft nach unten), nie aus dem Trend.
//   OB       — die Kraft kommt aus der OB-RICHTUNG (orderblöcke.md#reaktionsmuster-am-ob: "OB hält
//              → die Seite, die den OB gebildet hat, zeigt Kraft"; "OB hält nicht → die Gegenseite
//              gewinnt an dieser Preiszone an Kraft").
// Beide Vorzeichen also aus dem Objekt selbst. Ein aus dem Trend abgeleitetes bullisch/bärisch war
// zweimal die Ursache verdrehter Ausgaben (Level-Zweig bis 13.09.2026, OB-Zweig bis hierher).
import { businessSecondsBetween, classifyAge, type AgeTier } from "../_shared/ageTier.ts";

export type ForceSide = "bullish" | "bearish";

export interface ForceLiquidityInput {
  price: number;
  direction: "high" | "low" | null;
  pivotTimeSec: number;
  touched: boolean;
  kontext?: string | null;
  timeframe?: string | null;
}

export interface ForceObInput {
  direction: "long" | "short";
  timeframe: string;
  touched: boolean;
  invalidated: boolean;
  retested: boolean;
  top?: number;
  bottom?: number;
}

export interface ForceSignal {
  side: ForceSide;
  source: "liquidity" | "ob";
  price: number | null;
  text: string;
  // Nur bei source='liquidity' — löst zusammen mit side die Vorrangregel aus
  // (kontext-analyse.md#sonderregel--major-inducement-hat-vorrang).
  inducementClass?: AgeTier;
}

export interface ForceAssessment {
  signals: ForceSignal[];
  bullish: ForceSignal[];
  bearish: ForceSignal[];
  // Seiten, auf denen ein Major Inducement liegt. "Erweist er sich als kraftvoll, wird niemals
  // dagegen gehandelt" — OB dieser Major kraftvoll IST, bleibt ein Urteil (M5-Struktur/Impulsivität,
  // siehe liquidität.md#regel--kein-trade-gegen-einen-kraftvollen-major-inducement), deshalb hier
  // nur die Seite, kein fertiges Handelsverbot.
  majorInducementSides: ForceSide[];
  // Bewusst immer null — "kein Trade bei ausgeglichenem Kampf" ist laut allgemeines.md eine
  // qualitative Abwägung ("Goliath gewinnt 7:1, kein knappes Ergebnis"), kein Zählerstand. Dieselbe
  // Arbeitsteilung wie get_validation_evidence's finalVerdict.
  verdict: null;
}

const sideWord = (side: ForceSide) => (side === "bullish" ? "bullische" : "bärische");
const opposite = (side: ForceSide): ForceSide => (side === "bullish" ? "bearish" : "bullish");

// Ein getouchtes LQ-Level. Ungetouchte Level liefern kein Kraft-Signal — sie sind Watch-Level
// (fallClassifier.computeWatchLevels), noch kein Ereignis.
export function assessLiquidityForce(level: ForceLiquidityInput, atSec: number): ForceSignal | null {
  if (!level.touched || level.direction == null) return null;
  const inducementClass = classifyAge(businessSecondsBetween(level.pivotTimeSec, atSec));
  const label = `${inducementClass[0].toUpperCase()}${inducementClass.slice(1)} Inducement`;
  const side: ForceSide = level.direction === "high" ? "bearish" : "bullish";
  const force = side === "bearish" ? "Kraft nach unten" : "Kraft nach oben";
  const kontextPart = level.kontext ? ` (${level.kontext})` : "";
  return {
    side,
    source: "liquidity",
    price: level.price,
    text: `${label} ${level.price}${kontextPart} angelaufen ---> ${force}.`,
    inducementClass,
  };
}

// Eine OB-Zone. Drei der vier Retest-Zustände aus orderblöcke.md#retest-status liefern ein Signal —
// "Retest läuft" (getoucht, aber Reaktion nicht abgeschlossen) bewusst NICHT: für diesen Zustand
// gibt es dort ausdrücklich "noch keine definierte Behandlung", ein Signal wäre geraten.
export function assessObForce(ob: ForceObInput): ForceSignal | null {
  const obSide: ForceSide = ob.direction === "long" ? "bullish" : "bearish";
  const dirWord = ob.direction === "long" ? "bullischer" : "bärischer";
  if (ob.invalidated) {
    const side = opposite(obSide);
    return {
      side,
      source: "ob",
      price: ob.direction === "long" ? (ob.bottom ?? null) : (ob.top ?? null),
      text: `${dirWord} ${ob.timeframe}-OB durchbrochen ---> ${sideWord(side)} Stärke.`,
    };
  }
  if (ob.touched && ob.retested) {
    return {
      side: obSide,
      source: "ob",
      price: ob.direction === "long" ? (ob.top ?? null) : (ob.bottom ?? null),
      text: `${dirWord} ${ob.timeframe}-OB angetestet und hat gehalten ---> ${sideWord(obSide)} Stärke.`,
    };
  }
  return null;
}

export function assessForce(
  liquidityLevels: ForceLiquidityInput[],
  obZones: ForceObInput[],
  atSec: number,
): ForceAssessment {
  const signals: ForceSignal[] = [];
  for (const l of liquidityLevels) {
    const s = assessLiquidityForce(l, atSec);
    if (s) signals.push(s);
  }
  for (const z of obZones) {
    const s = assessObForce(z);
    if (s) signals.push(s);
  }
  const bullish = signals.filter((s) => s.side === "bullish");
  const bearish = signals.filter((s) => s.side === "bearish");
  const majorInducementSides = [...new Set(signals.filter((s) => s.inducementClass === "major").map((s) => s.side))];
  return { signals, bullish, bearish, majorInducementSides, verdict: null };
}
