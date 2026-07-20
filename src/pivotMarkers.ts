import { snapToBarTime } from "./chartTimeUtils.js";
import type { Pivot } from "./range.type";

// Reines Chart-Rendering-Glue für die Ranges-Debug-Pivot-Marker (siehe PriceChart.vue:
// refreshRangesMarkersInternal): Punkt + Preis-Label je erkanntem Fraktal-Pivot. Hieß bis Chat
// 2026-07-19 trendZigzag.ts/Zigzag* — dort lag ursprünglich auch der (inzwischen gelöschte, siehe
// marketStructureAnalysis.ts) Zigzag-Trendalgorithmus samt Verbindungslinien zwischen den Pivots.
// Übrig geblieben ist reines Punkt+Label-Zeichnen ohne jede Verbindungslinie — umbenannt, damit
// der Name zeigt, was hier tatsächlich passiert.

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Eine Gruppe = eine Farbe = ein Primitive (siehe renderPivotMarkers unten). Alle Pivots EINER
// Gruppe landen im selben Primitive, damit PivotMarkerRenderer.draw() ihre Preis-Labels
// gemeinsam entzerren kann (siehe dort) — nicht ein Primitive pro einzelnem Pivot.
export interface PivotMarkerGroup {
  points: Pivot[];
  color: string;
}

// Die lightweight-charts-Anbindung (Primitive/PaneView/Renderer) bleibt bewusst locker getypt
// (any) — das ist reines Chart-Rendering-Glue, nicht die Domain-Logik in marketStructureAnalysis.ts.
interface RenderOptions {
  color: string;
  showLabels: boolean;
  formatPrice?: (price: number) => string;
  dotRadius?: number; // Basis-Radius in CSS-Pixeln (vor pixelRatio-Skalierung), Default 3 — siehe
  // Ranges-Periode-2-Debug-Marker (Chat 2026-07-19): sollen kleiner sein als die Periode-5-Marker.
}

class PivotMarkerRenderer {
  private _points: any[];
  private _options: RenderOptions;

  constructor(points: any[], options: RenderOptions) {
    this._points = points; // [{x,y,label}] in Pane-Koordinaten, siehe PivotMarkerPaneView.update()
    this._options = options;
  }

  draw(target: any) {
    const pts = this._points.filter((p) => p.x !== null && p.y !== null);
    if (pts.length === 0) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const toX = (x: number) => Math.round(x * scope.horizontalPixelRatio);
      const toY = (y: number) => Math.round(y * scope.verticalPixelRatio);

      const dotRadius = (this._options.dotRadius ?? 3) * scope.horizontalPixelRatio;
      pts.forEach((p) => {
        const x = toX(p.x);
        const y = toY(p.y);
        ctx.fillStyle = this._options.color;
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Preis-Labels ENTZERRT statt jedes stur an seinem eigenen y (Bug-Report Philip 2026-07-19:
      // im M5-Replay mit Debug-Modus lagen alle H1-Pivot-Preis-Labels eng übereinander, weil
      // vorher ein Primitive PRO Pivot lief und draw() nie alle Labels einer Gruppe gleichzeitig
      // sah). Nach y sortiert einmal durchlaufen und jedes Label, das näher als minGap am vorigen
      // (schon entzerrten) Label liegt, nach unten schieben — Dots bleiben an der echten
      // Preis-Position, nur die Labels rutschen auseinander.
      if (this._options.showLabels) {
        ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.textBaseline = "bottom";
        ctx.textAlign = "left";
        ctx.fillStyle = this._options.color;
        const minGap = 11 * scope.verticalPixelRatio;
        const sorted = pts
          .filter((p) => p.label)
          .map((p) => ({ p, x: toX(p.x), y: toY(p.y) - 4 * scope.verticalPixelRatio }))
          .sort((a, b) => a.y - b.y);
        // Cluster statt globalem Kaskaden-Push (Bug-Report Philip 2026-07-20: bei vielen dicht
        // beieinanderliegenden Pivots, z.B. Periode-2-Debug-Marker, schob der alte Ansatz jedes
        // Label relativ zum VORHERIGEN, bereits verschobenen Label nach unten — bei einem langen
        // Cluster driftete das letzte Label so weit von seinem tatsächlichen Punkt weg, dass die
        // Y-Position nicht mehr zum Punkt passte (X blieb korrekt). Eng beieinanderliegende Labels
        // (natürlicher Abstand < minGap) bilden jetzt einen Cluster und werden EVENLY um ihren
        // eigenen Mittelwert verteilt statt global weitergeschoben — Drift bleibt an die
        // Clustergröße gebunden statt an die Gesamtzahl aller Punkte.
        let i = 0;
        while (i < sorted.length) {
          let j = i + 1;
          while (j < sorted.length && sorted[j].y - sorted[j - 1].y < minGap) j++;
          const cluster = sorted.slice(i, j);
          const meanY = cluster.reduce((sum, entry) => sum + entry.y, 0) / cluster.length;
          const startY = meanY - ((cluster.length - 1) * minGap) / 2;
          cluster.forEach((entry, idx) => {
            ctx.fillText(entry.p.label, entry.x + 6 * scope.horizontalPixelRatio, startY + idx * minGap);
          });
          i = j;
        }
      }
    });
  }

  get points() {
    return this._points;
  }
}

class PivotMarkerPaneView {
  private _source: PivotMarkerPrimitive;
  private _points: any[];

  constructor(source: PivotMarkerPrimitive) {
    this._source = source;
    this._points = [];
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const candles = this._source._candles;
    const formatPrice = this._source._options.formatPrice;

    this._points = this._source._pivots.map((p) => {
      // BEWUSST kein snapToBarTime-Clamp für zu alte/zu neue Pivots (anders als liquidity.js/
      // orderBlocks.js/tradeMarkers.js, die snapToBarTime für Linien/Zonen nutzen, wo "an den Rand
      // geklemmt" ein sinnvoller Kompromiss ist) — hier sind die Pivots H1-Marker, `candles` aber
      // die Hauptkerzen des AKTUELLEN Chart-Timeframes (siehe PivotMarkerPrimitive/refreshRanges-
      // MarkersInternal), deren geladenes Fenster auf M5 (~3,5 Tage bei INITIAL_CANDLE_COUNT=1000)
      // viel kürzer sein kann als der Ranges-Lookback (Default 7 Tage). Ohne diesen Check clampt
      // snapToBarTime JEDEN zu alten Pivot auf dieselbe früheste geladene M5-Kerze — Dutzende
      // Preis-Labels stapeln sich dann exakt an derselben X-Position übereinander (Bug-Report
      // Philip 2026-07-19: "im M5 sind die Debug-Pivot-Punkte ... immer noch so komisch", auf 1h
      // unsichtbar, weil 1000 H1-Kerzen mit ~41 Tagen den 7-Tage-Lookback locker abdecken). Liegt
      // ein Pivot außerhalb des geladenen Fensters, lassen wir ihn stattdessen einfach weg (x=null,
      // von draw() schon gefiltert) statt ihn an den Rand zu quetschen.
      const inLoadedRange =
        p.pivotTime != null && candles.length > 0 && p.pivotTime >= candles[0].time && p.pivotTime <= candles[candles.length - 1].time;
      const barTime = inLoadedRange ? snapToBarTime(candles, p.pivotTime) : null;
      return {
        x: barTime != null ? timeScale.timeToCoordinate(barTime) : null,
        y: series.priceToCoordinate(p.price),
        label: formatPrice ? formatPrice(p.price) : null,
      };
    });
  }

  renderer() {
    return new PivotMarkerRenderer(this._points, this._source._options);
  }
}

export class PivotMarkerPrimitive {
  _pivots: Pivot[]; // chronologisch
  _options: RenderOptions;
  _candles: Candle[];
  _paneViews: PivotMarkerPaneView[];
  _chart: any;
  _series: any;

  constructor(pivots: Pivot[], options: RenderOptions, candles: Candle[]) {
    this._pivots = pivots;
    this._options = options;
    this._candles = candles;
    this._paneViews = [new PivotMarkerPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }: { chart: any; series: any; requestUpdate: () => void }) {
    this._chart = chart;
    this._series = series;
    requestUpdate(); // siehe LiquidityLinePrimitive — sonst haengt ein Primitive-Wechsel in der Luft
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

// Ersetzt existingPrimitives komplett durch die aktuellen Pivot-Marker-Gruppen — analog zu
// renderLiquidityLevels in liquidity.js. Ein Primitive je Gruppe, damit jede ihre eigene Farbe
// bekommt (z.B. Periode-5 vs. Periode-2 Ranges-Debug-Marker) UND ihre Labels gemeinsam entzerrt
// werden (siehe PivotMarkerRenderer.draw) — deshalb alle Pivots EINER Farbe in EINER Gruppe
// sammeln, nicht pro Pivot eine eigene.
export function renderPivotMarkers(
  series: any,
  groups: PivotMarkerGroup[],
  existingPrimitives: PivotMarkerPrimitive[],
  candles: Candle[],
  options: {
    showLabels?: boolean;
    formatPrice?: (price: number) => string;
    dotRadius?: number;
  } = {},
) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!groups || candles.length === 0) return;

  for (const group of groups) {
    if (!group.points || group.points.length === 0) continue;
    const primitive = new PivotMarkerPrimitive(
      group.points,
      {
        color: group.color,
        showLabels: options.showLabels ?? false,
        formatPrice: options.formatPrice,
        dotRadius: options.dotRadius,
      },
      candles,
    );
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
