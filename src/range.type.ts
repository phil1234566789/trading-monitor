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
  | "sweeped-low"
  // Ein LOW-structurePivot, der per Docht angetestet (touched) wurde, aber seitdem NIE eine Kerze
  // drunter geschlossen hat — Liquidity-Grab statt echtem Bruch, potenzielles bullisches Long-Setup
  // (siehe Chat 2026-07-19, gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts: rangeState1_1). Lebt nur in
  // structurePivots, nie in currRange (anders als sweeped-high/-low) — deshalb reicht die
  // Zugehörigkeit zu Pivot/PivotTypeAll, keine eigene engere Type-Variante nötig.
  | "LQ-sweep";

export type Pivot = PivotBase<PivotTypeAll>;

// Eigene, engere Typen für currRange.high/low im "1h-Range"-Algorithmus (siehe unten) — ein roher
// 'low'-Pivot oder ähnliches soll in currRange.high gar nicht erst kompilieren (siehe Chat: genau
// das ist uns mal passiert). 'sweeped-high'/'sweeped-low' seit Chat 2026-07-19 mit aufgenommen:
// der Docht-Zwischenzustand gehört fachlich zu "was gerade range.high/low ist", nicht zu
// structurePivots/innerStructurePivots (die sind für Pullbacks INNERHALB der Range gedacht).
export type PivotHigh = PivotBase<"high" | "sweeped-high">;
export type PivotLow = PivotBase<"low" | "sweeped-low">;

export type RangeTrend = "unknown" | "uptrend" | "downtrend";

// Zustand des "1h-Range"-Marktstruktur-Trendalgorithmus (siehe test/tdd_mit_claude.ts,
// rangeState1..7, und src/marketStructureAnalysis.ts, vormals rangeAnalysis.ts/RangeState — seit
// Chat 2026-07-20 umbenannt, um Verwechslung mit dem gleichzeitig existierenden, aber komplett
// anderen "Ranges"-Feature (H1-Fraktal-Pivot-Erkennung, siehe PriceChart.vue: rangesPeriod/
// showRanges/...) zu vermeiden). currRange ist die aktuell gültige, ungeklassifizierte Grenze;
// structurePivots sammelt Pivots innerhalb der Range (Pullbacks), von denen bei Trendbestätigung
// einer zu 'protected-high'/'protected-low' reklassifiziert wird — der Rest bleibt unverändert
// (siehe applyMarketStructurePivot).
// innerStructurePivots seit Chat 2026-07-19: die eingebettete Periode-2-Erkennung (schnellere
// Uptrend-Bestätigung, siehe gbp_h1_uptrend_LQ_sweep_long_setup.ts) sammelt ihre eigenen Pullback-
// Pivots getrennt von structurePivots (Periode 5) — beide Ebenen sollen unterscheidbar bleiben,
// nicht in einer Liste vermischt werden.
export type MarketStructureState = {
  trend: RangeTrend;
  currRange: {
    high: PivotHigh;
    low: PivotLow;
  };
  structurePivots: Pivot[];
  innerStructurePivots: Pivot[];
  appliedPivots: Pivot[];
};

