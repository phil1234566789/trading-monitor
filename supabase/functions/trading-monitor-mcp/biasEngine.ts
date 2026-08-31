import { berlinWeekdayAndMinutes } from "./pretradeGates.ts";

// Pure Logik hinter run_bias_check (Schritt 3, siehe docs/state-machine.md + 03-htf-bias.md) —
// dependency-frei (nur pretradeGates.ts, selbst dependency-frei), damit sie ohne DB/Deno-Fetches
// per Vitest testbar bleibt. Die eigentlichen Datenquellen (compute1hStructureState,
// buildCandidatePool/findNearestLiquidityTargets/findNearestObTargets aus findTargetCandidates.js)
// bleiben bewusst in tools/biasCheck.ts (dem Deno-seitigen Handler) — ein Import dieser Funktionen
// HIER würde transitiv forexCandles.ts/db.ts/supabaseClient.ts mitziehen, die außerhalb von Deno
// (Vitest/Node) sofort beim Modul-Laden werfen (Deno.env.get), lange bevor ein einzelner Test läuft.

const SPREAD_HOUR_START_MINUTES = 23 * 60; // marktsessions.md#spread-hour-2300-0000-uhr
const SPREAD_HOUR_END_MINUTES = 24 * 60;

// 03-htf-bias.md: "Ein an der Spread Hour gebildeter Pivot zählt nicht als 'nächstgelegenes
// Level'" — gilt für Trend- UND Countertrend-Target gleichermaßen (siehe dortiger Prüfpunkt).
export function isSpreadHourPivot(pivotTimeSec: number): boolean {
  const { minutesOfDay } = berlinWeekdayAndMinutes(pivotTimeSec);
  return minutesOfDay >= SPREAD_HOUR_START_MINUTES && minutesOfDay < SPREAD_HOUR_END_MINUTES;
}

export interface IntermediateLevelCandidate {
  price: number;
  kind: "liquidity" | "ob" | "asia_range";
  refId?: number | null;
  context?: string | null;
  timeframe?: string | null;
}

export interface FindIntermediateLevelArgs {
  direction: "long" | "short";
  currentPrice: number;
  trendTargetPrice: number;
  liquidityLevels: { price: number; direction: "high" | "low"; touched: boolean; timeframe: string; id?: number | null; context?: string | null; pivotTime?: number | null }[];
  obZones: { dir: 1 | -1; top: number; bottom: number; touched: boolean; invalidated: boolean; timeframe: string; id?: number | null; startTime?: number | null }[];
  // Immer zuerst asiaSession.rangeHigh/rangeLow gegenchecken (03-htf-bias.md) — nur wenn `today`
  // gesetzt ist (das Zwischen-Level muss vom AKTUELLEN Handelstag stammen, siehe Bug-Beispiel
  // 25.08.2026: ein Vortages-Asia-High wurde fälschlich als heutiges Target-Level gelesen).
  asiaRange?: { rangeHigh: number | null; rangeLow: number | null; today: boolean } | null;
}

// Die konkrete Lückenbehebung vom 31.08.2026 (Pin #236): scannt den Kandidaten-Pool nach
// gleichgerichteten, UNBERÜHRTEN OBs/Leveln zwischen aktuellem Preis und dem Trend-Target — die
// bisherige Prüfung sah nur asiaSession.rangeHigh/rangeLow, nicht den restlichen Pool.
export function findIntermediateLevel(args: FindIntermediateLevelArgs): IntermediateLevelCandidate | null {
  const { direction, currentPrice, trendTargetPrice, liquidityLevels, obZones, asiaRange } = args;
  const inZone = (price: number) => (direction === "long" ? price > currentPrice && price < trendTargetPrice : price < currentPrice && price > trendTargetPrice);
  const wantedLevelDir = direction === "long" ? "high" : "low";
  const wantedObDir = direction === "long" ? 1 : -1;

  // "Immer ZUERST asiaSession.rangeHigh/rangeLow gegenchecken" (03-htf-bias.md) — Priorität vor
  // dem restlichen Pool, nicht nur ein Kandidat unter vielen per Distanz-Sortierung. Bug-Beispiel
  // 25.08.2026: ein VORTAGES "asia high"-getaggtes m5LiquidityLevels-Level (im Pool enthalten, weil
  // dessen Preis zufällig noch im Fenster lag) wurde fälschlich statt des tatsächlichen HEUTIGEN
  // Asia-Highs gewählt — nur ein "asiaRange zuerst, dann Pool" mit hartem Vorrang schließt diese
  // Fehlerklasse strukturell aus, eine reine Distanz-Sortierung über alle Kandidaten hinweg würde
  // sie nicht zuverlässig verhindern (ein stale Level könnte preislich zufällig näher liegen).
  if (asiaRange?.today) {
    const price = direction === "long" ? asiaRange.rangeHigh : asiaRange.rangeLow;
    if (price != null && inZone(price)) return { price, kind: "asia_range", context: "Asia-Range (heute)" };
  }

  const candidates: IntermediateLevelCandidate[] = [];
  for (const l of liquidityLevels) {
    if (l.touched || l.direction !== wantedLevelDir) continue;
    if (l.pivotTime != null && isSpreadHourPivot(l.pivotTime)) continue;
    if (!inZone(l.price)) continue;
    candidates.push({ price: l.price, kind: "liquidity", refId: l.id ?? null, context: l.context ?? null, timeframe: l.timeframe });
  }
  for (const z of obZones) {
    if (z.touched || z.invalidated || z.dir !== wantedObDir) continue;
    if (z.startTime != null && isSpreadHourPivot(z.startTime)) continue;
    const edge = direction === "long" ? z.bottom : z.top; // nähere Kante
    if (!inZone(edge)) continue;
    candidates.push({ price: edge, kind: "ob", refId: z.id ?? null, timeframe: z.timeframe });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));
  return candidates[0];
}

export type TrendForceConfidence = "high" | "medium" | "low";

export interface TrendForceObInput {
  direction: "long" | "short";
  timeframe: string;
  touched: boolean;
  invalidated: boolean;
}

export interface TrendForceLevelInput {
  direction: "high" | "low";
  price: number;
  timeframe: string;
  touched: boolean;
  kontext?: string | null;
}

export interface TrendForceVerdict {
  verdict: "held" | "swept" | "broken" | "none" | "unclear";
  text: string | null;
  confidence: TrendForceConfidence;
}

export interface TrendForceResult {
  ob: TrendForceVerdict;
  level: TrendForceVerdict;
}

// Prüfpunkt (4) aus 03-htf-bias.md — hält das relevante gegenläufige HTF-OB/-Level, oder ist es
// sauber durchbrochen? ob/level sollten die jeweils relevanten HTF-Objekte sein (i.d.R. das
// Countertrend-Target-OB bzw. das zuletzt geswepte Asia-/NY-/MMM-Level, siehe tools/biasCheck.ts).
// OB-Verdikt ist rein DB-Flag-basiert (touched/invalidated, siehe Orderblöcke → Kanten-Regel) —
// dieselbe Fehlerklasse aus dem Vorfall (OB fälschlich als "bullisch" statt "bärisch" benannt) ist
// strukturell ausgeschlossen, weil ob.direction direkt aus der DB-Zeile kommt, nie von Lana neu
// benannt wird. Level-Verdikt braucht zusätzlich currentPrice (welche Seite des Levels hält der
// Kurs JETZT) — ohne Folge-Kerzen-Analyse eine Preis-Geometrie-Näherung statt einer echten
// Reversal-Bestätigung, deshalb bewusst nur confidence='medium'.
export function determineTrendForce(trend: "uptrend" | "downtrend", ob: TrendForceObInput | null, level: TrendForceLevelInput | null, currentPrice: number | null): TrendForceResult {
  const strengthWord = trend === "uptrend" ? "bullische" : "bärische";

  let obResult: TrendForceVerdict = { verdict: "none", text: null, confidence: "high" };
  if (ob) {
    const dirWord = ob.direction === "long" ? "bullischer" : "bärischer";
    if (ob.invalidated) {
      obResult = { verdict: "broken", text: `${dirWord} ${ob.timeframe}-OB durchbrochen ---> ${strengthWord} Schwäche, möglicher Trendwechsel.`, confidence: "high" };
    } else if (ob.touched) {
      obResult = { verdict: "held", text: `${dirWord} ${ob.timeframe}-OB angetestet und hat gehalten ---> ${strengthWord} Stärke.`, confidence: "high" };
    }
  }

  let levelResult: TrendForceVerdict = { verdict: "none", text: null, confidence: "high" };
  if (level?.touched) {
    if (currentPrice == null) {
      levelResult = { verdict: "unclear", text: null, confidence: "low" };
    } else {
      // "Trend-Seite" des Levels: nach einem Sweep sollte der Kurs für einen Stärke-Beleg auf der
      // Seite stehen, die den Trend fortsetzt (siehe determineTrendForce-Kommentar oben).
      const heldTrendSide =
        trend === "uptrend" ? (level.direction === "low" ? currentPrice > level.price : currentPrice < level.price) : level.direction === "high" ? currentPrice < level.price : currentPrice > level.price;
      levelResult = heldTrendSide
        ? { verdict: "swept", text: `Liquidity Sweep ${level.price} (${level.kontext ?? ""}) ---> ${strengthWord} Stärke.`, confidence: "medium" }
        : { verdict: "broken", text: `${level.price} (${level.kontext ?? ""}) sauber durchbrochen ---> ${strengthWord} Schwäche, möglicher Trendwechsel.`, confidence: "medium" };
    }
  }

  return { ob: obResult, level: levelResult };
}
