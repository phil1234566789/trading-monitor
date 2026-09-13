// Pure Logik hinter run_dealing_range_loop (Schritt 5, siehe docs/state-machine.md +
// 05-dealing-range-bestaetigen.md) — dependency-frei, testbar ohne DB/Deno-Fetches.
import { businessSecondsBetween, classifyAge, type AgeTier } from "../_shared/ageTier.ts";
//
// Nur Fall 4 (Trend-/Countertrend-Target oder Invalidierung erreicht) ist ein reiner
// Preisvergleich und wird hier mechanisch entschieden. Fall 1/2/3 sind NICHT mechanisch
// entscheidbar — Philip, 31.08.2026, zur ersten Version dieser Datei (die touched/invalidated-
// Flags noch automatisch in ein Fall-1/2/3-"case"-Feld übersetzt hatte): "eig sind alle drei
// Punkte LLM Sache", auch der scheinbar simple "OB hält"/"valider Sweep"-Check. Der Handler
// (tools/dealingRangeLoop.ts) liefert deshalb nur noch die rohe Evidenz (Setups/Sweeps/OB-
// Reaktionen aus get_data_snapshot/get_recent_reactions, fest verdrahtet statt optional — genau
// die beiden Pflicht-Calls, die am 31.08.2026 nach 16:00 nicht mehr liefen) plus einen simplen
// `hasReaction`-Flag (für Benachrichtigungspflicht + Backtest-Abbruchregel) — die eigentliche
// Fall-1/2/3-Einordnung UND jede darauf aufbauende Aktion (TSC-Bootstrap/add_trade_confirmation/
// add_trade_target/Pin-Aufräumen) bleibt bei Lana, wie bisher.

function hitTarget(direction: "long" | "short", currentPrice: number, targetPrice: number): boolean {
  return direction === "long" ? currentPrice >= targetPrice : currentPrice <= targetPrice;
}

// invalidation/countertrendTarget liegen auf der GEGENrichtung zur Trend-Direction (siehe
// biasCheck.ts: countertrendTarget wird über die counterDirection gesucht) — "erreicht" heißt daher
// umgekehrte Preis-Richtung wie beim Trend-Target.
function hitCounterLevel(direction: "long" | "short", currentPrice: number, price: number): boolean {
  return direction === "long" ? currentPrice <= price : currentPrice >= price;
}

export interface TargetHit {
  price: number;
}

export interface CheckFallFourInput {
  direction: "long" | "short";
  currentPrice: number;
  trendTarget: TargetHit | null;
  countertrendTarget: TargetHit | null;
  invalidation: number | null;
}

export interface FallFourResult {
  hit: boolean;
  reason: string | null;
}

// Reiner Preisvergleich, keine Interpretation nötig — deshalb der einzige Teil von Schritt 5, den
// dieses Tool tatsächlich entscheidet statt nur Evidenz zu liefern.
export function checkFallFour(input: CheckFallFourInput): FallFourResult {
  if (input.trendTarget && hitTarget(input.direction, input.currentPrice, input.trendTarget.price)) {
    return { hit: true, reason: `Trend-Target ${input.trendTarget.price} erreicht.` };
  }
  if (input.countertrendTarget && hitCounterLevel(input.direction, input.currentPrice, input.countertrendTarget.price)) {
    return { hit: true, reason: `Countertrend-Target ${input.countertrendTarget.price} erreicht.` };
  }
  if (input.invalidation != null && hitCounterLevel(input.direction, input.currentPrice, input.invalidation)) {
    return { hit: true, reason: `Invalidierung ${input.invalidation} erreicht.` };
  }
  return { hit: false, reason: null };
}

export interface HasReactionInput {
  hasCompletedTradeSetup: boolean;
  obReactionCount: number;
  liquiditySweepCount: number;
  // Frisches Setup in GEGENrichtung zum Bias — alle anderen Felder sind bewusst nach der
  // Bias-Richtung gefiltert (siehe performFullTick), wodurch eine laufende Gegenbewegung im
  // Fast-Forward unsichtbar blieb und der Loop über sie hinweglief (Backtest GBPUSD 09.09.2026:
  // zwei per Telegram alarmierte Short-Setups blieben über den ganzen Vormittag unsichtbar, weil
  // der Bias auf 'long' stand).
  hasFreshOppositeSetup: boolean;
}

// Reine Existenz-Prüfung (keine Bewertung der QUALITÄT der Reaktion, siehe Kommentar oben) — nur
// dafür, ob der Backtest-Fast-Forward automatisch weiterläuft (kein Fund -> weiter) oder anhält
// (irgendein Fund -> Philip/Lana muss selbst hinschauen), und ob eine Live-Benachrichtigung fällig
// ist (05-dealing-range-bestaetigen.md: "Sobald Fall 1 oder Fall 2 eintritt, Philip aktiv
// informieren" — ohne die beiden mechanisch zu unterscheiden, gilt "irgendeine Reaktion" als
// Auslöser für beide).
export function hasReaction(input: HasReactionInput): boolean {
  return input.hasCompletedTradeSetup || input.obReactionCount > 0 || input.liquiditySweepCount > 0 || input.hasFreshOppositeSetup;
}

export interface WatchLevel {
  price: number;
  kind: "liquidity" | "ob";
  refId?: number | null;
  timeframe?: string | null;
  context?: string | null;
  // Pivot-Zeitpunkt der Quelle — ohne ihn lässt sich beim Treffer die Inducement-Klasse nicht
  // bestimmen (siehe assessInducement), und LoopLevel.sourceTimeSec bliebe leer.
  sourceTimeSec?: number | null;
  direction?: "high" | "low" | null;
}

export interface WatchLevelInputLiquidity {
  price: number;
  touched: boolean;
  id?: number | null;
  timeframe: string;
  context?: string | null;
  pivotTime?: number | null;
  direction?: "high" | "low" | null;
}

export interface WatchLevelInputOb {
  top: number;
  bottom: number;
  touched: boolean;
  invalidated: boolean;
  id?: number | null;
  timeframe: string;
}

// Der schlanke Loop-Tick-Preisvergleich aus 05-dealing-range-bestaetigen.md: nächstes Level
// oberhalb UND unterhalb des aktuellen Preises, aus bereits vorliegenden Kandidaten (kein neuer
// Fetch) — richtungsunabhängig (beide Seiten), da ein Loop-Tick beide Watch-Level gegen jede neue
// Kerze prüft, unabhängig von der Trend-Richtung.
export function computeWatchLevels(currentPrice: number, liquidityLevels: WatchLevelInputLiquidity[], obZones: WatchLevelInputOb[]): { above: WatchLevel | null; below: WatchLevel | null } {
  const candidates: WatchLevel[] = [];
  for (const l of liquidityLevels) {
    if (l.touched) continue;
    candidates.push({ price: l.price, kind: "liquidity", refId: l.id ?? null, timeframe: l.timeframe, context: l.context ?? null, sourceTimeSec: l.pivotTime ?? null, direction: l.direction ?? null });
  }
  for (const z of obZones) {
    if (z.touched || z.invalidated) continue;
    candidates.push({ price: z.top, kind: "ob", refId: z.id ?? null, timeframe: z.timeframe });
    candidates.push({ price: z.bottom, kind: "ob", refId: z.id ?? null, timeframe: z.timeframe });
  }
  const above = candidates.filter((c) => c.price > currentPrice).sort((a, b) => a.price - b.price)[0] ?? null;
  const below = candidates.filter((c) => c.price < currentPrice).sort((a, b) => b.price - a.price)[0] ?? null;
  return { above, below };
}

// Dritter, FALL-UNABHÄNGIGER Watch-Kanal (Philip 13.09.2026: "In meiner Strategie dreht sich alles
// um LQ-Sweeps ... Lana muss auch in der statemachine die aktuellen untouched HTF Levels im Blick
// haben"). Die beiden Aufmerksamkeitslevel aus docs/attention-levels.md sind exklusiv: sobald eine
// Reaktion gefunden ist (Fall 1/2), läuft der Loop dauerhaft im M5-Pfad und sieht 1H/4H gar nicht
// mehr — M5-Level liegen dichter und verdrängen HTF-Level, sobald beide im selben Kandidatentopf
// landen. Im GBPUSD-Backtest 09.09.2026 war ab dem ersten Tick durchgehend hasReaction=true, das
// 4H-Level 1.35652 konnte deshalb nie Watch-Level werden, obwohl der Kurs direkt darauf zulief.
// Inducements sind laut liquidität.md aber per Definition 1H/4H-Sweeps — man braucht sie genau
// dann, wenn eine Dealing Range in Arbeit ist.
//
// Bewusst NUR Liquidity-Level, keine OB-Kanten (Philip, 13.09.2026): ein Inducement ist ein
// LQ-Sweep, OB-Kanten würden das Signal verwässern.
export function computeHtfWatchLevels(currentPrice: number, htfLiquidityLevels: WatchLevelInputLiquidity[]): { above: WatchLevel | null; below: WatchLevel | null } {
  const htfOnly = htfLiquidityLevels.filter((l) => l.timeframe === "1H" || l.timeframe === "4H");
  return computeWatchLevels(currentPrice, htfOnly, []);
}

export interface InducementAssessment {
  class: AgeTier;
  businessSeconds: number;
  text: string;
}

// Die Einstufung, die Lana beim Treffer mitgeliefert bekommt, statt sie selbst aus dem Alter
// herzuleiten (Philip 13.09.2026, explizit gegen "Klassifikation macht Lana" entschieden — genau
// die Stelle, an der sie im 09.09.-Backtest gepatzt hat). "Major" löst das Handelsverbot aus
// liquidität.md#regel--kein-trade-gegen-einen-kraftvollen-major-inducement aus, "Medium" nicht —
// deshalb kommt die Schwelle aus _shared/ageTier.ts statt aus einer weiteren lokalen Kopie.
export function assessInducement(level: { price: number; pivotTimeSec: number; direction?: "high" | "low" | null }, atSec: number): InducementAssessment {
  const businessSeconds = businessSecondsBetween(level.pivotTimeSec, atSec);
  const cls = classifyAge(businessSeconds);
  const label = `${cls[0].toUpperCase()}${cls.slice(1)} Inducement`;
  // Ein gesweeptes Hoch ist Kraft nach unten, ein gesweeptes Tief Kraft nach oben (liquidität.md) —
  // die Richtung gehört in den Text, weil genau diese Umkehrung im 09.09.-Backtest verdreht wurde.
  const force = level.direction === "high" ? "Kraft nach unten" : level.direction === "low" ? "Kraft nach oben" : null;
  const parts = [`${label} ${level.price} angelaufen`, force].filter((p): p is string => p != null);
  return { class: cls, businessSeconds, text: `${parts.join(" ---> ")}.` };
}
