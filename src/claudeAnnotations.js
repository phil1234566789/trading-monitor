// Claude-Antwort-Import (siehe trading/backtest-instructions.md, trading/trading-tagesablauf.md):
// der Claude-Project-Chat kann uns Chart-Annotationen als JSON zurückgeben (Preis+Text, markierte
// Kerze, Linie, horizontale Linie), die Philip hier reinpastet, damit er visuell nachvollziehen
// kann, was Claude meint, statt nur Text zu lesen. Rendering-Pattern (Primitive-Klasse + PaneView +
// Renderer) 1:1 wie liquidity.js/tradeMarkers.js — hline ist die eine Ausnahme, dafür reicht
// lightweight-charts' eingebaute Preislinie (braucht keine Zeit-Position).
import { LineStyle } from "lightweight-charts";
import { snapToBarTime } from "./chartTimeUtils.js";
import { berlinDayRangeUtcMs } from "./backtestExport.js";

// Sehr auffällige, sonst im Chart ungenutzte Akzentfarbe (Philip: "in einer sehr auffälligen
// Farbe dargestellt") — bewusst NICHT über chartColors.js konfigurierbar wie die übrigen
// Indikatoren, das hier ist Ad-hoc-Kommentar-Import, kein dauerhafter Chart-Bestandteil.
const ANNOTATION_COLOR = "#ff2e92";
const DOT_RADIUS = 4;
const MARKER_RADIUS = 7;

const VALID_TYPES = new Set(["label", "marker", "line", "hline"]);

// Wirft mit einer für Philip verständlichen deutschen Fehlermeldung, statt eine rohe
// JSON.parse/TypeError-Meldung durchzureichen — landet 1:1 im Import-UI (Dashboard.vue).
export function parseAnnotations(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("Ungültiges JSON.");
  }
  const list = Array.isArray(data) ? data : data?.annotations;
  if (!Array.isArray(list)) throw new Error('Erwarte ein Array oder { "annotations": [...] }.');
  list.forEach((a, i) => {
    if (!VALID_TYPES.has(a?.type)) throw new Error(`Annotation ${i}: unbekannter type "${a?.type}".`);
    if (a.type === "line") {
      if (typeof a.from?.price !== "number" || typeof a.to?.price !== "number") {
        throw new Error(`Annotation ${i} (line): from.price und to.price sind Pflicht.`);
      }
    } else if (typeof a.price !== "number") {
      throw new Error(`Annotation ${i} (${a.type}): price fehlt.`);
    }
  });
  return list;
}

// Optionales Datum im time-Feld (Chat 2026-07-28): eine Box/Konsolidierung, die real schon am
// Vortag begann, ließ sich bisher nicht korrekt zeichnen, weil time nur "HH:mm" akzeptierte und
// IMMER an den gerade angezeigten Tag gebunden war — Claude musste den Start künstlich auf 00:00
// Uhr des aktuellen Tages legen und im Text vermerken, seit wann die Auffälligkeit real läuft.
// "YYYY-MM-DD HH:mm" (ISO-Datum, gleiche Reihenfolge wie das date-Feld im Export — bewusst NICHT
// DD.MM., um Tag/Monat-Verwechslung zu vermeiden) referenziert jetzt einen beliebigen Tag; reines
// "HH:mm" bleibt unverändert an den Tag aus dateStr gebunden.
const DATED_TIME_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/;

// "HH:mm" (Europe/Berlin, gleiches Format wie im Export) + der Tag, auf den sich der Import
// gerade bezieht -> passende geladene Kerze (gesnappt, muss keine exakte Bar-Grenze treffen).
// Fehlt time (siehe Philips Bestätigung: optional, Fallback aufs letzte sichtbare Kerze), wird
// die zuletzt geladene Kerze genutzt.
function resolveTime(candles, dateStr, timeValue) {
  if (candles.length === 0) return null;
  if (timeValue == null) return candles[candles.length - 1].time;
  const dated = timeValue.match(DATED_TIME_RE);
  const effectiveDateStr = dated ? dated[1] : dateStr;
  const [h, m] = (dated ? dated[2] : timeValue).split(":").map(Number);
  const { startUtcMs } = berlinDayRangeUtcMs(effectiveDateStr);
  return snapToBarTime(candles, startUtcMs / 1000 + h * 3600 + m * 60);
}

function drawText(ctx, x, y, text, pixelRatio) {
  ctx.font = `${Math.round(11 * pixelRatio)}px sans-serif`;
  ctx.fillStyle = ANNOTATION_COLOR;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x + 10 * pixelRatio, y);
}

class AnnotationRenderer {
  constructor(p1, p2, ann) {
    this._p1 = p1;
    this._p2 = p2;
    this._ann = ann;
  }

  draw(target) {
    const { p1, p2 } = this;
    if (p1.x === null || p1.y === null) return;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const pr = scope.horizontalPixelRatio;
      const x1 = Math.round(p1.x * pr);
      const y1 = Math.round(p1.y * scope.verticalPixelRatio);

      // Linie (type "line"): p2 vorhanden, sonst Punkt-Annotation (label/marker).
      if (p2 && p2.x !== null && p2.y !== null) {
        const x2 = Math.round(p2.x * pr);
        const y2 = Math.round(p2.y * scope.verticalPixelRatio);
        ctx.strokeStyle = ANNOTATION_COLOR;
        ctx.lineWidth = 2 * pr;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (this._ann.text) drawText(ctx, (x1 + x2) / 2, (y1 + y2) / 2, this._ann.text, pr);
        return;
      }

      if (this._ann.type === "marker") {
        ctx.fillStyle = ANNOTATION_COLOR;
        ctx.strokeStyle = ANNOTATION_COLOR;
        ctx.lineWidth = 2 * pr;
        if (this._ann.style === "arrow") {
          const r = MARKER_RADIUS * pr;
          ctx.beginPath();
          ctx.moveTo(x1, y1 - r);
          ctx.lineTo(x1 - r * 0.7, y1 + r * 0.6);
          ctx.lineTo(x1 + r * 0.7, y1 + r * 0.6);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x1, y1, MARKER_RADIUS * pr, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (this._ann.text) drawText(ctx, x1 + MARKER_RADIUS * pr, y1, this._ann.text, pr);
      } else {
        ctx.fillStyle = ANNOTATION_COLOR;
        ctx.beginPath();
        ctx.arc(x1, y1, DOT_RADIUS * pr, 0, Math.PI * 2);
        ctx.fill();
        if (this._ann.text) drawText(ctx, x1 + DOT_RADIUS * pr, y1, this._ann.text, pr);
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

class AnnotationPaneView {
  constructor(source) {
    this._source = source;
    this._p1 = { x: null, y: null };
    this._p2 = null;
  }

  update() {
    const { series, chart, candles, ann, dateStr } = this._source;
    const timeScale = chart.timeScale();
    const t1 = resolveTime(candles, dateStr, ann.type === "line" ? ann.from.time : ann.time);
    const price1 = ann.type === "line" ? ann.from.price : ann.price;
    this._p1 = { x: t1 != null ? timeScale.timeToCoordinate(t1) : null, y: series.priceToCoordinate(price1) };

    if (ann.type === "line") {
      const t2 = resolveTime(candles, dateStr, ann.to.time);
      this._p2 = { x: t2 != null ? timeScale.timeToCoordinate(t2) : null, y: series.priceToCoordinate(ann.to.price) };
    } else {
      this._p2 = null;
    }
  }

  renderer() {
    return new AnnotationRenderer(this._p1, this._p2, this._source.ann);
  }
}

class AnnotationPrimitive {
  constructor(ann, candles, dateStr) {
    this.ann = ann;
    this.candles = candles;
    this.dateStr = dateStr;
    this._paneViews = [new AnnotationPaneView(this)];
    this.chart = null;
    this.series = null;
  }

  attached({ chart, series, requestUpdate }) {
    this.chart = chart;
    this.series = series;
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

// existingPriceLines ist getrennt von existingPrimitives, weil createPriceLine/removePriceLine
// eine eigene lightweight-charts-API ist (nicht attachPrimitive/detachPrimitive) — hline braucht
// keine Zeit-Position, spannt sich automatisch über die volle sichtbare Breite.
export function renderClaudeAnnotations(series, annotations, existingPrimitives, existingPriceLines, candles, dateStr) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  for (const pl of existingPriceLines) series.removePriceLine(pl);
  existingPriceLines.length = 0;

  for (const ann of annotations) {
    if (ann.type === "hline") {
      const priceLine = series.createPriceLine({
        price: ann.price,
        color: ANNOTATION_COLOR,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: ann.text ?? "",
      });
      existingPriceLines.push(priceLine);
    } else {
      const primitive = new AnnotationPrimitive(ann, candles, dateStr);
      series.attachPrimitive(primitive);
      existingPrimitives.push(primitive);
    }
  }
}
