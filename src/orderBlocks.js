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
import { cssColorScaled } from "./chartColors.js";
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

// 1H-Zonen etwas dezenter als 4H, damit beide gleichzeitig im Chart unterscheidbar sind.
const DIM_FACTOR_1H = 0.6;

// chartColors[obBull/obBear/obInactive].alpha ist die "normale" Fill-Transparenz (Default 0.28
// bzw. 0.15) — weak/Border skalieren proportional dazu (Original-Design-Verhältnis), damit EIN
// Transparenz-Regler pro Farbe reicht statt vier separate (siehe chartColors.js: cssColorScaled).
const WEAK_FILL_RATIO = 0.1 / 0.28;
const BULL_BEAR_BORDER_RATIO = 0.7 / 0.28;
const INACTIVE_BORDER_RATIO = 0.35 / 0.15;

function zoneOptions(z) {
  const inactive = z.touched || z.invalidated;
  const dim = z.timeframe === "1H";
  const key = inactive ? "obInactive" : z.dir === 1 ? "obBull" : "obBear";
  const fillRatio = !inactive && z.weak ? WEAK_FILL_RATIO : 1;
  const borderRatio = inactive ? INACTIVE_BORDER_RATIO : BULL_BEAR_BORDER_RATIO;
  const dimFactor = dim ? DIM_FACTOR_1H : 1;
  const label = z.timeframe ?? "";
  return {
    fillColor: cssColorScaled(key, fillRatio * dimFactor),
    borderColor: cssColorScaled(key, borderRatio * dimFactor),
    borderWidth: lineWidth(key),
    textColor: "rgba(209, 212, 220, 0.9)",
    label,
  };
}

// Zeichnet bereits berechnete Zonen (z.B. aus `ob_zones` in Supabase, mit `timeframe`-Tag)
// statt sie selbst aus Kerzen neu zu berechnen — für Zonen, die auf einem anderen
// Timeframe erkannt wurden als dem gerade angezeigten Chart.
export function renderPersistedZones(series, zones, existingPrimitives, candles) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const z of zones) {
    if (z.invalidated) continue;
    const primitive = new OrderBlockPrimitive(z, zoneOptions(z), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
