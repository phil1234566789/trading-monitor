// Domain-Types für die Marktstruktur-Trendanalyse

export type TrendConfirmation = "unconfirmed" | "confirmed" | "invalidated";

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

export type DowntrendState = {
  trendOrdnung: number; // 1 ist der übergeordnete Trend. Je niedriger die Zahl, desto stärker der Trend. Wird außerdem zum labeln aufn Chart verwendet "Downtrend 1"
  direction: "down";
  confirmation: TrendConfirmation;
  range: {
    high: PivotDowntrend;
    low: PivotDowntrend;
  };
  structure: PivotDowntrend[];
  innerStructure: unknown;
  appliedPivots: Pivot[];
  // Bruch des swing-high (Reversal, noch nicht implementiert) beendet DIESEN Trend, statt range
  // rückwirkend zu verändern. null solange unconfirmed
  // bzw. noch kein Bruch passiert ist.
  trendInvalidatingPivot: Pivot | null;
};

export type UptrendState = {
  trendOrdnung: number;
  direction: "up";
  confirmation: TrendConfirmation;
  range: {
    high: PivotUptrend;
    low: PivotUptrend;
  };
  structure: PivotUptrend[];
  innerStructure: unknown;
  appliedPivots: Pivot[];
  trendInvalidatingPivot: Pivot | null;
};

export type TrendAnalyseState = DowntrendState | UptrendState; // später | ConsolidationState
