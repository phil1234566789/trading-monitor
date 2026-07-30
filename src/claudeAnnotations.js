// Claude-Antwort-Import (siehe trading/chart-daten.md, trading/trading-ablauf.md):
// der Claude-Project-Chat kann uns Chart-Annotationen als JSON zurückgeben (Preis+Text, markierte
// Kerze, Linie, horizontale Linie), die Philip hier reinpastet, damit er visuell nachvollziehen
// kann, was Claude meint, statt nur Text zu lesen. Rendering-Pattern (Primitive-Klasse + PaneView +
// Renderer) 1:1 wie liquidity.js/tradeMarkers.js — hline ist die eine Ausnahme, dafür reicht
// lightweight-charts' eingebaute Preislinie (braucht keine Zeit-Position).
//
// Bug-Report Philip 2026-07-30: zwei Annotationen auf demselben Preis-Level (z.B. eine "line" und
// ein "marker" am selben Sweep-Punkt, mit Absicht so von Claude gesetzt) zeichnen ihre Labels exakt
// übereinander — unlesbar. Seit diesem Fix laufen ALLE nicht-hline-Annotationen über EINE einzige
// Primitive/PaneView/Renderer-Instanz (vorher eine pro Annotation), damit der Renderer beim
// Zeichnen alle Label-Positionen gleichzeitig kennt und kollidierende Labels vertikal auseinander-
// schieben kann (resolveLabelPlacements) — mit unabhängigen Primitives pro Annotation wäre das
// nicht möglich, die kennen sich gegenseitig nicht.
import { LineStyle } from "lightweight-charts";
import { snapToBarTime } from "./chartTimeUtils.js";
import { berlinDayRangeUtcMs } from "./backtestExport.js";

// Sehr auffällige, sonst im Chart ungenutzte Akzentfarbe (Philip: "in einer sehr auffälligen
// Farbe dargestellt") — bewusst NICHT über chartColors.js konfigurierbar wie die übrigen
// Indikatoren, das hier ist Ad-hoc-Kommentar-Import, kein dauerhafter Chart-Bestandteil. Nur noch
// der Fallback, falls eine Annotation kein eigenes "color"-Feld mitbringt (Feature 2026-07-30: die
// Farbwahl pro Annotation liegt seitdem beim Ersteller/Claude, nicht mehr fest hier verdrahtet).
export const ANNOTATION_COLOR = "#ff2e92";
const DOT_RADIUS = 4;
const MARKER_RADIUS = 7;

const VALID_TYPES = new Set(["label", "marker", "line", "hline"]);
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function validateAnnotationList(list) {
  list.forEach((a, i) => {
    if (!VALID_TYPES.has(a?.type)) throw new Error(`Annotation ${i}: unbekannter type "${a?.type}".`);
    if (a.type === "line") {
      if (typeof a.from?.price !== "number" || typeof a.to?.price !== "number") {
        throw new Error(`Annotation ${i} (line): from.price und to.price sind Pflicht.`);
      }
    } else if (typeof a.price !== "number") {
      throw new Error(`Annotation ${i} (${a.type}): price fehlt.`);
    }
    if (a.color !== undefined && !HEX_COLOR_RE.test(a.color)) {
      throw new Error(`Annotation ${i}: color muss ein Hex-String sein (z.B. "#e74c3c"), nicht "${a.color}".`);
    }
    if (a.pointer !== undefined && typeof a.pointer !== "boolean") {
      throw new Error(`Annotation ${i}: pointer muss ein Boolean sein, nicht "${a.pointer}".`);
    }
  });
}

// Wirft mit einer für Philip verständlichen deutschen Fehlermeldung, statt eine rohe
// JSON.parse/TypeError-Meldung durchzureichen — landet 1:1 im Import-UI (ClaudeAnnotationsModal.vue).
//
// Rückgabe ist immer eine Liste von Gruppen [{ title, annotations }, ...] — auch fürs alte,
// flache Format (Chat 2026-07-30: mehrere Zeichnungen sollen aus EINEM Paste als eigene,
// einzeln aus-/einblendbare Zeichnungen gespeichert werden können, statt wie bisher immer genau
// eine Zeile pro Klick auf "Zeichnen"). title ist null, wenn keins mitgeliefert wurde (flaches
// Array oder { "annotations": [...] }) — der Aufrufer (ClaudeAnnotationsModal.vue) setzt dafür
// einen Default-Titel mit aktuellem Zeitstempel, weil "jetzt" hier drin nicht sinnvoll wäre (der
// Titel soll den Import-Zeitpunkt zeigen, nicht den Parse-Zeitpunkt innerhalb desselben Ticks).
export function parseAnnotations(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("Ungültiges JSON.");
  }

  if (Array.isArray(data?.drawings)) {
    return data.drawings.map((group, gi) => {
      if (!Array.isArray(group?.annotations)) {
        throw new Error(`Zeichnung ${gi}: "annotations" fehlt oder ist kein Array.`);
      }
      validateAnnotationList(group.annotations);
      return { title: group.title ?? null, annotations: group.annotations };
    });
  }

  const list = Array.isArray(data) ? data : data?.annotations;
  if (!Array.isArray(list)) {
    throw new Error('Erwarte ein Array, { "annotations": [...] } oder { "drawings": [...] }.');
  }
  validateAnnotationList(list);
  return [{ title: null, annotations: list }];
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

// Chart-lokaler Anker-Punkt einer Annotation in CSS-Pixeln (KEINE Pixel-Ratio-Skalierung —
// timeToCoordinate/priceToCoordinate liefern direkt CSS-Pixel, anders als die Bitmap-Koordinaten
// im Canvas-Renderer oben). Gebraucht für die TSC-Callout-Verbindungslinien (PriceChart.vue,
// Feature 2026-07-30 "Zeiger-Linien"): die Labels selbst liegen dort außerhalb des Chart-Canvas in
// einem DOM/SVG-Overlay, brauchen aber trotzdem den exakten Chart-Punkt, auf den sie zeigen. Bei
// "line" der Linien-Mittelpunkt (der Callout zeigt aufs Level als Ganzes, nicht auf einen der
// beiden Endpunkte), sonst der Punkt selbst. null, wenn Zeit/Preis gerade außerhalb des sichtbaren
// Bereichs liegen (timeToCoordinate/priceToCoordinate geben dann selbst null zurück).
export function annotationAnchorPoint(chart, series, candles, dateStr, ann) {
  const timeScale = chart.timeScale();
  if (ann.type === "line") {
    const t1 = resolveTime(candles, dateStr, ann.from.time);
    const t2 = resolveTime(candles, dateStr, ann.to.time);
    if (t1 == null || t2 == null) return null;
    const x1 = timeScale.timeToCoordinate(t1);
    const x2 = timeScale.timeToCoordinate(t2);
    const y1 = series.priceToCoordinate(ann.from.price);
    const y2 = series.priceToCoordinate(ann.to.price);
    if (x1 == null || x2 == null || y1 == null || y2 == null) return null;
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }
  const t = resolveTime(candles, dateStr, ann.time);
  if (t == null) return null;
  const x = timeScale.timeToCoordinate(t);
  const y = series.priceToCoordinate(ann.price);
  if (x == null || y == null) return null;
  return { x, y };
}

const LABEL_FONT_PX = 11;
const LABEL_TEXT_OFFSET = 10;
// Vertikaler Versatz-Schritt beim Auseinanderschieben kollidierender Labels — etwas mehr als die
// Font-Größe, damit übereinandergestapelte Labels eine sichtbare Lücke haben statt aneinander zu
// kleben.
const LABEL_LINE_HEIGHT = 15;
const MAX_LABEL_STACK_ATTEMPTS = 12;
// Bug-Report Philip 2026-07-30: Label mittig AUF einer langen Linie (z.B. Invalidierungslinie über
// den ganzen Tag) sah durchgestrichen aus und lag oft weit weg vom eigentlichen Bezugspunkt. Ab
// dieser Breite (Anteil der sichtbaren Chart-Breite) gilt eine Linie als "lang" -> Label rechtsbündig
// ans nähere Linienende statt mittig; kürzere Linien bleiben mittig (beides jetzt ÜBER der Linie).
const LONG_LINE_VIEW_RATIO = 0.3;
// Vertikaler Abstand zwischen Linie und Label-Unterkante (vor Pixel-Ratio-Skalierung).
const LINE_LABEL_GAP = 6;

// Reine Geometrie-Funktion (kein Canvas-Zugriff) — deshalb einzeln testbar (siehe
// test/claudeAnnotations.test.js), losgelöst vom Rest des Renderers, der lightweight-charts'
// Bitmap-Coordinate-Space braucht. labels: [{ x1, x2, y }] (x1/x2 = horizontale Textbox-Grenzen,
// y = ursprünglich gewünschte vertikale Mitte) in Zeichenreihenfolge. Gibt die (ggf. angepassten)
// y-Werte in derselben Reihenfolge zurück.
//
// Greedy statt einer "richtigen" Lösung (z.B. Kräfte-basiertes Layout): probiert abwechselnd
// oberhalb/unterhalb der ursprünglichen Position in wachsenden Vielfachen von lineHeight, bis eine
// Position gefunden ist, die keine schon platzierte Box überlappt (Überlappungscheck nur, wenn sich
// auch die x-Bereiche überschneiden — Labels an unterschiedlichen Chart-Zeitpunkten stören sich
// nicht, selbst wenn sie zufällig dieselbe Höhe hätten). Nach maxAttempts wird die letzte Kandidaten-
// Position übernommen (Best-Effort statt Endlosschleife) — bei mehr als ein paar Kollisionen am
// selben Punkt bleibt's zwangsläufig eng, aber lieber leicht überlappend als weit weg vom Anker.
export function resolveLabelPlacements(labels, lineHeight, maxAttempts = MAX_LABEL_STACK_ATTEMPTS) {
  const placed = [];
  const halfHeight = lineHeight / 2;
  return labels.map(({ x1, x2, y }) => {
    let candidateY = y;
    let attempt = 0;
    const overlaps = () =>
      placed.some(
        (b) => x1 < b.x2 && x2 > b.x1 && candidateY - halfHeight < b.y2 && candidateY + halfHeight > b.y1,
      );
    while (attempt < maxAttempts && overlaps()) {
      attempt++;
      const dir = attempt % 2 === 1 ? 1 : -1;
      const step = Math.ceil(attempt / 2);
      candidateY = y + dir * step * lineHeight;
    }
    placed.push({ x1, x2, y1: candidateY - halfHeight, y2: candidateY + halfHeight });
    return candidateY;
  });
}

// Zeichnet ALLE nicht-hline-Annotationen in einem Rutsch (statt einer Renderer-Instanz pro
// Annotation) — nur so kennt der Renderer beim Platzieren der Labels alle anderen Labels bereits
// und kann Kollisionen erkennen (siehe Datei-Kopfkommentar, Bug-Report 2026-07-30).
class AnnotationsRenderer {
  constructor(items) {
    this._items = items; // [{ p1, p2, ann }, ...]
  }

  draw(target) {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const pr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      // "point"-Labels (Marker/Punkt) kennen ax/ay schon beim Sammeln (fester Versatz vom Punkt,
      // unabhängig von der Textbreite). "line"-Labels brauchen dagegen die gemessene Textbreite,
      // um sich zentriert bzw. rechtsbündig ÜBER der Linie zu platzieren (Bug-Report Philip
      // 2026-07-30: Label mittig AUF der Linie sah wie durchgestrichen aus) — deren ax/ay wird
      // erst weiter unten berechnet, nachdem ctx.font gesetzt ist.
      const labelCandidates = []; // [{ kind: "point", ax, ay, text, color } | { kind: "line", x1, y1, x2, y2, text, color }]

      for (const { p1, p2, ann } of this._items) {
        if (p1.x === null || p1.y === null) continue;
        // Fehlt "color" (altes Format ohne Farbfeld), gilt die bisherige Default-Farbe.
        const color = ann.color ?? ANNOTATION_COLOR;
        const x1 = Math.round(p1.x * pr);
        const y1 = Math.round(p1.y * vr);

        // Linie (type "line"): p2 vorhanden, sonst Punkt-Annotation (label/marker).
        if (p2 && p2.x !== null && p2.y !== null) {
          const x2 = Math.round(p2.x * pr);
          const y2 = Math.round(p2.y * vr);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 * pr;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          if (ann.text) labelCandidates.push({ kind: "line", x1, y1, x2, y2, text: ann.text, color });
          continue;
        }

        if (ann.type === "marker") {
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 * pr;
          if (ann.style === "arrow") {
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
          if (ann.text) {
            labelCandidates.push({ kind: "point", ax: x1 + MARKER_RADIUS * pr + LABEL_TEXT_OFFSET * pr, ay: y1, text: ann.text, color });
          }
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x1, y1, DOT_RADIUS * pr, 0, Math.PI * 2);
          ctx.fill();
          if (ann.text) {
            labelCandidates.push({ kind: "point", ax: x1 + DOT_RADIUS * pr + LABEL_TEXT_OFFSET * pr, ay: y1, text: ann.text, color });
          }
        }
      }

      if (labelCandidates.length === 0) return;

      ctx.font = `${Math.round(LABEL_FONT_PX * pr)}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      const boxes = labelCandidates.map((l) => {
        if (l.kind === "point") {
          return { x1: l.ax, x2: l.ax + ctx.measureText(l.text).width, y: l.ay };
        }
        // "line": lange Linien (> LONG_LINE_VIEW_RATIO der sichtbaren Chart-Breite) sind meist
        // Invalidierungs-/Zonengrenzen, die über den ganzen Tag laufen — Label mittig würde oft
        // weit weg vom eigentlichen Preis-Level (z.B. Sweep-Punkt am linken Rand) landen, deshalb
        // rechtsbündig ans nähere (rechte) Linienende. Kurze Linien bleiben mittig, wie bisher,
        // nur eben ÜBER statt AUF der Linie.
        const width = ctx.measureText(l.text).width;
        const lineLenPx = Math.abs(l.x2 - l.x1);
        const isLong = lineLenPx > LONG_LINE_VIEW_RATIO * scope.bitmapSize.width;
        let ax, lineYAtLabel;
        if (isLong) {
          const rightIsX2 = l.x2 >= l.x1;
          const rightX = rightIsX2 ? l.x2 : l.x1;
          lineYAtLabel = rightIsX2 ? l.y2 : l.y1;
          ax = rightX - width - LABEL_TEXT_OFFSET * pr;
        } else {
          ax = (l.x1 + l.x2) / 2 - width / 2;
          lineYAtLabel = (l.y1 + l.y2) / 2;
        }
        const ay = lineYAtLabel - LINE_LABEL_GAP * pr - (LABEL_LINE_HEIGHT * pr) / 2;
        return { x1: ax, x2: ax + width, y: ay };
      });
      const placedYs = resolveLabelPlacements(boxes, LABEL_LINE_HEIGHT * pr);

      labelCandidates.forEach((label, i) => {
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, boxes[i].x1, placedYs[i]);
      });
    });
  }
}

class AnnotationsPaneView {
  constructor(source) {
    this._source = source;
    this._items = [];
  }

  update() {
    const { series, chart, candles, annotations, dateStr } = this._source;
    const timeScale = chart.timeScale();
    this._items = annotations.map((ann) => {
      const t1 = resolveTime(candles, dateStr, ann.type === "line" ? ann.from.time : ann.time);
      const price1 = ann.type === "line" ? ann.from.price : ann.price;
      const p1 = { x: t1 != null ? timeScale.timeToCoordinate(t1) : null, y: series.priceToCoordinate(price1) };
      let p2 = null;
      if (ann.type === "line") {
        const t2 = resolveTime(candles, dateStr, ann.to.time);
        p2 = { x: t2 != null ? timeScale.timeToCoordinate(t2) : null, y: series.priceToCoordinate(ann.to.price) };
      }
      return { p1, p2, ann };
    });
  }

  renderer() {
    return new AnnotationsRenderer(this._items);
  }
}

class AnnotationsPrimitive {
  constructor(annotations, candles, dateStr) {
    this.annotations = annotations;
    this.candles = candles;
    this.dateStr = dateStr;
    this._paneViews = [new AnnotationsPaneView(this)];
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
// keine Zeit-Position, spannt sich automatisch über die volle sichtbare Breite. existingPrimitives
// enthält seit dem Label-Kollisions-Fix höchstens EIN Element (eine gemeinsame AnnotationsPrimitive
// für alle nicht-hline-Annotationen), bleibt aber ein Array, weil PriceChart.vue es generisch
// leert/befüllt.
export function renderClaudeAnnotations(series, annotations, existingPrimitives, existingPriceLines, candles, dateStr) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  for (const pl of existingPriceLines) series.removePriceLine(pl);
  existingPriceLines.length = 0;

  const nonHline = [];
  for (const ann of annotations) {
    if (ann.type === "hline") {
      const priceLine = series.createPriceLine({
        price: ann.price,
        color: ann.color ?? ANNOTATION_COLOR,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: ann.text ?? "",
      });
      existingPriceLines.push(priceLine);
    } else {
      nonHline.push(ann);
    }
  }
  if (nonHline.length > 0) {
    const primitive = new AnnotationsPrimitive(nonHline, candles, dateStr);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
