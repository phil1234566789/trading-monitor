// Wilder's RSI, Standard-Periode 14 (siehe trading/rsi.md). Kanonischer Ort seit 2026-08-11 (vorher
// nur im MCP-Server, das dorthin verschoben wurde, weil es bereits dependency-frei war —
// analog zu computeEma in ema.js: EIN Ort, geteilt zwischen dem Live-Chart-RSI-Panel
// (PriceChart.vue) und dem MCP-Tool get_forex_rsi (supabase/functions/trading-monitor-mcp/tools/reads.ts), kein zweiter
// Port, kein Drift-Risiko (siehe CLAUDE.md "MCP-Server").
//
// Divergenz-Erkennung (HH/LH etc.) war bis 2026-08-11 bewusst NICHT hier codiert, sondern
// Claude/Lana überlassen (Musterabgleich auf einer sauberen Preis+RSI-Zahlenreihe, kein
// Rechenrisiko). Philip nach einem Live-Beispiel (GBPUSD 10.08.): "du hast das doch schon
// geschafft" — die Muster-Erkennung war tatsächlich simpel + mechanisch genug (N-Bar-Fraktal +
// Vergleich), um sie doch zu codieren, siehe detectRsiDivergence() unten. Die eigentliche
// RSI-Berechnung bleibt trotzdem der Grund, warum diese Datei existiert: Wilder-Glättung über
// viele Kerzen ist der Teil, den ein LLM nicht im Kopf zuverlässig nachrechnen kann.

export const DEFAULT_RSI_PERIOD = 14;

// JSDoc-Typen hier nicht nur Doku — ohne sie leitet TS' allowJs-Inferenz für tools/reads.ts'
// cross-directory Import (siehe CLAUDE.md "MCP-Server") einen zu unscharfen Rückgabetyp
// her (rsi bleibt beim `.filter()`-Callback dort implizit `any`, `tsc --noEmit` schlägt fehl).
/**
 * @param {{time: number, close: number}[]} candles
 * @param {number} [period]
 * @returns {{time: number, close: number, rsi: number | null}[]}
 */
export function computeRsi(candles, period = DEFAULT_RSI_PERIOD) {
  if (candles.length <= period) {
    return candles.map((c) => ({ time: c.time, close: c.close, rsi: null }));
  }

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gainSum += change;
    else lossSum += -change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const result = [];
  for (let i = 0; i < candles.length; i++) {
    let rsi = null;
    if (i === period) {
      rsi = rsiFromAverages(avgGain, avgLoss);
    } else if (i > period) {
      const change = candles[i].close - candles[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      // Wilder-Glättung: neuer Durchschnitt = (alter * (period-1) + neuer Wert) / period
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi = rsiFromAverages(avgGain, avgLoss);
    }
    result.push({ time: candles[i].time, close: candles[i].close, rsi });
  }
  return result;
}

function rsiFromAverages(avgGain, avgLoss) {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Klassische Zonen aus trading/rsi.md — Standard 70/30, keine Daytrading-Alternative (80/20),
// da das eine bewusste Trader-Entscheidung je nach Trendstärke ist, kein fixer Default.
export function rsiZone(value) {
  if (value > 70) return "overbought";
  if (value < 30) return "oversold";
  return "neutral";
}

// --- Divergenz-Erkennung (seit 2026-08-11) ---

export const DEFAULT_DIVERGENCE_FRACTAL_PERIOD = 3; // N-Bar-Fraktal — Swing braucht je 3 niedrigere/höhere Nachbarn davor+danach
export const DEFAULT_DIVERGENCE_LOOKBACK_BARS = 100; // wie weit zurück nach einer "härteren" Referenz-Spitze gesucht wird (~8h auf M5)
const MIN_DIVERGENCE_RSI_DELTA = 3; // filtert Rauschen (minimal unterschiedliche RSI-Werte durch Rundung/Mikrobewegung)

// --- Fehlalarm-Filter (Chat 2026-08-11, dritte Runde) ---
// Philip hat über den Laniakea-Rechtsklick zwei konkrete Fehlalarme markiert (siehe Notizen in
// laniakea_context) und explizit gesagt: "wir basteln gerade", d.h. diese Kriterien sind noch
// nicht in Stein gemeißelt. Deshalb bewusst als EIGENE, kleine Funktionen statt direkt in
// findLatestDivergence/collectDivergenceHistory verdrahtet — einzelne Filter (oder DIVERGENCE_FILTERS
// als Ganzes) lassen sich damit schnell rausnehmen oder die Schwellen anpassen, ohne die
// eigentliche Swing-/Referenz-Suche anzufassen.
const RSI_EXTREME_HIGH = 70;
const RSI_EXTREME_LOW = 30;

// Filter 1 — Beispiel Philip: bullish 44.7 -> 48.6 ("kein Punkt im Extrembereich"). Weder Referenz
// noch Vergleichspunkt war überkauft/überverkauft — ohne mindestens einen Extrempunkt ist es kein
// Momentum-Signal, nur Rauschen in der Mitte der Skala.
function passesExtremeZoneFilter(candles, rsi, bestIdx, jIdx) {
  const bestRsi = rsi[bestIdx].rsi;
  const jRsi = rsi[jIdx].rsi;
  return bestRsi >= RSI_EXTREME_HIGH || bestRsi <= RSI_EXTREME_LOW || jRsi >= RSI_EXTREME_HIGH || jRsi <= RSI_EXTREME_LOW;
}

// Filter 2 — Beispiel Philip: bearish 72.4 -> 64.5 ("RSI springt von 70 auf 30, daher Fehlalarm").
// Beide Endpunkte für sich sahen plausibel aus, aber dazwischen ist der RSI bis in den
// ENTGEGENGESETZTEN Extrembereich durchgerutscht und wieder zurück — die beiden Punkte gehören
// dann zu zwei unabhängigen Wellen (die erste ist durch den Sweep bis 30 längst invalidiert),
// kein durchgehendes Nachlassen von Momentum, auch wenn die reinen Endwerte danach aussehen.
function passesNoOppositeExtremeBetweenFilter(candles, rsi, bestIdx, jIdx, isBearish) {
  const oppositeThreshold = isBearish ? RSI_EXTREME_LOW : RSI_EXTREME_HIGH;
  for (let i = bestIdx + 1; i < jIdx; i++) {
    if (rsi[i].rsi == null) continue;
    if (isBearish ? rsi[i].rsi <= oppositeThreshold : rsi[i].rsi >= oppositeThreshold) return false;
  }
  return true;
}

// Reihenfolge/Zusammenstellung — hier einen Eintrag entfernen, um genau diesen Filter
// auszuschalten, ohne den Rest anzufassen.
const DIVERGENCE_FILTERS = [passesExtremeZoneFilter, passesNoOppositeExtremeBetweenFilter];

function passesAllDivergenceFilters(candles, rsi, bestIdx, jIdx, isBearish) {
  return DIVERGENCE_FILTERS.every((filter) => filter(candles, rsi, bestIdx, jIdx, isBearish));
}

// Swing-Hoch/-Tief an close, NICHT an den Docht-Extremen (candle.high/low) — bewusst dieselbe
// Preis-Basis wie computeRsi selbst (Wilder-RSI rechnet ausschließlich auf close, siehe oben).
// Erster Versuch mit high/low (klassischer für Chartmuster) fand am GBPUSD-10.08.-Beispiel NICHT
// dieselbe Divergenz, die beim manuellen Prüfen auffiel: ein Docht kann den unmittelbaren
// Nachbar-Swing knapp überragen (hier 08:15 mit einem 0.4-Pip höheren Hoch als 08:05), obwohl
// dessen RSI (aus dem CLOSE) deutlich niedriger war — die Divergenz "steckt" dann im Close, nicht
// im Wick. Eigene, einfache Fraktal-Funktion statt liquidityDetection.js's isUpFractal/isDownFractal
// wiederzuverwenden: die dort ist ans Pine-Script-Original der LQ-Sweep-Erkennung gebunden
// (kaskadierende Gleichstands-Regeln, "NICHT anfassen") — für Divergenzen reicht ein simpler,
// generischer Fraktal-Check.
// Exportiert (statt privat) — rsiDivergenceOutcome.js (Chat 2026-08-11, experimentell, siehe dort)
// braucht denselben Fraktal-Check, um rückwärts die Struktur-Marke vor einem Divergenz-Pivot zu
// finden. Kein zweiter Port, dieselbe Funktion.
export function isSwingHigh(candles, i, period) {
  for (let k = 1; k <= period; k++) {
    if (i - k < 0 || i + k >= candles.length) return false;
    if (candles[i - k].close >= candles[i].close || candles[i + k].close >= candles[i].close) return false;
  }
  return true;
}

export function isSwingLow(candles, i, period) {
  for (let k = 1; k <= period; k++) {
    if (i - k < 0 || i + k >= candles.length) return false;
    if (candles[i - k].close <= candles[i].close || candles[i + k].close <= candles[i].close) return false;
  }
  return true;
}

// Nur EIN Swing-Hoch/-Tief wird auf Divergenz geprüft, nicht jeder je gefundene (erste Version,
// Chat 2026-08-11, Bug-Report Philip: "zig tausend Linien im Chart") — bei viel geladener
// Chart-Historie (allCandles wächst mit jedem Scroll-Zurück) hätte ein Vergleich JEDES Swings
// gegen seine beste Referenz Dutzende überlappende, historische Divergenzen gleichzeitig
// gezeichnet. Maximal 2 Ergebnisse (eine bearish, eine bullish), exakt wie im Artifact-Beispiel.
//
// "j" (der geprüfte Swing) ist NICHT der chronologisch letzte, sondern der mit dem EXTREMSTEN
// Preis innerhalb von lookbackBars (höchstes Hoch fürs bearish-Bein, tiefstes Tief fürs
// bullish-Bein) — zweiter Bug-Report Philip, selbe Session: die erste Version nahm den
// chronologisch letzten Swing, wodurch dieselbe alte Referenz (08:05, RSI 75.2) mit JEDEM neuen,
// aber SCHWÄCHEREN Swing danach (12:30/12:55/13:35/14:05, alle unter dem eigentlichen Hoch um
// 11:10) eine "neue" Divergenz vortäuschte, obwohl der Kurs sein Extrem (11:10) nie wieder
// erreichte — die Linie "wanderte nach rechts", obwohl die erwartete Bewegung (der Drop
// 11:10->12:00) längst gelaufen war. Mit "extremster Preis" bleibt j automatisch bei 11:10
// stehen, solange kein späterer Swing dieses Hoch tatsächlich bricht — kein separater
// Ablauf-Timer nötig, das ergibt sich strukturell.
//
// Referenz bleibt die "härteste" vorherige (höchstes RSI unter allen Swing-Hochs mit niedrigerem
// Preis / niedrigstes RSI unter allen Swing-Tiefs mit höherem Preis) innerhalb von lookbackBars
// VOR j, nicht nur der unmittelbar vorherige Swing — sonst wäre "RSI-Hoch früh in der Session,
// Preis klettert über mehrere Zwischenswings hinweg immer weiter, ohne dass RSI je wieder dahin
// kommt" unsichtbar (der ursprüngliche Fund: 08:05 RSI 75.2 vs. 11:10 RSI nur noch 66.2, trotz
// höherem Preis-Hoch). Geteilt mit collectDivergenceHistory() unten (Chat 2026-08-11, zweite
// Runde: "wie viel Aufwand wäre es historische Divergenzen anzuzeigen") über denselben
// findBestReference()-Baustein, damit die Referenz-Logik nicht doppelt gepflegt werden muss.
// swingIdx ist aufsteigend sortiert (siehe Aufbau in detectRsiDivergence/-History) -> per
// Binärsuche direkt zum ersten Kandidaten innerhalb von lookbackBars springen, statt bei jedem
// Aufruf das komplette Array zu scannen (2026-08-24, Perf-Fund beim vollen Jahres-Backtest über
// rsiDivergenceStats.ts: bei mehreren tausend Swings über 8+ Monate wurde collectDivergenceHistory
// dadurch quadratisch und brauchte >5 Minuten ohne Ergebnis). Gleiche Kandidaten, gleiches "best" —
// nur die Schleife bleibt jetzt auf das relevante Fenster beschränkt statt bei jedem Treffer erneut
// alles zu durchlaufen.
function findBestReference(j, swingIdx, candles, rsi, lookbackBars, isBearish) {
  let best = null;
  const minI = j - lookbackBars;
  let lo = 0;
  let hi = swingIdx.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (swingIdx[mid] < minI) lo = mid + 1;
    else hi = mid;
  }
  for (let k = lo; k < swingIdx.length; k++) {
    const i = swingIdx[k];
    if (i >= j) break;
    if (rsi[i].rsi == null) continue;
    const priceQualifies = isBearish ? candles[i].close < candles[j].close : candles[i].close > candles[j].close;
    if (!priceQualifies) continue;
    const isBetterReference = best == null || (isBearish ? rsi[i].rsi > rsi[best].rsi : rsi[i].rsi < rsi[best].rsi);
    if (isBetterReference) best = i;
  }
  return best;
}

function buildDivergenceEntry(type, bestIdx, jIdx, candles, rsi) {
  return {
    type,
    fromTime: candles[bestIdx].time,
    toTime: candles[jIdx].time,
    fromPrice: candles[bestIdx].close,
    toPrice: candles[jIdx].close,
    fromRsi: rsi[bestIdx].rsi,
    toRsi: rsi[jIdx].rsi,
  };
}

// Bis 2026-08-24 eigene, unabhängige "j"-Suche: extremster Swing innerhalb von lookbackBars ab dem
// chronologisch LETZTEN Swing im Fenster. Bug (Philip, GBPUSD 21.08., Task
// "RSI-Wert falsch"): ein nie gebrochenes Hoch/Tief "altert" so nach lookbackBars aus dem
// Suchfenster, selbst wenn seither kein extremerer Swing mehr aufgetaucht ist — ein schwächerer,
// aber noch "in Reichweite" liegender späterer Swing wird dann fälschlich als j gewählt und gegen
// eine ältere Referenz zu einer Divergenz erklärt, obwohl der eigentliche (jüngere, extremere,
// nicht gebrochene) Peak dazwischen Preis UND RSI synchron bewegt hat — keine echte Divergenz.
// Fix: dieselbe Peak-Tracking-Logik wie collectDivergenceHistory (ein Peak bleibt "regierend", bis
// ihn ein Swing tatsächlich bricht, statt nach einer festen Bar-Distanz zu verfallen) — "aktuell"
// ist damit strukturell derselbe letzte Eintrag wie die Historie, kein zweiter, abweichender
// Suchpfad mehr.
function findLatestDivergence(swingIdx, candles, rsi, lookbackBars, type) {
  const history = collectDivergenceHistory(swingIdx, candles, rsi, lookbackBars, type);
  return history.length > 0 ? history[history.length - 1] : null;
}

/**
 * @param {{time: number, close: number}[]} candles
 * @param {number} [period]
 * @param {number} [lookbackBars]
 * @returns {{type: "bearish" | "bullish", fromTime: number, toTime: number, fromPrice: number, toPrice: number, fromRsi: number, toRsi: number}[]}
 */
export function detectRsiDivergence(candles, period = DEFAULT_DIVERGENCE_FRACTAL_PERIOD, lookbackBars = DEFAULT_DIVERGENCE_LOOKBACK_BARS) {
  const rsi = computeRsi(candles);

  const swingHighIdx = [];
  const swingLowIdx = [];
  for (let i = 0; i < candles.length; i++) {
    if (isSwingHigh(candles, i, period)) swingHighIdx.push(i);
    if (isSwingLow(candles, i, period)) swingLowIdx.push(i);
  }

  const result = [];
  const bearish = findLatestDivergence(swingHighIdx, candles, rsi, lookbackBars, "bearish");
  if (bearish) result.push(bearish);
  const bullish = findLatestDivergence(swingLowIdx, candles, rsi, lookbackBars, "bullish");
  if (bullish) result.push(bullish);
  return result;
}

export const DEFAULT_DIVERGENCE_HISTORY_COUNT = 5; // je Richtung, wie tradeSetupHistoryCount in Dashboard.vue

// Läuft chronologisch durch alle Swings und merkt sich den jeweils "regierenden" Extrempunkt
// (den bisher höchsten Swing-Hoch bzw. tiefsten Swing-Tief seit dem letzten Ereignis) — ein
// Swing, der dieses Extrem NICHT bricht, wird komplett übersprungen (dasselbe Anti-Wander-Prinzip
// wie in findLatestDivergence, nur fortlaufend statt einmalig am Ende). Erst wenn ein Swing das
// bisherige Extrem tatsächlich überbietet, wird er auf Divergenz geprüft UND wird selbst zum
// neuen Extrempunkt — so entsteht eine Folge von NICHT überlappenden, je einmal gezeichneten
// Ereignissen statt der "zig tausend Linien" einer naiven "jeder Swing gegen jede Referenz"-Suche.
//
// "peak brechen" gilt nur INNERHALB von lookbackBars (Bug beim ersten Test: ein sehr altes,
// tiefes Tief von zwei Tagen zuvor blieb sonst für immer der "regierende" Peak und unterdrückte
// jede spätere, echte Divergenz — auch die bereits einzeln bestätigte GBPUSD-10.08.-Bullish, die
// detectRsiDivergence() im "aktuell"-Modus richtig fand). Ist der alte Peak zu weit weg, zählt er
// nicht mehr als Referenzpunkt fürs Brechen (er kann aber selbst noch als RSI-Referenz für spätere
// Swings dienen, das prüft findBestReference separat mit demselben Fenster).
//
// Zweiter Bug beim ersten Test: solange derselbe alte Anker (z.B. 08:05) noch die "härteste"
// Referenz bleibt, bricht JEDER neue, leicht höhere Swing (09:40, 10:10, 11:10, ...) für sich
// genommen den Peak — macht aus EINER echten Divergenz wieder mehrere fast identische Einträge
// (dieselbe "zig tausend Linien"-Falle wie bei findLatestDivergence, nur historisch statt live).
// Fix: bleibt die Referenz (best) zum vorherigen Ereignis gleich, wird der letzte Eintrag
// AKTUALISIERT statt ein neuer angehängt — eine Divergenz-"Geschichte" bekommt genau einen
// Eintrag, der bis zu ihrem tatsächlichen Extrempunkt mitwächst; erst ein Swing mit einer WIRKLICH
// anderen (neueren) Referenz zählt als eigenständiges, neues Ereignis.
function collectDivergenceHistory(swingIdx, candles, rsi, lookbackBars, type) {
  const isBearish = type === "bearish";
  const result = [];
  let peak = null;
  let lastRef = null;

  for (const j of swingIdx) {
    if (rsi[j].rsi == null) continue;
    if (peak != null && j - peak <= lookbackBars) {
      const breaksPeak = isBearish ? candles[j].close > candles[peak].close : candles[j].close < candles[peak].close;
      if (!breaksPeak) continue; // schwächeres Echo unter/über dem bisherigen Extrem, kein eigenes Ereignis
    }
    const best = findBestReference(j, swingIdx, candles, rsi, lookbackBars, isBearish);
    if (best != null) {
      const rsiDelta = isBearish ? rsi[best].rsi - rsi[j].rsi : rsi[j].rsi - rsi[best].rsi;
      if (rsiDelta >= MIN_DIVERGENCE_RSI_DELTA && passesAllDivergenceFilters(candles, rsi, best, j, isBearish)) {
        const entry = buildDivergenceEntry(type, best, j, candles, rsi);
        if (best === lastRef && result.length > 0) result[result.length - 1] = entry;
        else result.push(entry);
        lastRef = best;
      }
    }
    peak = j;
  }
  return result;
}

/**
 * Wie detectRsiDivergence, aber die komplette (nicht überlappende) Ereignis-Historie statt nur der
 * aktuell gültigen Divergenz — maxCount begrenzt je Richtung auf die jeweils JÜNGSTEN Ereignisse.
 * @param {{time: number, close: number}[]} candles
 * @param {number} [period]
 * @param {number} [lookbackBars]
 * @param {number} [maxCount]
 * @returns {{type: "bearish" | "bullish", fromTime: number, toTime: number, fromPrice: number, toPrice: number, fromRsi: number, toRsi: number}[]}
 */
export function detectRsiDivergenceHistory(
  candles,
  period = DEFAULT_DIVERGENCE_FRACTAL_PERIOD,
  lookbackBars = DEFAULT_DIVERGENCE_LOOKBACK_BARS,
  maxCount = DEFAULT_DIVERGENCE_HISTORY_COUNT,
) {
  const rsi = computeRsi(candles);

  const swingHighIdx = [];
  const swingLowIdx = [];
  for (let i = 0; i < candles.length; i++) {
    if (isSwingHigh(candles, i, period)) swingHighIdx.push(i);
    if (isSwingLow(candles, i, period)) swingLowIdx.push(i);
  }

  const bearish = collectDivergenceHistory(swingHighIdx, candles, rsi, lookbackBars, "bearish").slice(-maxCount);
  const bullish = collectDivergenceHistory(swingLowIdx, candles, rsi, lookbackBars, "bullish").slice(-maxCount);
  return [...bearish, ...bullish].sort((a, b) => a.toTime - b.toTime);
}
