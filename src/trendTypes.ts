// Domain-Types für die Marktstruktur-Trendanalyse — Philips Entwurf (siehe Chat), extrahiert aus
// test/trendanalyse_testdriven_modelling.ts, damit Algo (trendZigzag.ts) und Testdaten denselben
// Vertrag benutzen statt zweier Kopien, die auseinanderlaufen können.
//
// pivotTime (Unix-Sekunden) ist die einzige Ergänzung gegenüber Philips Entwurf: intern nur für
// Rendering + Kerzen-Lookup nötig (siehe trendZigzag.ts/PriceChart.vue), deshalb optional und kein
// Pflichtfeld in seinem Pivot-Design.

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
  pivotTime?: number;
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
  // war Pivot[] - aber structure enthält immer nur klassifizierte Downtrend-Pivots (lower-high/
  // lower-low/weak-high), nie ein rohes "high"/"low" -> PivotDowntrend[] ist der korrekte Typ.
  structure: PivotDowntrend[];
  innerStructure: unknown;
  appliedPivots: Pivot[];
  // Bruch des swing-high (Reversal, noch nicht implementiert) beendet DIESEN Trend, statt range
  // rückwirkend zu verändern - siehe Chat: eigenes Feld statt Vermischung mit structure[], weil
  // "Trend vorbei" eine andere Aussage ist als "Struktur wächst weiter". null solange unconfirmed
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
