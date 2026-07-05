// Order-Block-Erkennung, portiert aus tv-indikator/src/calculations.pine (processClosedBar).
// Vereinfacht für Single-Timeframe/Single-Symbol: kein Pip-System (Schwellen als % vom Preis),
// keine Session-/Symbol-Filter, keine "nächste 3 zum Preis"-Hervorhebung, keine M1-Entry-Logik.
//
// FVG-Fenster über 4 Kerzen (c0..c2 + cur): bullisch, wenn cur.low über c1.high liegt (Gap),
// bärisch symmetrisch. Zone = C1-Kante bis zur gegenüberliegenden Kante von C2 (inkl. Wick) —
// siehe Pine-Kommentar "HTF-Modus" für die Herleitung.
const IRRELEVANT_PCT = 0.05; // Gap kleiner als das wird gar nicht erst als Zone angelegt
const WEAK_PCT = 0.15; // Gap kleiner als das gilt als "schwach" (blasser dargestellt)

export function detectOrderBlocks(candles) {
  const zones = [];

  for (let i = 3; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const cur = candles[i];
    const refPrice = c1.close;

    const bullGapPct = ((cur.low - c1.high) / refPrice) * 100;
    const bearGapPct = ((c1.low - cur.high) / refPrice) * 100;

    if (bullGapPct >= IRRELEVANT_PCT) {
      for (const z of zones) if (z.dir === 1 && z.active) z.active = false;
      zones.push({
        top: c1.high,
        bottom: c2.low,
        dir: 1,
        weak: bullGapPct < WEAK_PCT,
        active: true,
        touched: false,
        invalidated: false,
        startTime: c2.time,
        endTime: cur.time,
      });
    } else if (bearGapPct >= IRRELEVANT_PCT) {
      for (const z of zones) if (z.dir === -1 && z.active) z.active = false;
      zones.push({
        top: c2.high,
        bottom: c1.low,
        dir: -1,
        weak: bearGapPct < WEAK_PCT,
        active: true,
        touched: false,
        invalidated: false,
        startTime: c2.time,
        endTime: cur.time,
      });
    }

    // Gültigkeits-/Touched-Regeln laufen für alle bestehenden Zonen gegen die aktuelle Kerze.
    for (const z of zones) {
      if (z.invalidated) continue;
      if (z.dir === 1 && cur.high < z.bottom) {
        z.invalidated = true;
        continue;
      }
      if (z.dir === -1 && cur.low > z.top) {
        z.invalidated = true;
        continue;
      }
      if (!z.touched && cur.low <= z.top && cur.high >= z.bottom) z.touched = true;
      if (!z.touched) z.endTime = cur.time;
    }
  }

  return zones;
}

function positionsBox(position1Media, position2Media, pixelRatio) {
  const scaledPosition1 = Math.round(pixelRatio * position1Media);
  const scaledPosition2 = Math.round(pixelRatio * position2Media);
  return {
    position: Math.min(scaledPosition1, scaledPosition2),
    length: Math.abs(scaledPosition2 - scaledPosition1) + 1,
  };
}

class ZoneRenderer {
  constructor(p1, p2, options) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
  }

  draw(target) {
    const { p1, p2 } = this;
    if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const xPos = positionsBox(p1.x, p2.x, scope.horizontalPixelRatio);
      const yPos = positionsBox(p1.y, p2.y, scope.verticalPixelRatio);

      ctx.fillStyle = this._options.fillColor;
      ctx.fillRect(xPos.position, yPos.position, xPos.length, yPos.length);
      ctx.strokeStyle = this._options.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(xPos.position, yPos.position, xPos.length, yPos.length);

      if (this._options.label) {
        ctx.font = `${Math.round(11 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.fillStyle = this._options.textColor;
        ctx.textBaseline = "top";
        ctx.fillText(this._options.label, xPos.position + 4 * scope.horizontalPixelRatio, yPos.position + 2 * scope.verticalPixelRatio);
      }
    });
  }

  get p1() {
    return this._p1;
  }

  get p2() {
    return this._p2;
  }
}

class ZonePaneView {
  constructor(source) {
    this._source = source;
    this._p1 = { x: null, y: null };
    this._p2 = { x: null, y: null };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const z = this._source._zone;
    this._p1 = {
      x: timeScale.timeToCoordinate(z.startTime),
      y: series.priceToCoordinate(z.top),
    };
    this._p2 = {
      x: timeScale.timeToCoordinate(z.endTime),
      y: series.priceToCoordinate(z.bottom),
    };
  }

  renderer() {
    return new ZoneRenderer(this._p1, this._p2, this._source._options);
  }
}

export class OrderBlockPrimitive {
  constructor(zone, options) {
    this._zone = zone;
    this._options = options;
    this._paneViews = [new ZonePaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series }) {
    this._chart = chart;
    this._series = series;
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

const BULL_COLOR = "rgba(38, 166, 154, 0.28)";
const BULL_WEAK_COLOR = "rgba(38, 166, 154, 0.10)";
const BEAR_COLOR = "rgba(239, 83, 80, 0.28)";
const BEAR_WEAK_COLOR = "rgba(239, 83, 80, 0.10)";
const INACTIVE_COLOR = "rgba(120, 123, 134, 0.15)";

function zoneOptions(z) {
  const inactive = z.touched || z.invalidated;
  const fillColor = inactive ? INACTIVE_COLOR : z.dir === 1 ? (z.weak ? BULL_WEAK_COLOR : BULL_COLOR) : z.weak ? BEAR_WEAK_COLOR : BEAR_COLOR;
  return {
    fillColor,
    borderColor: inactive ? "rgba(120, 123, 134, 0.35)" : z.dir === 1 ? "rgba(38, 166, 154, 0.7)" : "rgba(239, 83, 80, 0.7)",
    textColor: "rgba(209, 212, 220, 0.9)",
    label: z.dir === 1 ? "OB Bull" : "OB Bear",
  };
}

export function renderOrderBlocks(chart, series, candles, existingPrimitives) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  const zones = detectOrderBlocks(candles);
  for (const z of zones) {
    if (z.invalidated) continue;
    const primitive = new OrderBlockPrimitive(z, zoneOptions(z));
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
