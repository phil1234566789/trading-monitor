import { snapToBarTime } from "./chartTimeUtils.js";
import { canShowLabels } from "./chartZoom.js";
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

// Eine Gruppe = eine Farbe (z.B. Periode-5 vs. Periode-2 Ranges-Debug-Marker). Seit Chat 2026-07-26
// laufen ALLE Gruppen EINES renderPivotMarkers-Aufrufs durch EIN gemeinsames Primitive (siehe
// renderPivotMarkers unten) — nicht mehr eines pro Gruppe —, damit PivotMarkerRenderer.draw() beim
// Entzerren ALLE Labels (unabhängig von der Gruppe) gleichzeitig sieht. Bug-Report Philip
// 2026-07-26: "wenn ein outer und innerpivot auf demselben Punkt liegen, sind die Labels leicht
// verschoben" — vorher lief pro Gruppe ein EIGENES Primitive mit eigenem Entzerr-Durchlauf; zwei
// exakt deckungsgleiche Punkte aus verschiedenen Gruppen (z.B. derselbe Preis als Periode-5- UND
// Periode-2-Pivot) hatten dadurch unterschiedliche NACHBARN in ihrer jeweiligen Gruppe und wurden
// dadurch unterschiedlich weit verschoben, obwohl ihre wahre Position identisch war.
export interface PivotMarkerGroup {
  points: Pivot[];
  color: string;
  dotRadius?: number; // Basis-Radius in CSS-Pixeln (vor pixelRatio-Skalierung), Default 3 — siehe
  // Ranges-Periode-2-Debug-Marker (Chat 2026-07-19): sollen kleiner sein als die Periode-5-Marker.
}

// Die lightweight-charts-Anbindung (Primitive/PaneView/Renderer) bleibt bewusst locker getypt
// (any) — das ist reines Chart-Rendering-Glue, nicht die Domain-Logik in marketStructureAnalysis.ts.
interface RenderOptions {
  showLabels: boolean;
  formatPrice?: (price: number) => string;
}

class PivotMarkerRenderer {
  private _points: any[];
  private _options: RenderOptions;
  private _chart: any;
  private _candles: any[];

  constructor(points: any[], options: RenderOptions, chart: any, candles: any[]) {
    this._points = points; // [{x,y,label,color,dotRadius}] in Pane-Koordinaten, siehe PivotMarkerPaneView.update()
    this._options = options;
    this._chart = chart;
    this._candles = candles;
  }

  draw(target: any) {
    const pts = this._points.filter((p) => p.x !== null && p.y !== null);
    if (pts.length === 0) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const toX = (x: number) => Math.round(x * scope.horizontalPixelRatio);
      const toY = (y: number) => Math.round(y * scope.verticalPixelRatio);

      pts.forEach((p) => {
        const x = toX(p.x);
        const y = toY(p.y);
        const dotRadius = p.dotRadius * scope.horizontalPixelRatio;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Preis-Labels ENTZERRT statt jedes stur an seinem eigenen y (Bug-Report Philip 2026-07-19:
      // im M5-Replay mit Debug-Modus lagen alle H1-Pivot-Preis-Labels eng übereinander, weil
      // vorher ein Primitive PRO Pivot lief und draw() nie alle Labels einer Gruppe gleichzeitig
      // sah). Nach y sortiert einmal durchlaufen und jedes Label, das näher als minGap am vorigen
      // (schon entzerrten) Label liegt, nach unten schieben — Dots bleiben an der echten
      // Preis-Position, nur die Labels rutschen auseinander. Läuft seit Chat 2026-07-26 ÜBER ALLE
      // Gruppen (Farben) gemeinsam statt pro Gruppe getrennt (siehe PivotMarkerGroup-Kommentar) —
      // deckungsgleiche Punkte aus verschiedenen Gruppen bilden dadurch garantiert denselben
      // Cluster und rutschen exakt ober-/untereinander auseinander statt unabhängig voneinander.
      // Chat 2026-07-25: "wenn ich im 1h den chart etwas herauszoome, dann verdecken mir die
      // Labels die Sicht" — Dots bleiben, nur die Preis-Labels verschwinden bei zu dünnen Kerzen.
      if (this._options.showLabels && canShowLabels(this._chart, this._candles)) {
        ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.textBaseline = "bottom";
        ctx.textAlign = "left";
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
            ctx.fillStyle = entry.p.color;
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

    this._points = this._source._groups.flatMap((group) =>
      group.points.map((p) => {
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
          color: group.color,
          dotRadius: group.dotRadius ?? 3,
        };
      }),
    );
  }

  renderer() {
    return new PivotMarkerRenderer(this._points, this._source._options, this._source._chart, this._source._candles);
  }
}

export class PivotMarkerPrimitive {
  _groups: PivotMarkerGroup[];
  _options: RenderOptions;
  _candles: Candle[];
  _paneViews: PivotMarkerPaneView[];
  _chart: any;
  _series: any;

  constructor(groups: PivotMarkerGroup[], options: RenderOptions, candles: Candle[]) {
    this._groups = groups;
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
// renderLiquidityLevels in liquidity.js. EIN gemeinsames Primitive für ALLE übergebenen Gruppen
// (seit Chat 2026-07-26 — vorher eines PRO Gruppe, siehe PivotMarkerGroup-Kommentar oben für den
// Bug, den das verursacht hat), damit deren Preis-Labels GEMEINSAM entzerrt werden
// (PivotMarkerRenderer.draw), aber jede Gruppe ihre eigene Farbe/Punktgröße behält.
export function renderPivotMarkers(
  series: any,
  groups: PivotMarkerGroup[],
  existingPrimitives: PivotMarkerPrimitive[],
  candles: Candle[],
  options: {
    showLabels?: boolean;
    formatPrice?: (price: number) => string;
  } = {},
) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!groups || candles.length === 0) return;

  const nonEmptyGroups = groups.filter((g) => g.points && g.points.length > 0);
  if (nonEmptyGroups.length === 0) return;

  const primitive = new PivotMarkerPrimitive(
    nonEmptyGroups,
    { showLabels: options.showLabels ?? false, formatPrice: options.formatPrice },
    candles,
  );
  series.attachPrimitive(primitive);
  existingPrimitives.push(primitive);
}
