// Liquiditäts-Level (Williams-Fractal-Pivots als horizontale Linie), portiert aus
// tv-indikator/src/{fractals,liquidity}.pine. Vereinfacht für Batch-Berechnung (wie
// orderBlocks.js): kein Ringpuffer/Streaming-State pro geschlossener Bar, stattdessen
// bei jedem Refresh einmal komplett über das geladene `candles`-Array (aktueller
// Chart-Timeframe) neu berechnet.
import { snapToBarTime, businessSecondsBetween, formatAge, ageReferenceTime } from "./chartTimeUtils.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";
import { canShowLabels } from "./chartZoom.js";
import { classifyAge } from "./ageTier";
// Reine Fraktal-Erkennung seit Chat 2026-07-31 nach liquidityDetection.js ausgelagert (dort auch
// die Begründung) — hier nur re-exportiert, damit sich an der öffentlichen API dieser Datei nichts
// ändert (PriceChart.vue/dataExport.js importieren weiterhin von hier).
import {
  LIQUIDITY_FRACTAL_PERIOD,
  LIQUIDITY_MAX_RELEVANT,
  detectLiquidityLevels,
  filterRelevantLevels,
  selectRelevantHtfLevels,
} from "./liquidityDetection.js";

export { LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, detectLiquidityLevels, filterRelevantLevels, selectRelevantHtfLevels };

const PIN_HALO_EXTRA_WIDTH = 3; // px, zusätzlich zur normalen lineWidth (Chat 2026-08-17)
// Auswahl-Halo (Chat 2026-08-18, PinPanel.vue-Hover) — breiter als der Pin-Halo, wird ZUERST
// (also am weitesten hinten) gezeichnet, damit beide Halos gleichzeitig als "Glow"-Ringe um die
// eigentliche Linie sichtbar bleiben, analog zu orderBlocks.js' zwei ineinanderliegenden Rahmen.
const SELECTED_HALO_EXTRA_WIDTH = 7; // px

class LiquidityLineRenderer {
  constructor(p1, p2, options, chart, candles) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
    this._chart = chart;
    this._candles = candles;
  }

  draw(target) {
    const { p1, p2 } = this;
    if (p1.x === null || p1.y === null || p2.x === null) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const yBase = p1.y * scope.verticalPixelRatio;
      const y = Math.round(yBase); // für Halos — deren leichte Unschärfe fällt bei einem Glow-Effekt nicht auf
      const x1 = Math.round(p1.x * scope.horizontalPixelRatio);
      const x2 = Math.round(p2.x * scope.horizontalPixelRatio);
      // Auswahl-Halo bei Hover über die zugehörige PinPanel.vue-Zeile (Chat 2026-08-18) — VOR dem
      // Pin-Halo gezeichnet (breiter, liegt also dahinter), damit beide gleichzeitig sichtbar bleiben.
      if (this._options.isSelectedPin) {
        ctx.strokeStyle = this._options.hoverColor;
        ctx.lineWidth = (this._options.lineWidth + SELECTED_HALO_EXTRA_WIDTH) * scope.horizontalPixelRatio;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(Math.min(x1, x2), y);
        ctx.lineTo(Math.max(x1, x2), y);
        ctx.stroke();
      }

      // Pin-Halo (Chat 2026-08-17, analog zum Rahmen bei OrderBlockPrimitive/Ring bei
      // TradeMarkerPrimitive) — dickere Linie in der Pin-Akzentfarbe HINTER der eigentlichen
      // Linie, damit gepinnte Level auch bei kräftigen Sweep-/High-/Low-Farben noch erkennbar
      // hervorstechen, ohne deren semantische Farbe zu verlieren.
      if (this._options.inPinContext) {
        ctx.strokeStyle = this._options.pinColor;
        ctx.lineWidth = (this._options.lineWidth + PIN_HALO_EXTRA_WIDTH) * scope.horizontalPixelRatio;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(Math.min(x1, x2), y);
        ctx.lineTo(Math.max(x1, x2), y);
        ctx.stroke();
      }

      ctx.strokeStyle = this._options.color;
      // Bug-Report Philip 2026-08-23: "0.5px wird nicht dünner, nur transparenter" — fehlender
      // horizontalPixelRatio-Faktor hier (anders als bei den beiden Halo-Linien oben und jeder
      // anderen Stroke-Primitive im Repo, siehe rsiRendering.js/marketStructureRendering.ts).
      // ctx.lineWidth arbeitet im Canvas-Bitmap-Koordinatenraum (useBitmapCoordinateSpace), CSS-px
      // müssen also mit dem Pixel-Ratio hochskaliert werden — auf einem HiDPI-Display (ratio>1)
      // landete ein CSS-Wert wie 0.5 dadurch UNTER einem echten Canvas-Pixel: nicht mehr sauber
      // deckend zeichenbar, der Browser rendert stattdessen eine anti-aliased, halbtransparente
      // 1-Pixel-Linie statt sie tatsächlich dünner zu machen.
      const mainLineWidth = this._options.lineWidth * scope.horizontalPixelRatio;
      ctx.lineWidth = mainLineWidth;
      // Folge-Bug-Report, selbe Ursache in Grün: "1px vs. 2px sieht nicht dicker aus, nur
      // kräftiger" — eine Linie zentriert auf einer GANZZAHLIGEN Bitmap-Koordinate liegt bei einer
      // GERADEN Breite (2, 4, ...) exakt auf vollen Pixelreihen (scharf, 100% Deckkraft), bei einer
      // UNGERADEN Breite (1, 3, ...) dagegen genau zwischen zwei Pixelreihen (auf beide zu je 50%
      // Deckkraft verteilt, unscharf). 1px und 2px landen dadurch zufällig auf derselben sichtbaren
      // Fläche (2 Pixelreihen), nur mit unterschiedlicher Deckkraft — "keine Breite, nur mehr
      // Farbe". Fix: bei ungerader (gerundeter) Breite die Koordinate um einen halben Pixel
      // versetzen, klassische Canvas-"crisp lines"-Technik.
      const yMain = Math.round(mainLineWidth) % 2 === 0 ? y : Math.floor(yBase) + 0.5;
      // gestrichelt für "sweeped" (Docht durchbrochen, aber noch kein bestätigter Bruch) — siehe
      // marketStructureAnalysis.ts: renderMarketStructureAnalysis, Chat 2026-07-19. setLineDash([]) = durchgezogen,
      // muss bei jedem draw() neu gesetzt werden (kein impliziter Reset zwischen Primitives).
      ctx.setLineDash(this._options.dashed ? [6 * scope.horizontalPixelRatio, 4 * scope.horizontalPixelRatio] : []);
      ctx.beginPath();
      ctx.moveTo(Math.min(x1, x2), yMain);
      ctx.lineTo(Math.max(x1, x2), yMain);
      ctx.stroke();
      ctx.setLineDash([]);

      // Debug-Modus (showLiquidityDebug-Toggle) und Trendanalyse-Labels: Preis/Beschriftung an
      // der Linie einblenden. labelSide "start" (Default) = am Pivot-Ursprung, wie der Debug-
      // Toggle es will; "end" = rechts vom Linienende (siehe Trendanalyse-Toggle); "center-above"/
      // "center-below" = horizontal mittig über/unter der Linie (Chat 2026-07-24, Break of
      // Structure: "im uptrend über der Linie mittig, im downtrend unter der Linie mittig");
      // "end-above"/"end-below" = rechtsbündig am Linienende, aber ÜBER/UNTER statt AUF der Linie
      // (Chat 2026-07-27, M5-LQ-Sweep im Trade-Setup: "Label fängt nicht am Ende der Linie an,
      // sondern endet zusammen mit der Linie" — anders als "end" wächst das Label hier nach LINKS
      // über die Linie statt nach rechts über den Pane-Rand hinaus, kein Clamp nötig).
      // Chat 2026-07-25: "wenn ich im 1h den chart etwas herauszoome, dann verdecken mir die
      // Labels die Sicht" — sobald die Kerzen zu dünn sind (siehe chartZoom.js), Label weglassen,
      // Linie selbst bleibt unverändert stehen. lenientLabels (Bug-Report Philip 2026-08-26: HTF-
      // Label auf M5 unsichtbar) — HTF-Level nutzen bewusst die lockere Schwelle unabhängig vom
      // Chart-Timeframe, siehe levelOptions/canShowLabels.
      if (this._options.label && canShowLabels(this._chart, this._candles, this._options.lenientLabels)) {
        ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
        ctx.fillStyle = this._options.color;
        if (this._options.labelSide === "end") {
          // Linien, die bis "jetzt" reichen (z.B. Swing High/Low), enden direkt am rechten
          // Pane-Rand — ohne Clamp würde das Label dort abgeschnitten. An den Rand klemmen
          // (mit etwas Innenabstand), notfalls überlappt es minimal mit dem Linienende.
          const textWidth = ctx.measureText(this._options.label).width;
          const desiredX = Math.max(x1, x2) + 6 * scope.horizontalPixelRatio;
          const maxX = scope.bitmapSize.width - textWidth - 4 * scope.horizontalPixelRatio;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(this._options.label, Math.min(desiredX, maxX), y);
        } else if (this._options.labelSide === "end-above" || this._options.labelSide === "end-below") {
          const endX = Math.max(x1, x2);
          const above = this._options.labelSide === "end-above";
          ctx.textBaseline = above ? "bottom" : "top";
          ctx.textAlign = "right";
          ctx.fillText(this._options.label, endX, y + (above ? -2 : 2) * scope.verticalPixelRatio);
        } else if (this._options.labelSide === "center-above" || this._options.labelSide === "center-below") {
          const midX = (x1 + x2) / 2;
          const above = this._options.labelSide === "center-above";
          ctx.textBaseline = above ? "bottom" : "top";
          ctx.textAlign = "center";
          ctx.fillText(this._options.label, midX, y + (above ? -2 : 2) * scope.verticalPixelRatio);
        } else {
          ctx.textBaseline = "bottom";
          ctx.textAlign = "left";
          ctx.fillText(this._options.label, Math.min(x1, x2) + 4 * scope.horizontalPixelRatio, y - 2 * scope.verticalPixelRatio);
        }
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

class LiquidityPaneView {
  constructor(source) {
    this._source = source;
    this._p1 = { x: null, y: null };
    this._p2 = { x: null, y: null };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const lvl = this._source._level;
    const candles = this._source._candles;

    const startBarTime = snapToBarTime(candles, lvl.pivotTime);
    const endBarTime = snapToBarTime(candles, lvl.endTime);
    const y = series.priceToCoordinate(lvl.price);
    this._p1 = { x: startBarTime != null ? timeScale.timeToCoordinate(startBarTime) : null, y };
    this._p2 = { x: endBarTime != null ? timeScale.timeToCoordinate(endBarTime) : null, y };
  }

  renderer() {
    return new LiquidityLineRenderer(this._p1, this._p2, this._source._options, this._source._chart, this._source._candles);
  }
}

export class LiquidityLinePrimitive {
  constructor(level, options, candles) {
    this._level = level;
    this._options = options;
    this._candles = candles;
    this._paneViews = [new LiquidityPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    // Anders als beim initialen Laden (wo candleSeries.setData() ohnehin einen Redraw
    // auslöst) hängt ein Primitive-Wechsel allein (z.B. beim "Liquidität"-Toggle) sonst
    // in der Luft, bis irgendein anderes Chart-Event (Resize/Pan/nächster Poll) zufällig
    // einen Redraw anstößt — deshalb hier explizit anfordern.
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }

  get level() {
    return this._level;
  }

  // Distanz zum Pin-Kontextmenü (Chat 2026-08-02, LQ-Level als fünfte Kontext-Art) — analog zu
  // OrderBlockPrimitive.distanceTo (orderBlocks.js), aber für eine horizontale Strecke statt eines
  // Rechtecks: 0 innerhalb des x-Bereichs bei exakter y-Höhe, sonst vertikaler Abstand innerhalb des
  // Bereichs bzw. euklidischer Abstand zum nächstgelegenen Endpunkt außerhalb davon. x/y in
  // CSS-Pixeln relativ zum Chart-Container, wie bei allen anderen Primitives hier.
  distanceTo(x, y) {
    const { _p1: p1, _p2: p2 } = this._paneViews[0];
    if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return Infinity;
    const left = Math.min(p1.x, p2.x);
    const right = Math.max(p1.x, p2.x);
    if (x < left) return Math.hypot(x - left, y - p1.y);
    if (x > right) return Math.hypot(x - right, y - p1.y);
    return Math.abs(y - p1.y);
  }
}

// Konfigurierbar seit Chat 2026-07-25 (Style-Modal), siehe src/chartLineWidths.js.

// " (1d 3h)" hinter dem Preis-Label, oder "" ohne pivotTime/Referenzzeitpunkt (Chat 2026-07-22:
// "bei den relevanten LQ-Leveln das Alter anzeigen ... Wochenende nicht mitzählen") —
// businessSecondsBetween lässt Sa/So komplett raus. touchedTime (optional) hat Vorrang vor nowSec
// als Referenzzeitpunkt (Bug-Report Philip 2026-08-26, dieselbe Regel wie tradeSetupCockpit.ts seit
// 2026-07-27: "Alter bedeutet von Entstehungspunkt bis touched, falls nie touched bis jetzt — gilt
// überall so") — ageReferenceTime (chartTimeUtils.js) ist die gemeinsame Stelle für diese Regel.
function ageSuffix(pivotTime, nowSec, touchedTime = null) {
  const reference = ageReferenceTime(touchedTime, nowSec);
  if (pivotTime == null || reference == null) return "";
  const age = formatAge(businessSecondsBetween(pivotTime, reference));
  return age ? ` (${age})` : "";
}

// "Major LS 1,13545 (22d 19h)" — gemeinsames Label-Format für die Trade-Setup-LS-Linie
// (PriceChart.vue) UND die "1h LQ-Sweep"-Linie (marketStructureAnalysis.ts), Chat 2026-07-28: seit
// collectH1LqLevels (selber Chat) ist das oft exakt derselbe Pivot, zweimal gezeichnet — mit
// identischem Label-Text überlappen sich beide Linien lesbar statt zwei leicht unterschiedliche
// Strings übereinander zu zeigen ("1h LQ-Sweep..." vs. "LS..."). Tier-Präfix ("Major "/"Medium ")
// nur ab medium — "minor" (< 1 Tag) bewusst ohne Präfix ("aus Platzgründen", Chat 2026-07-28).
// Kein pivotTime/nowSec (z.B. synthetische Test-Pivots) -> nur "LS {price}", kein Tier/Alter.
// touchedTime optional (Bug-Report Philip 2026-08-26, siehe ageSuffix oben) — hat Vorrang vor
// nowSec für Tier UND Alter. JSDoc-Typ hier nicht nur Doku — ohne den Union-Typ leitet TS'
// allowJs-Inferenz aus dem Aufruf von marketStructureRendering.ts (.ts-Datei, ruft mit einem
// `number | undefined`-Wert auf) nur `null` aus dem Default-Wert her und lehnt den Aufruf ab,
// obwohl die Laufzeit number/null/undefined längst unterstützt — gleiches Muster wie
// sessionOccurrences.js: sessionOccurrences (tzOffsetMinutes) und rsi.js: computeRsi.
/**
 * @param {string} formattedPrice
 * @param {number | undefined} pivotTime
 * @param {number | undefined} nowSec
 * @param {number | null | undefined} [touchedTime]
 */
export function formatLsLabel(formattedPrice, pivotTime, nowSec, touchedTime = null) {
  if (pivotTime == null || nowSec == null) return `LS ${formattedPrice}`;
  const reference = ageReferenceTime(touchedTime, nowSec);
  const tier = classifyAge(businessSecondsBetween(pivotTime, reference));
  const prefix = tier === "minor" ? "" : `${tier[0].toUpperCase()}${tier.slice(1)} `;
  return `${prefix}LS ${formattedPrice}${ageSuffix(pivotTime, nowSec, touchedTime)}`;
}

// Bullische Sweep-/Setup-Linien beschriften sich rechtsbündig UNTER, bärische DARÜBER — reine
// visuelle Unterscheidung (siehe PP-/LS-Linien in PriceChart.vue, Chat 2026-07-27). Chat
// 2026-07-28 ("genauso wie schon in trades die Protected Pivots und die LS") baut die "1h
// LQ-Sweep"-Linie in marketStructureAnalysis.ts auf dieselbe Regel um statt sie separat zu
// entscheiden — daher hier als gemeinsame Stelle statt einer dritten eigenen Kopie.
export function bullBearLabelSide(bearish) {
  return bearish ? "end-above" : "end-below";
}

// Chat 2026-08-26, Philip: allgemeines LQ-Level-Label — "<bonus> <Major/Medium> <Alter>" ohne
// Debug, zusätzlich "<Preis>" ans Ende mit Debug. Der Sweep/High/Low-Typtext ist wieder raus (Chat
// 2026-08-26, zweite Runde: "dann kann das label 'sweep|high|low' ja weg" — BOS/CHoCH lassen sich
// hier ohnehin nicht mit reinnehmen, siehe dortige Begründung, ohne die war der reine Typtext nicht
// genug Mehrwert; Farbe (liquidityHigh/-Low/-Sweep, siehe levelOptions) und die über/unter-Position
// per bullBearLabelSide zeigen High/Low/Sweep am Chart weiterhin an, nur nicht mehr als Text). bonus
// ist der optionale Session-Kontext (sessionOccurrences.js: bonusLabelForPivot, z.B. "Asia-High").
// Kein Tier-Präfix bei "minor" (< 1 Geschäftstag), aus Platzgründen — dieselbe Konvention wie
// formatLsLabel. Alter als reines "(3h)" statt "(3h alt)" (dritte Runde desselben Chats: "es ist
// absolut klar mittlerweile was damit gemeint ist") — das "alt" ist seit Chat 2026-08-27 ("brauch
// ich überhaupt nicht mehr, lösch es überall raus") auch aus formatLsLabel/ageSuffix und den
// Bestätigungs-/Target-Listen (tradeConfirmations.ts/tradeTargets.ts) raus, überall dieselbe
// Kurzform.
// Vierte Runde, Philip: "Alter bedeutet von Entstehungspunkt bis touched. Falls noch nie touched,
// dann halt eben bis jetzt. Das gilt überall so." — Alter/Tier laufen bis lvl.touchedTime (falls
// gesetzt), nicht bis nowSec weiter, sobald das Level längst gesweept ist (ein vor Tagen gesweeptes
// Level wächst sonst scheinbar unbegrenzt "älter", obwohl der eigentliche Sweep selbst z.B. nur 6h
// nach dem Pivot passierte) — dieselbe Regel wie tradeSetupCockpit.ts seit 2026-07-27, jetzt über
// ageReferenceTime (chartTimeUtils.js) an EINER Stelle statt zweimal parallel gebaut; ageSuffix/
// formatLsLabel oben nutzen dieselbe Funktion.
export function formatLiquidityLevelLabel(lvl, { bonus, nowSec, formatPrice, includePrice } = {}) {
  const ageEndSec = ageReferenceTime(lvl.touchedTime, nowSec);
  const tier = lvl.pivotTime != null && ageEndSec != null ? classifyAge(businessSecondsBetween(lvl.pivotTime, ageEndSec)) : null;
  const tierLabel = tier && tier !== "minor" ? `${tier[0].toUpperCase()}${tier.slice(1)}` : null;
  const age = lvl.pivotTime != null && ageEndSec != null ? formatAge(businessSecondsBetween(lvl.pivotTime, ageEndSec)) : null;
  const ageLabel = age ? `(${age})` : null;
  const priceLabel = includePrice && formatPrice ? formatPrice(lvl.price) : null;
  return [bonus, tierLabel, ageLabel, priceLabel].filter(Boolean).join(" ");
}

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Nachbesserung 2026-08-23,
// Philip: "M5/1H/4H als Chart-Style-Kategorien, konsistent mit den Order-Blöcken" — anders als
// beim ersten Anlauf (verworfen: Style hing davon ab, ob ein Level live erkannt oder als
// zusätzliches HTF-Level eingeblendet wurde, nicht vom tatsächlichen Timeframe) richtet sich der
// Style-Key jetzt nach `lvl.timeframe` selbst: bei den persistierten HTF-Leveln (computeHtfLiquidityLevels)
// schon '1H'/'4H', bei live erkannten (refreshLiquidityInternal: highs/lows) und bei gepinnten
// Leveln (Dashboard.vue: pinnedLiquidityLevels) der jeweils aktuelle Chart-Timeframe zum
// Pin-/Erkennungs-Zeitpunkt (z.B. "1h"/"5m"/"15m") — Groß-/Kleinschreibung ist dabei uneinheitlich
// zwischen DB-Werten ('1H') und currentBar-Werten ('1h'), deshalb hier per .toUpperCase()
// vereinheitlicht statt an zwei Stellen verschieden zu schreiben. Alles außer exakt 1H/4H (also
// 1m/3m/5m/15m/1D, oder kein Timeframe gesetzt) fällt in den M5-Topf — die feinste/detailreichste
// Kategorie ist der sinnvollste Sammelplatz für "alles andere".
const LIQUIDITY_STYLE_KEYS = {
  M5: { liquidityHigh: "liquidityHighM5", liquidityLow: "liquidityLowM5", liquiditySweep: "liquiditySweepM5" },
  "1H": { liquidityHigh: "liquidityHigh1h", liquidityLow: "liquidityLow1h", liquiditySweep: "liquiditySweep1h" },
  "4H": { liquidityHigh: "liquidityHigh4h", liquidityLow: "liquidityLow4h", liquiditySweep: "liquiditySweep4h" },
};
function liquidityStyleTimeframe(rawTimeframe) {
  const upper = String(rawTimeframe ?? "").toUpperCase();
  return upper === "1H" || upper === "4H" ? upper : "M5";
}

// Chat 2026-08-26, Philip: HTF-Level (1H/4H) bekommen IMMER ein Label, nicht mehr nur im Debug-
// Modus (debugPrices steuert dort nur noch, ob der Preis zusätzlich ans Label angehängt wird, siehe
// formatLiquidityLevelLabel). M5/live erkannte Level bleiben unverändert Debug-only.
// labelSide über bullBearLabelSide statt eines pauschalen "end" (Bug-Report Philip: erst linksbündig,
// dann zwar rechtsbündig aber ohne die über/unter-Aufteilung "wie bei den anderen Linien") —
// dieselbe Funktion, die PP/LS (usePriceChartTradeSetupDrawing.js) und die "1h LQ-Sweep"-Linie
// (marketStructureRendering.ts) schon nutzen, statt eine vierte eigene Variante zu bauen. High
// (dir===1, Resistance von oben) sitzt wie ein bärischer Pivot ÜBER der Linie, Low (dir===-1,
// Support von unten) wie ein bullischer UNTER der Linie — geometrisch dieselbe Regel, die dort
// bereits gilt: die Kerzen liegen bei einem High UNTER dem Pivot (Label drüber vermeidet Overlap),
// bei einem Low DARÜBER (Label drunter). Richtet sich nach lvl.dir, nicht nach touched — ein
// gesweeptes Level bleibt geometrisch derselbe Pivot (nur die Farbe wechselt auf liquiditySweep*,
// siehe base/key unten; der Labeltext selbst kennt touched seit der zweiten Runde nicht mehr).
function levelOptions(lvl, { debugPrices, formatPrice, nowSec, inPinContext, isSelectedPin } = {}) {
  const tfCategory = liquidityStyleTimeframe(lvl.timeframe);
  const isHtf = tfCategory !== "M5";
  const base = lvl.touched ? "liquiditySweep" : lvl.dir === 1 ? "liquidityHigh" : "liquidityLow";
  const key = LIQUIDITY_STYLE_KEYS[tfCategory][base];
  const color = cssColor(key);
  const label =
    debugPrices || isHtf ? formatLiquidityLevelLabel(lvl, { bonus: lvl.bonus, nowSec, formatPrice, includePrice: debugPrices }) : null;
  return {
    color,
    lineWidth: lineWidth(key),
    label,
    labelSide: bullBearLabelSide(lvl.dir === 1),
    lenientLabels: isHtf,
    inPinContext,
    pinColor: cssColor("pin"),
    isSelectedPin,
    hoverColor: cssColor("tradeHover"),
  };
}

// Timeframe bewusst NICHT Teil des Strings (anders als obZoneNaturalKey/orderBlocks.js) — diese
// Funktion baut den Schlüssel nur für die Level des GERADE angezeigten Chart-Timeframes (siehe
// renderLiquidityLevels-Aufrufer in PriceChart.vue: es existiert immer nur eine currentBar-Menge
// gleichzeitig), Dashboard.vue filtert schon vorher nach Timeframe/kind (liquidity_level=1H vs.
// m5_liquidity_level=aktueller Nicht-1h-Timeframe), bevor beide Kind-Arten in DIESELBE Pin-Keys-
// Menge gemischt werden — pinContext.js: liquidityLevelEntryNaturalKey/m5LiquidityEntryNaturalKey
// bauen denselben String aus der DB-Zeile/dem Rohdaten-Snapshot.
export function liquidityLevelNaturalKey(dir, pivotTime) {
  return `${dir === 1 ? "high" : "low"}|${pivotTime}`;
}

// Zeichnet die übergebenen Level neu (komplettes Ersetzen der bisherigen Primitives) —
// analog zu renderPersistedZones in orderBlocks.js. `debugPrices`/`formatPrice` steuern das
// Preis-Label am Pivot-Ursprung (Debug-Toggle im Dashboard) — ohne `formatPrice` bleibt es aus.
// `pinKeys` (Chat 2026-08-17, analog zu renderPersistedZones' pinKeys-Parameter): Set von
// liquidityLevelNaturalKey-Strings, die dauerhaft hervorgehoben werden sollen. `hoveredKey`
// (Chat 2026-08-18, optional): EIN liquidityLevelNaturalKey-String, der zusätzlich per
// Auswahl-Halo hervorgehoben wird (PinPanel.vue-Zeilen-Hover, siehe Dashboard.vue:
// hoveredPinLiquidityLevelKey).
export function renderLiquidityLevels(series, levels, existingPrimitives, candles, { debugPrices, formatPrice, nowSec, pinKeys, hoveredKey } = {}) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;

  for (const lvl of levels) {
    const key = liquidityLevelNaturalKey(lvl.dir, lvl.pivotTime);
    const inPinContext = pinKeys?.has(key) ?? false;
    const isSelectedPin = hoveredKey != null && hoveredKey === key;
    const primitive = new LiquidityLinePrimitive(lvl, levelOptions(lvl, { debugPrices, formatPrice, nowSec, inPinContext, isSelectedPin }), candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
