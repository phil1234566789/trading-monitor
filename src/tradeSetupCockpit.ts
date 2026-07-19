// Trade-Setup-Cockpit (TSC): eine Karte im Chart, die die aktuelle Analyse aus mehreren, bereits
// bestehenden Quellen bündelt (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles
// zusammenstöpseln", "ein 1h-LQ-Sweep allein reicht nicht"). Reine Anzeige/Aggregation, KEINE
// eigene Erkennungslogik — liest nur den schon berechneten RangeState (H1, rangeAnalysis.ts) und
// die schon berechneten Trade-Setups (M5, tradeSetup.js) und stellt sie zusammengefasst dar.
import type { RangeState, Pivot } from "./range.type";
import { cssColor } from "./chartColors.js";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Locker getypt (any) statt einer eigenen TradeSetup-Interface-Kopie — die eigentliche Form kommt
// aus detectTradeSetups() in tradeSetup.js (JS, kein eigener Typ dort) und wird hier nur gelesen,
// nicht verändert.
export interface CockpitState {
  h1Trend: "unknown" | "uptrend" | "downtrend";
  h1LqSweep: Pivot | null;
  m5Setup: {
    dir: 1 | -1;
    label: string;
    lsPrice: number;
    obTop: number;
    obBottom: number;
  } | null;
}

// tradeSetups: die schon von computeTradeSetups() berechnete Liste (siehe PriceChart.vue,
// chronologisch) — nimmt den zeitlich JÜNGSTEN (letzten) Eintrag, unabhängig von Richtung, als
// "die aktuell relevante" Analyse. Bewusst NICHT geprüft, ob h1LqSweep und der M5-LQ-Sweep aus
// m5Setup derselbe sind — das ist laut Philip nicht immer der Fall (Trade-Setups bezieht auch
// kleinere LQ-Sweeps mit ein) und wird hier nur nebeneinander dargestellt, nicht verglichen.
export function computeCockpitState(rangeState: RangeState | null, tradeSetups: any[]): CockpitState {
  const h1Trend = rangeState?.trend ?? "unknown";
  const h1LqSweep = rangeState?.structurePivots.find((p) => p.type === "LQ-sweep") ?? null;
  const last = tradeSetups.length > 0 ? tradeSetups[tradeSetups.length - 1] : null;
  const m5Setup = last
    ? {
        dir: last.dir as 1 | -1,
        label: last.label as string,
        lsPrice: last.ls.price as number,
        obTop: last.obTop as number,
        obBottom: last.obBottom as number,
      }
    : null;
  return { h1Trend, h1LqSweep, m5Setup };
}

// --- Zeichnung ----------------------------------------------------------------------------------
// Zwei Positionsmodi (siehe Chat: "WENN MÖGLICH: einen Toggle einfügen"): 'fixed' — rechter
// Pane-Rand, vertikal mittig (wie bisher das "1h uptrend"-Label, siehe rangeAnalysis.ts:
// TrendLabelPrimitive) — und 'candle' — rechts neben der letzten geladenen Kerze, mit Abstand.

interface Line {
  text: string;
  color: string;
  bold?: boolean;
}

const FONT_SIZE = 15;
const LINE_HEIGHT = 24;
const PADDING = 16;
const EDGE_MARGIN = 12; // Abstand zum Pane-Rand im 'fixed'-Modus
const CANDLE_OFFSET = 14; // Abstand zur letzten Kerze im 'candle'-Modus

function buildLines(state: CockpitState, formatPrice: (price: number) => string): Line[] {
  const lines: Line[] = [{ text: "Trade-Setup-Cockpit", color: "rgba(209, 212, 220, 0.8)", bold: true }];

  if (state.h1Trend !== "unknown") {
    const color = state.h1Trend === "uptrend" ? cssColor("rangeLow") : cssColor("rangeHigh");
    lines.push({ text: `1h ${state.h1Trend}`, color });
  }
  if (state.h1LqSweep) {
    lines.push({ text: `1h LQ-Sweep @ ${formatPrice(state.h1LqSweep.price)}`, color: cssColor("rangeLqSweep") });
  }
  if (state.m5Setup) {
    const color = cssColor(state.m5Setup.dir === -1 ? "tradeSetupLong" : "tradeSetupShort");
    lines.push({ text: `M5 ${state.m5Setup.label} Setup`, color });
    lines.push({ text: `  LQ-Sweep @ ${formatPrice(state.m5Setup.lsPrice)}`, color });
    lines.push({ text: `  M5-OB ${formatPrice(state.m5Setup.obBottom)}–${formatPrice(state.m5Setup.obTop)}`, color });
  }
  if (lines.length === 1) {
    lines.push({ text: "keine aktive Analyse", color: "rgba(120, 123, 134, 0.9)" });
  }
  return lines;
}

class CockpitRenderer {
  private _mode: "fixed" | "candle";
  private _point: { x: number | null; y: number | null };
  private _lines: Line[];

  constructor(mode: "fixed" | "candle", point: { x: number | null; y: number | null }, lines: Line[]) {
    this._mode = mode;
    this._point = point;
    this._lines = lines;
  }

  draw(target: any) {
    if (this._lines.length === 0) return;
    if (this._mode === "candle" && (this._point.x === null || this._point.y === null)) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const fontSize = Math.round(FONT_SIZE * scope.verticalPixelRatio);
      const lineHeight = Math.round(LINE_HEIGHT * scope.verticalPixelRatio);
      const padding = Math.round(PADDING * scope.horizontalPixelRatio);
      const fontFor = (bold?: boolean) => `${bold ? "bold " : ""}${fontSize}px sans-serif`;
      ctx.font = fontFor(false);

      let maxWidth = 0;
      for (const line of this._lines) {
        ctx.font = fontFor(line.bold);
        maxWidth = Math.max(maxWidth, ctx.measureText(line.text).width);
      }
      const boxWidth = maxWidth + padding * 2;
      const boxHeight = this._lines.length * lineHeight + padding * 2;

      let boxLeft: number;
      let boxTop: number;
      if (this._mode === "fixed") {
        boxLeft = scope.bitmapSize.width - boxWidth - Math.round(EDGE_MARGIN * scope.horizontalPixelRatio);
        boxTop = (scope.bitmapSize.height - boxHeight) / 2;
      } else {
        boxLeft = Math.round((this._point.x as number) * scope.horizontalPixelRatio) + Math.round(CANDLE_OFFSET * scope.horizontalPixelRatio);
        boxTop = Math.round((this._point.y as number) * scope.verticalPixelRatio) - boxHeight / 2;
      }

      ctx.fillStyle = "rgba(19, 23, 34, 0.92)";
      ctx.strokeStyle = "rgba(120, 123, 134, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(boxLeft, boxTop, boxWidth, boxHeight);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      this._lines.forEach((line, i) => {
        ctx.font = fontFor(line.bold);
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, boxLeft + padding, boxTop + padding + lineHeight * i + lineHeight / 2);
      });
    });
  }
}

class CockpitPaneView {
  private _source: TradeSetupCockpitPrimitive;
  private _point: { x: number | null; y: number | null };

  constructor(source: TradeSetupCockpitPrimitive) {
    this._source = source;
    this._point = { x: null, y: null };
  }

  update() {
    if (this._source._mode !== "candle" || !this._source._chart || !this._source._series || this._source._candles.length === 0) {
      this._point = { x: null, y: null };
      return;
    }
    const last = this._source._candles[this._source._candles.length - 1];
    this._point = {
      x: this._source._chart.timeScale().timeToCoordinate(last.time),
      y: this._source._series.priceToCoordinate(last.close),
    };
  }

  renderer() {
    return new CockpitRenderer(this._source._mode, this._point, this._source._lines);
  }
}

export class TradeSetupCockpitPrimitive {
  _lines: Line[];
  _mode: "fixed" | "candle";
  _candles: Candle[];
  _paneViews: CockpitPaneView[];
  _chart: any;
  _series: any;

  constructor(lines: Line[], mode: "fixed" | "candle", candles: Candle[]) {
    this._lines = lines;
    this._mode = mode;
    this._candles = candles;
    this._paneViews = [new CockpitPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }: { chart: any; series: any; requestUpdate: () => void }) {
    this._chart = chart;
    this._series = series;
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

// Ersetzt existingPrimitives komplett (siehe renderRangeAnalysis-Vorbild). state=null -> nur
// aufräumen, keine Karte. mode: 'fixed' (Default) oder 'candle', siehe oben.
export function renderTradeSetupCockpit(
  series: any,
  state: CockpitState | null,
  existingPrimitives: any[],
  candles: Candle[],
  { mode = "fixed", formatPrice = (p: number) => String(p) }: { mode?: "fixed" | "candle"; formatPrice?: (price: number) => string } = {},
) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!state) return;

  const lines = buildLines(state, formatPrice);
  const primitive = new TradeSetupCockpitPrimitive(lines, mode, candles);
  series.attachPrimitive(primitive);
  existingPrimitives.push(primitive);
}
