// Domain-Types für Pivots und die Range

export type PivotUntouched = false;
export type PivotTouched = {
  price: number;
  touchedAt: string;
};

export type PivotBase<T extends string> = {
  price: number;
  touched: PivotUntouched | PivotTouched;
  pivotAt: string;
  pivotTime?: number; // unix sekunden
  type: T;
};

export type PivotTypeAll =
  | "high"
  | "low"
  | "swing-high"
  | "swing-low"
  | "weak-high"
  | "weak-low"
  | "protected-high"
  | "protected-low"
  // Preis wurde nur mit dem Docht durchbrochen, aber (noch) keine Kerze DARÜBER/-UNTER
  // geschlossen — Zwischenzustand vor einem echten Bruch (siehe Chat 2026-07-19: eingebettete
  // Periode-2-Erkennung, rangeState1_3/1_4 in gbp_h1_uptrend_LQ_sweep_long_setup.ts).
  | "sweeped-high"
  | "sweeped-low";
export type PivotTypeDowntrend = "swing-high" | "swing-low" | "weak-high" | "weak-low" | "protected-high" | "lower-high" | "lower-low";
export type PivotTypeUptrend = "swing-high" | "swing-low" | "weak-high" | "weak-low" | "protected-low" | "higher-low";

export type Pivot = PivotBase<PivotTypeAll>;
export type PivotDowntrend = PivotBase<PivotTypeDowntrend>;
export type PivotUptrend = PivotBase<PivotTypeUptrend>;

// range.high/low halten IMMER genau den aktuell gültigen swing-Wert - nie eine Struktur-
// Klassifizierung wie 'lower-high'/'weak-high'/'protected-high' (die gehören nur in structure[]).
// Eigene, engere Typen statt PivotDowntrend/PivotUptrend, damit sowas wie ein roher 'low'-Pivot
// oder ein 'lower-low' in range gar nicht erst kompiliert (siehe Chat: genau das ist uns passiert).
export type PivotSwingHigh = PivotBase<"swing-high">;
export type PivotSwingLow = PivotBase<"swing-low">;

// Eigene, engere Typen für currRange.high/low im neuen "1h-Range"-Algorithmus (siehe unten) —
// anders als beim alten Zigzag-Ansatz (PivotSwingHigh/-Low) werden sie NICHT reklassifiziert,
// sondern behalten ihren rohen Fraktal-Typ ('high'/'low'). Trotzdem eigene Typen statt Pivot,
// aus demselben Grund wie oben: ein 'low'-Pivot soll nicht in currRange.high kompilieren können.
// 'sweeped-high'/'sweeped-low' seit Chat 2026-07-19 mit aufgenommen: der Docht-Zwischenzustand
// gehört fachlich zu "was gerade range.high/low ist", nicht zu structurePivots/innerStructurePivots
// (die sind für Pullbacks INNERHALB der Range gedacht) — bewusst NICHT 'swing-high' (das ist
// PivotSwingHigh oben, ein anderes Konzept aus dem alten Zigzag-Algo).
export type PivotHigh = PivotBase<"high" | "sweeped-high">;
export type PivotLow = PivotBase<"low" | "sweeped-low">;

export type RangeTrend = "unknown" | "uptrend" | "downtrend";

// Zustand des neuen "1h-Range"-Trendalgorithmus (siehe test/tdd_mit_claude.ts, rangeState1..7,
// und src/rangeAnalysis.ts) — ersetzt die alte, nie fertig genutzte RangeState-Form
// (protectedPivots/PivotSwingHigh/-Low), die zur verworfenen verschachtelten Trend-State-Machine
// gehörte. currRange ist die aktuell gültige, ungeklassifizierte Grenze; structurePivots sammelt
// Pivots innerhalb der Range (Pullbacks), von denen bei Trendbestätigung einer zu
// 'protected-high'/'protected-low' reklassifiziert wird — der Rest bleibt unverändert (siehe
// applyRangePivot).
// innerStructurePivots seit Chat 2026-07-19: die eingebettete Periode-2-Erkennung (schnellere
// Uptrend-Bestätigung, siehe gbp_h1_uptrend_LQ_sweep_long_setup.ts) sammelt ihre eigenen Pullback-
// Pivots getrennt von structurePivots (Periode 5) — beide Ebenen sollen unterscheidbar bleiben,
// nicht in einer Liste vermischt werden.
export type RangeState = {
  trend: RangeTrend;
  currRange: {
    high: PivotHigh;
    low: PivotLow;
  };
  structurePivots: Pivot[];
  innerStructurePivots: Pivot[];
  appliedPivots: Pivot[];
};

