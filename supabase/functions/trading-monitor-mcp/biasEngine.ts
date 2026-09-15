import { berlinWeekdayAndMinutes } from "./pretradeGates.ts";
import type { ForceAssessment } from "./forceAssessment.ts";

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

export interface PendingDecision {
  substep: string;
  title: string;
  prompt: string;
  // Fehlt, wenn die Antwort schon aus den Rohdaten feststeht (siehe `resolved`) statt einer echten
  // Wahl zu bedürfen — nur bei einer offenen Frage gesetzt.
  options?: string[];
  // Gesetzt, wenn das Tool die Antwort bereits deterministisch kennt (Targets sind reine
  // Preis-Ableitung, keine Lana-Wahl) — dann nur noch als Textbaustein zu formulieren.
  resolved?: string;
}

// Pilot für Schritt 3 (state-machine.md, 05.09.2026): macht sichtbar, WELCHE der vier
// 03-htf-bias.md-Teilentscheidungen gerade offen ist, statt eine Antwort mit vier vermischten
// Urteilen zurückzugeben — die dort bereits dokumentierte Fall-Taxonomie/Gate-Struktur wird hier
// nachgebildet, nicht die Entscheidung selbst getroffen.
export function buildPendingDecisions(input: { force: ForceAssessment; trendTargetFound: boolean; countertrendTargetFound: boolean; intermediateLevelFound: boolean }): PendingDecision[] {
  const { force, trendTargetFound, countertrendTargetFound, intermediateLevelFound } = input;
  const decisions: PendingDecision[] = [];

  // Beide Seiten getrennt ausweisen statt zu einem Satz zu verschmelzen: "kein Trade bei
  // ausgeglichenem Kampf" (allgemeines.md) lässt sich nur beurteilen, wenn sichtbar ist, was für
  // die Gegenseite spricht — vorher lieferte dieser Prompt nur ein einzelnes Kraft-Verdikt.
  const forceLines: string[] = [];
  if (force.bullish.length > 0) forceLines.push(`FÜR die Bullen: ${force.bullish.map((s) => s.text).join(" ")}`);
  if (force.bearish.length > 0) forceLines.push(`FÜR die Bären: ${force.bearish.map((s) => s.text).join(" ")}`);
  if (force.majorInducementSides.length > 0) {
    const sides = force.majorInducementSides.map((s) => (s === "bullish" ? "bullisch" : "bärisch")).join(" + ");
    forceLines.push(`Major Inducement (${sides}) im Spiel ---> Vorrangregel prüfen: erweist er sich als kraftvoll, wird nicht dagegen gehandelt.`);
  }
  decisions.push({
    substep: "3.1",
    title: "Trend + Kraft",
    prompt:
      forceLines.length > 0
        ? `Welcher Struktur-Fall trifft zu? Kraft-Signale beider Seiten: ${forceLines.join(" | ")}`
        : "Welcher Struktur-Fall trifft zu? Keine Kraft-Signale (kein relevantes OB/Level getestet) — Kursverlauf manuell prüfen.",
    options: ["1: Trend läuft normal weiter", "2: Trend schwächelt", "3: Frischer Trendwechsel gerade jetzt", "4: Ausgeglichener Kampf, kein Bias"],
  });

  const targetsResolved = !countertrendTargetFound
    ? "kein Countertrend-Target: kein passender OB ---> kein Countertrend-Target"
    : !trendTargetFound
      ? "kein Trend-Target aktuell ---> wird im Loop weiterverfolgt"
      : "Standard: Trend-Target und Countertrend-Target als Textbaustein ausgeben";
  decisions.push({ substep: "3.2", title: "Targets", prompt: "Targets sind bereits berechnet, nur noch als Textbaustein formulieren.", resolved: targetsResolved });

  if (intermediateLevelFound) {
    decisions.push({ substep: "3.2b", title: "Zwischen-Level", prompt: "Zwischen-Level wurde gefunden, muss vor dem Trend-Target genannt werden.", resolved: "Zwischen-Level: [Preis] ([Kontext]) ---> muss zuerst gesweept werden" });
  }

  decisions.push({
    substep: "3.3",
    title: "Support/Resistance-Zone",
    prompt: "Gibt es eine OB, an der mehrere Argumente für eine Ablehnung sprechen (nicht nur ein einzelnes Argument)?",
    options: ["ja, OB benennen + pinnen", "nein, keine S/R-Zone aktuell"],
  });

  return decisions;
}
