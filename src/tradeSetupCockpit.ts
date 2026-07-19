// Trade-Setup-Cockpit (TSC): eine Karte im Chart, die die aktuelle Analyse aus mehreren, bereits
// bestehenden Quellen bündelt (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles
// zusammenstöpseln", "ein 1h-LQ-Sweep allein reicht nicht"). Reine Anzeige/Aggregation, KEINE
// eigene Erkennungslogik — liest nur den schon berechneten MarketStructureState (H1,
// marketStructureAnalysis.ts) und die schon berechneten Trade-Setups (M5, tradeSetup.js) und
// stellt sie zusammengefasst dar.
import type { MarketStructureState, Pivot } from "./range.type";
import { cssColor, cssColorScaled } from "./chartColors.js";

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
export function computeCockpitState(structureState: MarketStructureState | null, tradeSetups: any[]): CockpitState {
  const h1Trend = structureState?.trend ?? "unknown";
  const h1LqSweep = structureState?.structurePivots.find((p) => p.type === "LQ-sweep") ?? null;
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
// Pane-Rand, vertikal mittig (wie bisher das "1h uptrend"-Label, siehe marketStructureAnalysis.ts:
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
// Abstand zur letzten Kerze im 'candle'-Modus — Default nur der Fallback, wenn renderTradeSetupCockpit
// ohne candleOffset aufgerufen wird. Konfigurierbar seit Chat 2026-07-19 ("etwas zu eng, am besten
// Abstand konfigurabel machen"), siehe candleOffset-Parameter unten / Dashboard.vue-Dropdown.
const DEFAULT_CANDLE_OFFSET = 24;

// Positions-Toggle DIREKT an der Karte (siehe Chat 2026-07-19: "Ein extra Toggle im TSC selbst
// bitte" — zusätzlich zum bestehenden Toolbar-Dropdown, nicht als Ersatz). Kleines Badge oben
// rechts an der Karte statt die ganze Karte klickbar zu machen, damit spätere Klicks auf die
// Karte selbst (z.B. fürs Chart dahinter) nicht versehentlich die Position umschalten.
const BADGE_RADIUS = 9;
const CARD_RADIUS = 8; // abgerundete Ecken (siehe Chat 2026-07-19), CSS-Pixel

// Karten-Hintergrund/-Rand färben sich nach der M5-Setup-Richtung ein (Long=grün, Short=rot) —
// bewusst NICHT dieselben Farben wie die M5-LS-Linie/OB-Box (tradeSetupLong/-Short, siehe
// buildLines) - das bleibt laut Philip unabhängig ("es kann ein Short Setup geben mit 1h
// uptrend, das ist damit ich es gut einordnen kann"). Stattdessen die im Rest der App schon
// etablierte grün/rot-Semantik (candleUp/candleDown, auch tradeWin/tradeLoss) — Grün/Rot heißt
// hier "Long/Short", nicht "Trend" oder "Erfolg".
function cardAccentColors(state: CockpitState): { fill: string; border: string } | null {
  if (!state.m5Setup) return null;
  const key = state.m5Setup.dir === -1 ? "candleUp" : "candleDown";
  return { fill: cssColorScaled(key, 0.16), border: cssColor(key) };
}

// Karte mit abgerundeten Ecken statt ctx.rect (siehe Chat: "Ecken abrunden ;D") — eigener Pfad
// statt ctx.roundRect, weil letzteres in älteren Electron/Chromium-Ständen fehlen kann.
function roundedRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface HitBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

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
  private _primitive: TradeSetupCockpitPrimitive;
  private _candleOffset: number;
  private _accent: { fill: string; border: string } | null;

  constructor(
    mode: "fixed" | "candle",
    point: { x: number | null; y: number | null },
    lines: Line[],
    primitive: TradeSetupCockpitPrimitive,
    candleOffset: number,
    accent: { fill: string; border: string } | null,
  ) {
    this._mode = mode;
    this._point = point;
    this._lines = lines;
    this._primitive = primitive;
    this._candleOffset = candleOffset;
    this._accent = accent;
  }

  draw(target: any) {
    if (this._lines.length === 0 || (this._mode === "candle" && (this._point.x === null || this._point.y === null))) {
      this._primitive._hitBox = null;
      return;
    }

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
        boxLeft = Math.round((this._point.x as number) * scope.horizontalPixelRatio) + Math.round(this._candleOffset * scope.horizontalPixelRatio);
        boxTop = Math.round((this._point.y as number) * scope.verticalPixelRatio) - boxHeight / 2;
      }

      // Dunkler Grund IMMER zuerst (Textlesbarkeit) — bei aktivem M5-Setup kommt darüber ein
      // grüner/roter Tint + kräftigerer Rand (siehe Chat 2026-07-19: "Long -> grün, Short -> rot,
      // Ecken abrunden"). Ohne Setup bleibt die Karte neutral wie bisher.
      const radius = Math.round(CARD_RADIUS * scope.horizontalPixelRatio);
      roundedRectPath(ctx, boxLeft, boxTop, boxWidth, boxHeight, radius);
      ctx.fillStyle = "rgba(19, 23, 34, 0.92)";
      ctx.fill();
      if (this._accent) {
        roundedRectPath(ctx, boxLeft, boxTop, boxWidth, boxHeight, radius);
        ctx.fillStyle = this._accent.fill;
        ctx.fill();
      }
      roundedRectPath(ctx, boxLeft, boxTop, boxWidth, boxHeight, radius);
      ctx.strokeStyle = this._accent ? this._accent.border : "rgba(120, 123, 134, 0.5)";
      ctx.lineWidth = this._accent ? Math.max(1.5, Math.round(1.5 * scope.horizontalPixelRatio)) : 1;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      this._lines.forEach((line, i) => {
        ctx.font = fontFor(line.bold);
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, boxLeft + padding, boxTop + padding + lineHeight * i + lineHeight / 2);
      });

      // Positions-Toggle-Badge, oben rechts an der Karte (siehe Chat: "Ein extra Toggle im TSC
      // selbst"). hitBox wird in CSS-Pixeln (nicht Bitmap-skaliert) gespeichert, weil
      // chart.subscribeClick() (siehe PriceChart.vue) Klickpunkte in CSS-Pixeln liefert.
      const badgeRadius = Math.round(BADGE_RADIUS * scope.horizontalPixelRatio);
      const badgeCenterX = boxLeft + boxWidth - badgeRadius * 0.9;
      const badgeCenterY = boxTop + badgeRadius * 0.9;
      ctx.beginPath();
      ctx.arc(badgeCenterX, badgeCenterY, badgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(41, 98, 255, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(19, 23, 34, 0.9)";
      ctx.lineWidth = Math.max(1, Math.round(scope.horizontalPixelRatio));
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(11 * scope.verticalPixelRatio)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⇄", badgeCenterX, badgeCenterY + Math.round(scope.verticalPixelRatio));

      this._primitive._hitBox = {
        left: (badgeCenterX - badgeRadius) / scope.horizontalPixelRatio,
        top: (badgeCenterY - badgeRadius) / scope.verticalPixelRatio,
        width: (badgeRadius * 2) / scope.horizontalPixelRatio,
        height: (badgeRadius * 2) / scope.verticalPixelRatio,
      };
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
    return new CockpitRenderer(
      this._source._mode,
      this._point,
      this._source._lines,
      this._source,
      this._source._candleOffset,
      this._source._accent,
    );
  }
}

export class TradeSetupCockpitPrimitive {
  _lines: Line[];
  _mode: "fixed" | "candle";
  _candles: Candle[];
  _candleOffset: number;
  _accent: { fill: string; border: string } | null;
  _paneViews: CockpitPaneView[];
  _chart: any;
  _series: any;
  _hitBox: HitBox | null;

  constructor(
    lines: Line[],
    mode: "fixed" | "candle",
    candles: Candle[],
    candleOffset: number,
    accent: { fill: string; border: string } | null,
  ) {
    this._lines = lines;
    this._mode = mode;
    this._candles = candles;
    this._candleOffset = candleOffset;
    this._accent = accent;
    this._paneViews = [new CockpitPaneView(this)];
    this._chart = null;
    this._series = null;
    this._hitBox = null;
  }

  // Klick-Hittest fürs Positions-Toggle-Badge (siehe CockpitRenderer.draw) — point in CSS-Pixeln,
  // wie von chart.subscribeClick() geliefert (siehe PriceChart.vue).
  hitTestToggle(point: { x: number; y: number }): boolean {
    const box = this._hitBox;
    if (!box) return false;
    return point.x >= box.left && point.x <= box.left + box.width && point.y >= box.top && point.y <= box.top + box.height;
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

// Ersetzt existingPrimitives komplett (siehe renderMarketStructureAnalysis-Vorbild). state=null -> nur
// aufräumen, keine Karte. mode: 'fixed' (Default) oder 'candle', siehe oben. candleOffset nur im
// 'candle'-Modus relevant, siehe DEFAULT_CANDLE_OFFSET.
export function renderTradeSetupCockpit(
  series: any,
  state: CockpitState | null,
  existingPrimitives: any[],
  candles: Candle[],
  {
    mode = "fixed",
    formatPrice = (p: number) => String(p),
    candleOffset = DEFAULT_CANDLE_OFFSET,
  }: { mode?: "fixed" | "candle"; formatPrice?: (price: number) => string; candleOffset?: number } = {},
) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!state) return;

  const lines = buildLines(state, formatPrice);
  const accent = cardAccentColors(state);
  const primitive = new TradeSetupCockpitPrimitive(lines, mode, candles, candleOffset, accent);
  series.attachPrimitive(primitive);
  existingPrimitives.push(primitive);
}
