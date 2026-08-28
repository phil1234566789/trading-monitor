// Order-Block-Erkennung, portiert aus tv-indikator/src/calculations.pine (processClosedBar).
// Vereinfacht für Single-Timeframe/Single-Symbol: nur ein simples Pip-Minimum für Lower-TF statt
// des vollen Pip-Systems dort (siehe LOWER_TF_MIN_GAP_PIPS in orderBlockDetection.js), keine
// Session-/Symbol-Filter, keine "nächste 3 zum Preis"-Hervorhebung, keine M1-Entry-Logik.
// weak-Klassifizierung (Gap-Größe) folgt weiterhin nur dem Pine-HTF-Modus.
//
// detectOrderBlocks selbst lebt seit Chat 2026-08-02 in orderBlockDetection.js (dependency-frei,
// siehe dort — gleicher Schnitt wie liquidity.js → liquidityDetection.js, damit der MCP-Server die
// reine Erkennung direkt cross-directory importieren kann, ohne die Browser-Imports unten
// mitzuschleppen); hier nur re-exportiert, damit sich an der öffentlichen API dieses Moduls
// nichts ändert.
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor, cssColorScaled } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";
import { canShowLabels } from "./chartZoom.js";
import { detectOrderBlocks } from "./orderBlockDetection.js";

export { detectOrderBlocks };

const PIN_BORDER_INSET = 3; // px, Abstand des Pin-Rahmens nach außen von der normalen Box-Kante
const PIN_BORDER_LINE_WIDTH = 2.5; // px
// Auswahl-Rahmen (Chat 2026-08-18, PinPanel.vue-Hover) — weiter außen als der Pin-Rahmen, damit
// beide gleichzeitig sichtbar sind (Pendant zu tradeMarkers.js' "zwei ineinanderliegende Ringe"),
// durchgezogen statt gestrichelt, damit er sich von der dauerhaften Pin-Markierung unterscheidet.
const SELECTED_BORDER_INSET = 6.5; // px
const SELECTED_BORDER_LINE_WIDTH = 2.5; // px

function positionsBox(position1Media, position2Media, pixelRatio) {
  const scaledPosition1 = Math.round(pixelRatio * position1Media);
  const scaledPosition2 = Math.round(pixelRatio * position2Media);
  return {
    position: Math.min(scaledPosition1, scaledPosition2),
    length: Math.abs(scaledPosition2 - scaledPosition1) + 1,
  };
}

class ZoneRenderer {
  constructor(p1, p2, options, chart, candles) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
    this._chart = chart;
    this._candles = candles;
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
      // Gleicher Bug wie liquidity.js: LiquidityLineRenderer.draw (Bug-Report Philip 2026-08-23,
      // dort gefunden/gefixt) — fehlender horizontalPixelRatio-Faktor, während der Pin-/Auswahl-
      // Rahmen weiter unten ihn schon korrekt anwenden. Auf HiDPI-Displays landet ein Wert unter 1
      // dadurch unter einem echten Canvas-Pixel und wird anti-aliased/transparent statt dünner.
      ctx.lineWidth = (this._options.borderWidth ?? 1) * scope.horizontalPixelRatio;
      ctx.strokeRect(xPos.position, yPos.position, xPos.length, yPos.length);

      // Permanenter Rahmen (Chat 2026-08-01, Pin-Kontext) — dieselbe Halo-Logik wie
      // tradeMarkers.js' Ring, hier als etwas nach außen versetztes gestricheltes Rechteck statt
      // eines Kreises, weil eine OB-Zone eine Fläche und kein Punkt ist.
      if (this._options.inPinContext) {
        ctx.save();
        ctx.strokeStyle = this._options.pinColor;
        ctx.lineWidth = PIN_BORDER_LINE_WIDTH * scope.horizontalPixelRatio;
        ctx.setLineDash([6 * scope.horizontalPixelRatio, 4 * scope.horizontalPixelRatio]);
        const inset = PIN_BORDER_INSET * scope.horizontalPixelRatio;
        ctx.strokeRect(xPos.position - inset, yPos.position - inset, xPos.length + inset * 2, yPos.length + inset * 2);
        ctx.restore();
      }

      // Auswahl-Rahmen bei Hover über die zugehörige PinPanel.vue-Zeile (Chat 2026-08-18) — eigener,
      // weiter außen liegender durchgezogener Rahmen statt den Pin-Rahmen zu ersetzen, damit "dauerhaft
      // gepinnt" und "gerade in der Liste gehovert" gleichzeitig erkennbar bleiben.
      if (this._options.isSelectedPin) {
        ctx.save();
        ctx.strokeStyle = this._options.hoverColor;
        ctx.lineWidth = SELECTED_BORDER_LINE_WIDTH * scope.horizontalPixelRatio;
        ctx.setLineDash([]);
        const inset = SELECTED_BORDER_INSET * scope.horizontalPixelRatio;
        ctx.strokeRect(xPos.position - inset, yPos.position - inset, xPos.length + inset * 2, yPos.length + inset * 2);
        ctx.restore();
      }

      // Chat 2026-07-25: "wenn ich im 1h den chart etwas herauszoome, dann verdecken mir die
      // Labels die Sicht" — Zone selbst bleibt, nur das Timeframe-Tag verschwindet bei zu dünnen
      // Kerzen.
      if (this._options.label && canShowLabels(this._chart, this._candles)) {
        ctx.font = `${Math.round(11 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.fillStyle = this._options.textColor;
        ctx.textBaseline = "top";
        ctx.textAlign = "right";
        // Mehrzeilig per "\n" (Chat 2026-07-27: Trade-Setup-OB-Box zeigt im Debug-Modus zusätzlich
        // die Preise unter dem "Long/Short A #x"-Titel) — fillText selbst kann keine Zeilenumbrüche,
        // daher hier manuell aufgeteilt. Für den bisherigen Single-Line-Fall (z.B. renderPersistedZones)
        // unverändert, split() liefert dann ein Array mit einem Element.
        const lines = this._options.label.split("\n");
        const lineHeight = 13 * scope.verticalPixelRatio;
        lines.forEach((line, i) => {
          ctx.fillText(
            line,
            xPos.position + xPos.length - 4 * scope.horizontalPixelRatio,
            yPos.position + 2 * scope.verticalPixelRatio + i * lineHeight,
          );
        });
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
    const candles = this._source._candles;

    // Bug-Report Philip 2026-08-23: z.endTime einer noch aktiven (untouched/nicht invalidierten)
    // Zone ist nur ein Nebenprodukt von detectOrderBlocks() (wächst dort mit jeder durchlaufenen
    // Kerze mit, siehe orderBlockDetection.js) — für 1H/4H, die seit Punkt 7 (DB-Read statt Live-
    // Recompute) aus `ob_zones` kommen, ist dieser Wert nur so aktuell wie poi-watchers letzter
    // erfolgreicher Lauf, nicht "jetzt". Eine noch offene Zone hat konzeptionell KEIN sinnvolles
    // Ende — sie soll bis zur letzten geladenen Kerze reichen, nicht bis zu einem gespeicherten
    // Zeitpunkt. snapToBarTime klemmt einen zu großen targetTime ohnehin auf die letzte Kerze,
    // Infinity nutzt genau das statt eine eigene "letzte Kerze"-Sonderbehandlung zu brauchen.
    const startBarTime = snapToBarTime(candles, z.startTime);
    const endBarTime = snapToBarTime(candles, z.touched || z.invalidated ? z.endTime : Infinity);
    this._p1 = {
      x: startBarTime != null ? timeScale.timeToCoordinate(startBarTime) : null,
      y: series.priceToCoordinate(z.top),
    };
    this._p2 = {
      x: endBarTime != null ? timeScale.timeToCoordinate(endBarTime) : null,
      y: series.priceToCoordinate(z.bottom),
    };
  }

  renderer() {
    return new ZoneRenderer(this._p1, this._p2, this._source._options, this._source._chart, this._source._candles);
  }
}

export class OrderBlockPrimitive {
  constructor(zone, options, candles) {
    this._zone = zone;
    this._options = options;
    this._candles = candles;
    this._paneViews = [new ZonePaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    // Fehlte hier (anders als bei LiquidityLinePrimitive.attached, siehe liquidity.js) — ein frisch
    // attachtes Primitive ohne begleitendes candleSeries.setData() hängt sonst in der Luft, bis
    // zufällig ein anderes Chart-Event einen Redraw auslöst. Bug-Report Philip 2026-07-31: eine neu
    // hinzugefügte Target-OB-Box zeigte nur einen zu einem einzelnen Punkt zusammengestauchten
    // "Strich" — genau das Symptom einer veralteten, nie aktualisierten Pane-View.
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }

  // Distanz zum Pin-Kontextmenü (Chat 2026-08-01, zweite Runde — Bug-Report Philip: exaktes
  // Treffen der Box war trotz Cursor-Fix zu fummelig, "lass mal die anderen Lösungsmöglichkeiten
  // anschauen") — ersetzt den früheren reinen Boolean-Hittest: PriceChart.vue sammelt jetzt ALLE
  // Objekte in einem Radius um den Klick statt genau eins exakt zu treffen (siehe
  // findNearbyPinCandidates dort), 0 wenn der Punkt IN der Box liegt, sonst Abstand zur
  // nächsten Kante (Standardformel "Distanz Punkt zu Rechteck"). x/y in CSS-Pixeln relativ zum
  // Chart-Container, derselbe Koordinatenraum wie die gecachten p1/p2.
  distanceTo(x, y) {
    const { _p1: p1, _p2: p2 } = this._paneViews[0];
    if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return Infinity;
    const left = Math.min(p1.x, p2.x);
    const right = Math.max(p1.x, p2.x);
    const top = Math.min(p1.y, p2.y);
    const bottom = Math.max(p1.y, p2.y);
    const dx = Math.max(left - x, 0, x - right);
    const dy = Math.max(top - y, 0, y - bottom);
    return Math.sqrt(dx * dx + dy * dy);
  }

  get zone() {
    return this._zone;
  }
}

// chartColors[obBull*/obBear*/obInactive*].alpha ist die "normale" Fill-Transparenz — "weak"
// (kleine FVG) skaliert proportional dazu (Original-Design-Verhältnis), damit EIN Transparenz-
// Regler pro Farbe reicht statt zwei separate (siehe chartColors.js: cssColorScaled). Gilt für alle
// drei Timeframes gleichermaßen, nur die Basis-Alpha selbst unterscheidet sich (siehe
// DEFAULT_CHART_COLORS). Die Umrandung hat seit Chat 2026-07-30 ("diese Boxumrandung stylebar
// machen") eine EIGENE, unabhängige Farbe/Alpha (obBull*Border/obBear*Border/obInactive*Border),
// kein Verhältnis zur Füllfarbe mehr — daher hier kein "weak"-Sonderfall für die Umrandung.
const WEAK_FILL_RATIO = 0.1 / 0.28;

// M5/1H/4H haben seit Chat 2026-07-30 eigene Farb-/Breiten-Keys (Bug-Report Philip: "die ganzen OBs
// lassen sich schwierig unterscheiden") statt EINES gemeinsamen Satzes mit fest verdrahtetem
// 1H-Dimm-Faktor — z.timeframe ist immer "1H"/"4H"/"5M" (siehe PriceChart.vue: collectObsZones).
// Explizite Literale statt String-Konkatenation ("obBull" + suffix) — chartColors.test.js scannt
// den Quelltext nach genau diesen Key-Strings, eine dynamisch zusammengesetzte "obBullM5" käme im
// Scan nie als Literal vor und der Test würde den Key fälschlich als verwaist melden.
const OB_ZONE_KEYS = {
  "1H": {
    bull: "obBull1h", bear: "obBear1h", inactive: "obInactive1h",
    bullBorder: "obBull1hBorder", bearBorder: "obBear1hBorder", inactiveBorder: "obInactive1hBorder",
  },
  "4H": {
    bull: "obBull4h", bear: "obBear4h", inactive: "obInactive4h",
    bullBorder: "obBull4hBorder", bearBorder: "obBear4hBorder", inactiveBorder: "obInactive4hBorder",
  },
  "5M": {
    bull: "obBullM5", bear: "obBearM5", inactive: "obInactiveM5",
    bullBorder: "obBullM5Border", bearBorder: "obBearM5Border", inactiveBorder: "obInactiveM5Border",
  },
};

function zoneOptions(z, inPinContext, isSelectedPin) {
  const inactive = z.touched || z.invalidated;
  const keys = OB_ZONE_KEYS[z.timeframe] ?? OB_ZONE_KEYS["1H"];
  const key = inactive ? keys.inactive : z.dir === 1 ? keys.bull : keys.bear;
  const borderKey = inactive ? keys.inactiveBorder : z.dir === 1 ? keys.bullBorder : keys.bearBorder;
  const fillRatio = !inactive && z.weak ? WEAK_FILL_RATIO : 1;
  const label = z.timeframe ?? "";
  return {
    fillColor: cssColorScaled(key, fillRatio),
    borderColor: cssColor(borderKey),
    borderWidth: lineWidth(key),
    textColor: "rgba(209, 212, 220, 0.9)",
    label,
    inPinContext,
    pinColor: cssColor("pin"),
    isSelectedPin,
    hoverColor: cssColor("tradeHover"),
  };
}

// naturalKeyOf: exakt derselbe Schlüssel wie ob_zones' Unique-Constraint (instrument, timeframe,
// direction, start_time) MINUS instrument (der Chart zeigt immer nur ein Instrument gleichzeitig,
// siehe PriceChart.vue) — so lässt sich eine live erkannte Forex-Zone (ohne eigene DB-id) gegen
// einen gespeicherten Pin-Kontext-Eintrag abgleichen, siehe pinContext.js:
// obZoneNaturalKey (dieselbe Formel, dort auf der DB-Zeile statt der live erkannten Zone).
export function obZoneNaturalKey(timeframe, dir, startTime) {
  return `${timeframe}|${dir === 1 ? "long" : "short"}|${startTime}`;
}

// Zeichnet bereits berechnete Zonen (z.B. aus `ob_zones` in Supabase, mit `timeframe`-Tag)
// statt sie selbst aus Kerzen neu zu berechnen — für Zonen, die auf einem anderen
// Timeframe erkannt wurden als dem gerade angezeigten Chart. pinKeys (Chat 2026-08-01,
// optional): Set von obZoneNaturalKey-Strings, die dauerhaft hervorgehoben werden sollen.
// hoveredKey (Chat 2026-08-18, optional): EIN obZoneNaturalKey-String, der zusätzlich per
// Auswahl-Rahmen hervorgehoben wird (PinPanel.vue-Zeilen-Hover, siehe Dashboard.vue:
// hoveredPinObZoneKey).
export function renderPersistedZones(series, zones, existingPrimitives, candles, pinKeys, hoveredKey) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const z of zones) {
    if (z.invalidated) continue;
    const key = obZoneNaturalKey(z.timeframe, z.dir, z.startTime);
    const inPinContext = pinKeys?.has(key) ?? false;
    const isSelectedPin = hoveredKey != null && hoveredKey === key;
    const primitive = new OrderBlockPrimitive(z, zoneOptions(z, inPinContext, isSelectedPin), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
