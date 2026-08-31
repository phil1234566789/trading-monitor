// Pure Logik hinter run_dealing_range_loop (Schritt 5, siehe docs/state-machine.md +
// 05-dealing-range-bestaetigen.md) — dependency-frei, testbar ohne DB/Deno-Fetches.
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
}

// Reine Existenz-Prüfung (keine Bewertung der QUALITÄT der Reaktion, siehe Kommentar oben) — nur
// dafür, ob der Backtest-Fast-Forward automatisch weiterläuft (kein Fund -> weiter) oder anhält
// (irgendein Fund -> Philip/Lana muss selbst hinschauen), und ob eine Live-Benachrichtigung fällig
// ist (05-dealing-range-bestaetigen.md: "Sobald Fall 1 oder Fall 2 eintritt, Philip aktiv
// informieren" — ohne die beiden mechanisch zu unterscheiden, gilt "irgendeine Reaktion" als
// Auslöser für beide).
export function hasReaction(input: HasReactionInput): boolean {
  return input.hasCompletedTradeSetup || input.obReactionCount > 0 || input.liquiditySweepCount > 0;
}

export interface WatchLevel {
  price: number;
  kind: "liquidity" | "ob";
  refId?: number | null;
  timeframe?: string | null;
  context?: string | null;
}

export interface WatchLevelInputLiquidity {
  price: number;
  touched: boolean;
  id?: number | null;
  timeframe: string;
  context?: string | null;
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
    candidates.push({ price: l.price, kind: "liquidity", refId: l.id ?? null, timeframe: l.timeframe, context: l.context ?? null });
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
