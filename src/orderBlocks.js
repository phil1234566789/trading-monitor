// Order-Block-Erkennung, portiert aus tv-indikator/src/calculations.pine (processClosedBar).
// Vereinfacht für Single-Timeframe/Single-Symbol: nur ein simples Pip-Minimum für Lower-TF statt
// des vollen Pip-Systems dort (siehe LOWER_TF_MIN_GAP_PIPS unten), keine Session-/Symbol-Filter,
// keine "nächste 3 zum Preis"-Hervorhebung, keine M1-Entry-Logik. weak-Klassifizierung (Gap-Größe)
// folgt weiterhin nur dem Pine-HTF-Modus.
//
// FVG-Fenster über 4 Kerzen (c0..c2 + cur): bullisch, wenn cur.low über c1.high liegt (Gap),
// bärisch symmetrisch. Zone = C1-Kante bis zur gegenüberliegenden Kante von C2 (inkl. Wick) — siehe
// Pine-Kommentar "HTF-Modus" für die Herleitung. Gilt unverändert für HTF (15m/1h/4h/1D). Lower-TF
// (M1/M3/M5) erweitert seit Bug-Report Philip 2026-07-29 die NICHT-FVG-anknüpfende Kante zusätzlich
// auf den Extremwert über C1+C2+die Kerze davor (siehe detectOrderBlocks unten) — "zu eng, direkt
// auf der erstbesten Kerzen-Range".
import { snapToBarTime } from "./chartTimeUtils.js";
import { cssColor, cssColorScaled } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";
import { canShowLabels } from "./chartZoom.js";
import { PIP_SIZE } from "./pipConfig.js";

const IRRELEVANT_PCT = 0.05; // Gap kleiner als das wird gar nicht erst als Zone angelegt (HTF: 15m/1h/4h/1D)
const WEAK_PCT = 0.15; // Gap kleiner als das gilt als "schwach" (blasser dargestellt)

// Lower-TF (M1/M3/M5, siehe tv-indikator/src/calculations.pine: capMode=true) hat im Pine-Original
// gar KEINE Mindestgröße (jede positive Lücke bildet eine Zone) — Bug-Report Philip 2026-07-26:
// eine 0,01%-FVG auf M5 wurde von IRRELEVANT_PCT (für HTF gedacht, 0,05%) verschluckt, obwohl sie
// auf M5 durchaus tradebar ist. Statt komplett ohne Minimum (wie im Pine-Original) verlangt Philip
// explizit "mindestens 1 Pip" — ein Pip-Minimum statt Prozent, weil % vom Preis bei GBPUSD/EURUSDs
// enger Range (~1.3) für M5-Lücken viel zu grob ist (0,05% sind hier ~6-7 Pip).
// M5 auf 0,5 Pip abgesenkt (Bug-Report Philip 2026-07-28: eine 0,7-Pip-FVG um 12:30 EURUSD wurde
// vom 1-Pip-Minimum verschluckt) — M1/M3 bleiben bei 1 Pip, da nicht Anlass des Reports.
const LOWER_TF_LABELS = new Set(["1m", "3m", "5m"]);
const LOWER_TF_MIN_GAP_PIPS = { "1m": 1, "3m": 1, "5m": 0.5 };

// HTF (1H/4H) Pip-Minimum NUR für Forex (Bug-Report Philip 2026-07-30: eine 4,5-Pip-1H-FVG bei
// EURUSD wurde von der 0,05%-Prozent-Schwelle verschluckt, ~5,7 Pip bei diesem Kurs nötig) — nicht
// einfach an die Timeframe gehängt wie bei LOWER_TF_LABELS, weil poi-watcher denselben 1H/4H-Pfad
// AUCH für BTC durchläuft (siehe index.ts, TIMEFRAMES-Loop läuft für okx+twelvedata gleichermaßen);
// ein Pip-Minimum wäre bei BTCs Kursniveau (~60k) bedeutungslos (praktisch keine Schwelle mehr).
// Daher explizites isForex-Flag statt Ableitung aus der Timeframe allein.
const HTF_FOREX_LABELS = new Set(["1H", "4H"]);
const HTF_FOREX_MIN_GAP_PIPS = { "1H": 4, "4H": 8 };

// timeframe: TIMEFRAMES-Label (siehe timeframes.js, z.B. "5m"/"1H"/"4H") — entscheidet zusammen mit
// isForex, ob eine Pip- oder die Prozent-Mindestgröße gilt. undefined/unbekanntes Label fällt auf
// HTF-Prozent-Verhalten zurück (Altverhalten, falls je ohne Timeframe aufgerufen).
// isForex default true, weil bislang jeder Aufrufer entweder garantiert Forex ist (detectSetupObs,
// die Frontend-Forex-Zweige) oder das Flag explizit selbst setzt (poi-watcher, s.o.).
export function detectOrderBlocks(candles, timeframe, isForex = true) {
  const zones = [];
  const isLowerTf = LOWER_TF_LABELS.has(timeframe);
  const isHtfForexPip = isForex && HTF_FOREX_LABELS.has(timeframe);
  const minGapAbs = isLowerTf
    ? LOWER_TF_MIN_GAP_PIPS[timeframe] * PIP_SIZE
    : isHtfForexPip
      ? HTF_FOREX_MIN_GAP_PIPS[timeframe] * PIP_SIZE
      : null;

  for (let i = 3; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const cur = candles[i];
    const refPrice = c1.close;

    const bullGap = cur.low - c1.high;
    const bearGap = c1.low - cur.high;
    const bullGapPct = (bullGap / refPrice) * 100;
    const bearGapPct = (bearGap / refPrice) * 100;
    const bullRelevant = minGapAbs != null ? bullGap >= minGapAbs : bullGapPct >= IRRELEVANT_PCT;
    const bearRelevant = minGapAbs != null ? bearGap >= minGapAbs : bearGapPct >= IRRELEVANT_PCT;

    if (bullRelevant) {
      for (const z of zones) if (z.dir === 1 && z.active) z.active = false;
      // Lower-TF (Bug-Report Philip 2026-07-29: "M5 OB Code noch nicht perfekt ... die Kante, die
      // NICHT an die FVG anknüpft, ist zu eng, direkt auf der erstbesten Kerzen-Range") — bezieht
      // die Impuls-Kerze (c2) UND die 2 Kerzen davor mit ein (candles[i-3]/c1/c2), nimmt den
      // Extremwert. Die FVG-anknüpfende Kante (top hier) bleibt unverändert. HTF (15m/1h/4h/1D)
      // bleibt bei der alten, engen Box — Philip: "die sind eher, das bleibt so wie es ist".
      const bottom = isLowerTf ? Math.min(candles[i - 3].low, c1.low, c2.low) : c2.low;
      zones.push({
        top: c1.high,
        bottom,
        dir: 1,
        weak: bullGapPct < WEAK_PCT,
        active: true,
        touched: false,
        invalidated: false,
        startTime: c2.time,
        endTime: cur.time,
      });
    } else if (bearRelevant) {
      for (const z of zones) if (z.dir === -1 && z.active) z.active = false;
      const top = isLowerTf ? Math.max(candles[i - 3].high, c1.high, c2.high) : c2.high;
      zones.push({
        top,
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
      const wasTouched = z.touched; // vor der Pruefung dieser Kerze festhalten

      if (z.dir === 1 && cur.high < z.bottom) {
        z.invalidated = true;
        z.endTime = cur.time; // Box soll die invalidierende Kerze noch einschliessen
        continue;
      }
      if (z.dir === -1 && cur.low > z.top) {
        z.invalidated = true;
        z.endTime = cur.time;
        continue;
      }

      if (!z.touched && cur.low <= z.top && cur.high >= z.bottom) z.touched = true;
      // Auf genau der Kerze, die den Touch ausloest, soll endTime noch mitwachsen (sonst
      // friert die Box eine Kerze zu frueh ein) — danach (wasTouched war schon true) nicht mehr.
      if (!wasTouched) z.endTime = cur.time;
    }
  }

  return zones;
}

const LANIAKEA_BORDER_INSET = 3; // px, Abstand des Laniakea-Rahmens nach außen von der normalen Box-Kante
const LANIAKEA_BORDER_LINE_WIDTH = 2.5; // px

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
      ctx.lineWidth = this._options.borderWidth ?? 1;
      ctx.strokeRect(xPos.position, yPos.position, xPos.length, yPos.length);

      // Permanenter Rahmen (Chat 2026-08-01, Laniakea-Kontext) — dieselbe Halo-Logik wie
      // tradeMarkers.js' Ring, hier als etwas nach außen versetztes gestricheltes Rechteck statt
      // eines Kreises, weil eine OB-Zone eine Fläche und kein Punkt ist.
      if (this._options.inLaniakeaContext) {
        ctx.save();
        ctx.strokeStyle = this._options.laniakeaColor;
        ctx.lineWidth = LANIAKEA_BORDER_LINE_WIDTH * scope.horizontalPixelRatio;
        ctx.setLineDash([6 * scope.horizontalPixelRatio, 4 * scope.horizontalPixelRatio]);
        const inset = LANIAKEA_BORDER_INSET * scope.horizontalPixelRatio;
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

    const startBarTime = snapToBarTime(candles, z.startTime);
    const endBarTime = snapToBarTime(candles, z.endTime);
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

  // Rechtsklick-Hittest fürs Laniakea-Kontextmenü (Chat 2026-08-01, analog zu
  // TradeMarkerPrimitive.hitTest in tradeMarkers.js) — Box statt Punkt, daher ein einfacher
  // Rechteck-Containment-Test statt Distanz-zu-Punkt. x/y in CSS-Pixeln relativ zum
  // Chart-Container, derselbe Koordinatenraum wie die gecachten p1/p2.
  hitTest(x, y) {
    const { _p1: p1, _p2: p2 } = this._paneViews[0];
    if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return false;
    const left = Math.min(p1.x, p2.x);
    const right = Math.max(p1.x, p2.x);
    const top = Math.min(p1.y, p2.y);
    const bottom = Math.max(p1.y, p2.y);
    return x >= left && x <= right && y >= top && y <= bottom;
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

function zoneOptions(z, inLaniakeaContext) {
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
    inLaniakeaContext,
    laniakeaColor: cssColor("laniakea"),
  };
}

// naturalKeyOf: exakt derselbe Schlüssel wie ob_zones' Unique-Constraint (instrument, timeframe,
// direction, start_time) MINUS instrument (der Chart zeigt immer nur ein Instrument gleichzeitig,
// siehe PriceChart.vue) — so lässt sich eine live erkannte Forex-Zone (ohne eigene DB-id) gegen
// einen gespeicherten Laniakea-Kontext-Eintrag abgleichen, siehe laniakeaContext.js:
// obZoneNaturalKey (dieselbe Formel, dort auf der DB-Zeile statt der live erkannten Zone).
export function obZoneNaturalKey(timeframe, dir, startTime) {
  return `${timeframe}|${dir === 1 ? "long" : "short"}|${startTime}`;
}

// Zeichnet bereits berechnete Zonen (z.B. aus `ob_zones` in Supabase, mit `timeframe`-Tag)
// statt sie selbst aus Kerzen neu zu berechnen — für Zonen, die auf einem anderen
// Timeframe erkannt wurden als dem gerade angezeigten Chart. laniakeaKeys (Chat 2026-08-01,
// optional): Set von obZoneNaturalKey-Strings, die dauerhaft hervorgehoben werden sollen.
export function renderPersistedZones(series, zones, existingPrimitives, candles, laniakeaKeys) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const z of zones) {
    if (z.invalidated) continue;
    const inLaniakeaContext = laniakeaKeys?.has(obZoneNaturalKey(z.timeframe, z.dir, z.startTime)) ?? false;
    const primitive = new OrderBlockPrimitive(z, zoneOptions(z, inLaniakeaContext), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
