// Setup-1-Erkennung der Backend-Seite: dieselbe Funktion wie im Chart (src/tradeSetup.js), hier nur
// typisiert. Bis 21.11.2026 eine eigene Kopie mit anderer Fraktal-Suche (nur das neueste unberührte
// Fraktal, nur das neueste Setup) — Chart und Telegram meldeten dadurch Verschiedenes. Die komplette
// Pipeline (H1-Struktur-Level, Parameter, M5-Fenster) steht in src/setup1Detection.js.
import type { Candle } from "./orderBlocks.ts";
import type { LiquidityLevel } from "./liquidityDetection.ts";
import * as core from "../../../src/tradeSetup.js";
import { tradeSetupParameters } from "../../../src/tradeSetupParameters.js";
export { TRADE_SETUP_M5_FRACTAL_PERIOD } from "../../../src/priceChartConstants.js";
export { TRADE_SETUP_OB_SWEEP_PROFILE } from "./tradeSetupSourceSnapshot.js";

export interface SetupOb {
  dir: 1 | -1; // 1 = bullische Lücke, -1 = bärische Lücke
  top: number;
  bottom: number;
  startTime: number; // Zeitpunkt der mittleren Impuls-Kerze, siehe detectSetupObs
  fvg: number; // Groesse der FVG in Preiseinheiten, siehe Zone.fvg
}

export interface SetupSweep {
  level: LiquidityLevel;
  timeframe: "1H" | "5M";
}

export interface DetectedTradeSetup {
  dir: 1 | -1; // 1 = Short (Protected High), -1 = Long (Protected Low)
  fractal: LiquidityLevel;
  ls: LiquidityLevel;
  sweeps: SetupSweep[]; // Höchstens drei stärkste Level, ältester zuerst — sweeps[0].level === ls
  confirmationSources?: SetupSweep[];
  confirmationHistory?: Array<SetupSweep & { status: string; sourceKey: string }>;
  sweepSourceProfile?: string;
  obTop: number;
  obBottom: number;
  obStartTime: number;
  obFvg: number;
  pathType: "A" | "B";
}

export interface TradeSetupParams {
  sweepSourceProfile?: string;
  graceSec: number;
  lsMaxLeadSecH1: number;
  lsMaxLeadSecM5: number;
  maxDistanceM5: number | null; // Preiseinheiten, NICHT Pip
  maxSweepDistance: number; // Preiseinheiten, NICHT Pip
  maxLookbackSec: number;
  closeCheckMaxAgeSec: number;
  obMaxDelaySec: number;
  nowTime: number;
}

export const TRADE_SETUP_DETECTOR_VERSION: string = core.TRADE_SETUP_DETECTOR_VERSION;
// Nur noch Analyse-Skripte (setup1Replay/backfillTradeSetups/setup1BuildSets): Alarme und Chart lesen
// H1 aus der Marktstruktur (setup1H1Levels). test/setup1ParityGuard.test.js hält Live-Pfade davon fern.
export const TRADE_SETUP_H1_FRACTAL_PERIOD = 10;

// Eine Quelle für die Tuning-Werte: priceChartConstants.js über tradeSetupParameters (Forex-Skala 1).
const { nowTime: _nowTime, ...forexDefaults } = tradeSetupParameters("GBPUSD", 0);
export const DEFAULT_TRADE_SETUP_PARAMS: Omit<TradeSetupParams, "nowTime"> = forexDefaults;

export const detectSetupObs = core.detectSetupObs as (candles: Candle[], minGapOverride?: number | null) => SetupOb[];
export const hasUninterruptedSweepReaction = core.hasUninterruptedSweepReaction as (
  setup: Pick<DetectedTradeSetup, "dir" | "ls" | "obStartTime"> & { sweeps?: SetupSweep[] }, setupObs: SetupOb[], m5Candles?: Candle[]) => boolean;
export const strongestSetupSweeps = core.strongestSetupSweeps as (sweeps: SetupSweep[]) => SetupSweep[];
export const detectTradeSetups = core.detectTradeSetups as (dir: 1 | -1, fractalLevels: LiquidityLevel[], h1Levels: LiquidityLevel[],
  m5Levels: LiquidityLevel[], setupObs: SetupOb[], params: TradeSetupParams, m5Candles: Candle[], sourceCandles?: Candle[]) => DetectedTradeSetup[];

// Neuestes alarmfähiges Setup je Richtung (gleiche Frist wie setup1AlarmCandidates) — für die
// Analyse-Skripte, die je Tick nur einen Treffer pro Richtung erwarten.
export function detectTradeSetup(dir: 1 | -1, fractalLevels: LiquidityLevel[], h1Levels: LiquidityLevel[], m5Levels: LiquidityLevel[],
  setupObs: SetupOb[], params: TradeSetupParams, m5Candles: Candle[], sourceCandles: Candle[] = m5Candles): DetectedTradeSetup | null {
  const fresh = detectTradeSetups(dir, fractalLevels, h1Levels, m5Levels, setupObs, params, m5Candles, sourceCandles)
    .filter((s) => s.obStartTime >= params.nowTime - params.maxLookbackSec);
  return fresh[fresh.length - 1] ?? null;
}
