import { cssColor } from './chartColors.js';
import { lineWidth } from './chartLineWidths.js';
import { drawIconLabel } from './chartIconLabel.js';
import { drawScale } from './scaleRendering.js';
import { entryRiskSpec } from './entryRisk.js';
import { chartEventBarTime, chartEventCoordinate } from './chartEventCoordinate.js';
import { barSecondsFor } from './timeframes.js';
import { formatDatedTime, formatBerlinTime } from './berlinTime.js';

class EntryRenderer {
  constructor(point) { this.point = point; }
  draw(target) {
    this.point.box = null;
    const { x, y, entry, scales } = this.point;
    if (x == null || y == null) return;
    let columns;
    target.useBitmapCoordinateSpace(scope => {
      const { context: ctx, horizontalPixelRatio: hx, verticalPixelRatio: vy, bitmapSize } = scope;
      const width = bitmapSize.width / hx;
      if (x < 0 || x > width || y < 0 || y > bitmapSize.height / vy) return;
      // Zwei feste Textspalten im freien rechten Bereich; Clamping hält Labels im Pane.
      const right = Math.min(x + 450, width - 34);
      columns = [Math.max(190, right - 210), right];
      const boxX = Math.max(8, Math.min(x + 64, columns[0] - 125));
      const px = Math.round(x * hx), py = Math.round(y * vy) + 0.5;
      const bx = boxX * hx, by = (y - 17) * vy, bw = 105 * hx, bh = 34 * vy;
      this.point.box = { left: boxX, right: boxX + 105, top: y - 17, bottom: y + 17 };
      const color = cssColor('tradeConfirmation');
      ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, lineWidth('tradeConfirmation') * hx);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(columns[1] * hx, py); ctx.stroke();
      ctx.fillStyle = '#131722'; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#d1d4dc';
      drawIconLabel(ctx, { text: entry.label, x: bx + bw / 2, y: py,
        align: 'center', baseline: 'middle', fontSizePx: 14 * vy, fontFamily: 'sans-serif' });
      scales.forEach((scale, i) => {
        ctx.fillStyle = '#d1d4dc';
        const text = scale ? scale.summary : `${i ? 'Eng' : 'Weit'}: Risiko unbekannt`;
        // RR bleibt lesbar, wenn ein Ziel außerhalb des sichtbaren Preisbereichs liegt.
        drawIconLabel(ctx, { text, x: columns[i] * hx, y: (y + 32) * vy,
          align: 'right', baseline: 'middle', fontSizePx: 11 * vy, fontFamily: 'sans-serif' });
      });
    });
    if (columns) scales.forEach((scale, i) => {
      if (scale) drawScale(target, { ...scale, x: columns[i], anchorY: y, labelColor: '#d1d4dc' });
    });
    // Tooltip zuletzt zeichnen, damit SL-/Zieltexte ihn nicht überlagern.
    if (this.point.hovered && this.point.box) target.useBitmapCoordinateSpace(scope => {
        const { context: ctx, horizontalPixelRatio: hx, verticalPixelRatio: vy, bitmapSize } = scope;
        const tx = Math.max(8, Math.min(this.point.box.left, bitmapSize.width / hx - 340)), ty = Math.max(8, y - 72);
        ctx.fillStyle = '#1e222d'; ctx.fillRect(tx * hx, ty * vy, 332 * hx, 44 * vy);
        ctx.fillStyle = '#d1d4dc';
        [`M1-Bestätigung: ${formatDatedTime(entry.candleTime)}`,
          `Bekannt ab ${formatBerlinTime(entry.recognizedAt)} Uhr · Europe/Berlin`].forEach((text, i) =>
          drawIconLabel(ctx, { text, x: (tx + 8) * hx, y: (ty + 13 + i * 18) * vy,
            align: 'left', baseline: 'middle', fontSizePx: 11 * vy, fontFamily: 'sans-serif' }));
    });
  }
}

class EntryPaneView {
  constructor(source) { this.source = source; this.point = { x: null, y: null }; }
  zOrder() { return 'top'; }
  update() {
    const { chart, series, entry, candles, currentBar, hovered } = this.source;
    const specs = ['wide','narrow'].filter(v=>!this.source.variant||v===this.source.variant).map(v=>
      entryRiskSpec(entry.scales[v],v==='wide'?'SL weit':'SL eng',v==='wide'?'rScale':'pipScale',entry.instrument));
    this.point = { entry, hovered, box: this.point.box, x: chartEventCoordinate(chart.timeScale(), candles, entry.candleTime, barSecondsFor(currentBar)), y: series.priceToCoordinate(entry.price),
      scales: specs.map(spec => spec && ({ ...spec, ticks: spec.levels.map(level => ({ ...level, y: series.priceToCoordinate(level.price) })) })) };
  }
  renderer() { return new EntryRenderer(this.point); }
}

export class M1EntryPrimitive {
  constructor(entry, candles = [{ time: entry.candleTime }], currentBar = '1m') {
    this.entry = entry; this.candles = candles; this.currentBar = currentBar; this.views = [new EntryPaneView(this)];
    this.onMove = ({ point }) => {
      const box = this.views[0].point.box;
      const hovered = !!(point && box && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
      if (hovered !== this.hovered) { this.hovered = hovered; this.requestUpdate?.(); }
    };
  }
  attached({ chart, series, requestUpdate }) {
    this.chart = chart; this.series = series; this.requestUpdate = requestUpdate;
    chart.subscribeCrosshairMove(this.onMove); requestUpdate();
  }
  detached() { this.chart?.unsubscribeCrosshairMove(this.onMove); this.chart = null; this.series = null; this.requestUpdate = null; }
  updateAllViews() { if (this.chart) this.views.forEach(view => view.update()); }
  paneViews() { return this.views; }
}

export function renderM1Entry(series, entry, primitives, candles, currentBar, variant) {
  // Der Evaluator liefert nur bereits bekannte Entries; hier zusätzlich echte
  // Abdeckung prüfen, damit Replay-/Timeframewechsel nichts an den Rand klemmen.
  const seconds = barSecondsFor(currentBar);
  const visible = (Array.isArray(entry)?entry:[entry]).filter(e=>['1m','5m'].includes(currentBar)&&e
    &&chartEventBarTime(candles,e.candleTime,seconds)!=null);
  const previous=new Map(primitives.map(p=>[p.entry.id,p]));
  for (const primitive of primitives) if(!visible.some(e=>e.id===primitive.entry.id))series.detachPrimitive(primitive);
  primitives.length = 0;
  for (const item of visible) {
    const primitive = previous.get(item.id) ?? new M1EntryPrimitive(item, candles, currentBar);
    primitive.entry=item;primitive.candles=candles;primitive.currentBar=currentBar;
    primitive.variant = variant;
    if(!previous.has(item.id))series.attachPrimitive(primitive);
    else primitive.requestUpdate?.();
    primitives.push(primitive);
  }
}
