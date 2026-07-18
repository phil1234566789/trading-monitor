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

export type PivotTypeAll = "high" | "low" | "swing-high" | "swing-low" | "weak-high" | "weak-low" | "protected-high" | "protected-low";
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

/**
 * überbleibsel nachdem die Trendanalyse verworfen wird
 */
export type RangeState = {
  range: {
    high: PivotSwingHigh;
    low: PivotSwingLow;
  };
  protectedPivots: PivotDowntrend[];
  appliedPivots: Pivot[]; // TODO hier aufpassen, dass es nicht ins unendliche wächst
};

