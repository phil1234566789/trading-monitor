import { cssColor } from './chartColors.js';
import { lineWidth } from './chartLineWidths.js';
import { drawIconLabel } from './chartIconLabel.js';
import { drawScale } from './scaleRendering.js';
import { entryRiskSpec } from './entryRisk.js';

class EntryRenderer {
  constructor(point) { this.point = point; }
  draw(target) {
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
  }
}

class EntryPaneView {
  constructor(source) { this.source = source; this.point = { x: null, y: null }; }
  zOrder() { return 'top'; }
  update() {
    const { chart, series, entry } = this.source;
    const specs = [entryRiskSpec(entry.scales.wide, 'SL weit', 'rScale', entry.instrument),
      entryRiskSpec(entry.scales.narrow, 'SL eng', 'pipScale', entry.instrument)];
    this.point = { entry, x: chart.timeScale().timeToCoordinate(entry.candleTime), y: series.priceToCoordinate(entry.price),
      scales: specs.map(spec => spec && ({ ...spec, ticks: spec.levels.map(level => ({ ...level, y: series.priceToCoordinate(level.price) })) })) };
  }
  renderer() { return new EntryRenderer(this.point); }
}

export class M1EntryPrimitive {
  constructor(entry) { this.entry = entry; this.views = [new EntryPaneView(this)]; }
  attached({ chart, series, requestUpdate }) { this.chart = chart; this.series = series; this.requestUpdate = requestUpdate; requestUpdate(); }
  detached() { this.chart = null; this.series = null; this.requestUpdate = null; }
  updateAllViews() { if (this.chart) this.views.forEach(view => view.update()); }
  paneViews() { return this.views; }
}

export function renderM1Entry(series, entry, primitives, candles, currentBar) {
  // Eine M1-Bestätigung darf auf M5 nicht an eine frühere Aggregatkerze zurückspringen.
  const visible = currentBar === '1m' && entry && candles.some(c => c.time === entry.candleTime) ? entry : null;
  if (visible && primitives[0]?.entry.id === visible.id) {
    primitives[0].entry = visible;
    primitives[0].requestUpdate?.();
    return;
  }
  for (const primitive of primitives) series.detachPrimitive(primitive);
  primitives.length = 0;
  if (visible) {
    const primitive = new M1EntryPrimitive(visible);
    series.attachPrimitive(primitive);
    primitives.push(primitive);
  }
}
