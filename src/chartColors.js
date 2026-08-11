import { reactive, watch, nextTick } from "vue";
import { supabase } from "./supabaseClient.js";

// Zentraler, reaktiver Farb-Store für sämtliche Chart-Indikatoren (Kerzen, CVD, EMA, Liquidität,
// Order-Blocks, Trade-Setups, Ranges, Trade-Marker) — als ES-Modul-Singleton (nicht an
// eine Vue-Komponente gebunden), damit jedes Render-Modul (liquidity.js, orderBlocks.js,
// pivotMarkers.ts, marketStructureAnalysis.ts, tradeMarkers.js) und das StyleModal dieselbe Instanz lesen/
// schreiben, ohne Farben durch PriceChart.vue durchreichen zu müssen (siehe Chat: "Style"-Button
// + Modal, "alle Farben einstellen"). Persistiert komplett in localStorage, analog zu
// useLocalStorageRef, aber für ein ganzes Farb-Objekt statt eines einzelnen Werts.
//
// Jeder Eintrag ist { hex, alpha } statt nur hex (siehe Chat: "bei den Farben fehlt mir noch
// Transparenz") — <input type="color"> kann selbst kein Alpha, daher getrennt vom StyleModal
// per eigenem Regler gepflegt. alpha ist die "Haupt"-Transparenz des jeweiligen Konzepts (z.B.
// die Linie); Konzepte mit mehreren Alpha-Varianten (Order-Block Fill/Weak/Border) skalieren die
// übrigen Varianten proportional dazu, siehe cssColorScaled.
const STORAGE_KEY = "trading-monitor:chartColors";

export const DEFAULT_CHART_COLORS = {
  candleUp: { hex: "#26a69a", alpha: 1 },
  candleDown: { hex: "#ef5350", alpha: 1 },
  cvdLine: { hex: "#f0b90b", alpha: 1 },
  emaFast: { hex: "#42a5f5", alpha: 1 },
  emaSlow: { hex: "#ffb74d", alpha: 1 },
  // RSI(14)-Panel (Chat 2026-08-11, siehe rsi.js/PriceChart.vue: refreshRsiInternal) — eigene
  // Pane unterhalb des Candlestick-Charts wie CVD, aber eigener Farbton (kein Gold/Blau/Orange,
  // schon von cvdLine/emaFast/emaSlow belegt).
  rsi: { hex: "#7e57c2", alpha: 1 },
  // Divergenz-Konnektoren (Chat 2026-08-11, siehe rsi.js: detectRsiDivergence/rsiRendering.js) —
  // dieselbe Rot/Grün-Warnsemantik wie candleDown/candleUp, aber eigene Keys statt Wiederverwendung
  // (Muster wie tradeInvalidation: ein späteres Anpassen von candleDown soll diese Linien nicht
  // mitverschieben).
  divergenceBearish: { hex: "#ef5350", alpha: 0.85 },
  divergenceBullish: { hex: "#26a69a", alpha: 0.85 },
  liquidityHigh: { hex: "#00e676", alpha: 0.9 },
  liquidityLow: { hex: "#ff9800", alpha: 0.9 },
  liquiditySweep: { hex: "#ffd700", alpha: 0.9 },
  // Aufgeteilt in M5/1H/4H (Chat 2026-07-30, Bug-Report Philip: "die ganzen OBs lassen sich
  // schwierig unterscheiden") — vorher EIN gemeinsamer Satz (obBull/obBear/obInactive) für alle
  // Timeframes, nur 1H bekam einen fest verdrahteten Dimm-Faktor (DIM_FACTOR_1H in orderBlocks.js,
  // seitdem entfernt), 4H und M5 sahen identisch aus. Defaults hier bewusst nach Timeframe gestuft
  // (4H am kräftigsten/wichtigsten, M5 am dezentesten, weil "ganz viele" gleichzeitig sichtbar
  // sind) — reine Startwerte, frei über Chart-Style änderbar.
  obBullM5: { hex: "#26a69a", alpha: 0.12 },
  obBearM5: { hex: "#ef5350", alpha: 0.12 },
  obInactiveM5: { hex: "#787b86", alpha: 0.07 },
  obBull1h: { hex: "#26a69a", alpha: 0.18 },
  obBear1h: { hex: "#ef5350", alpha: 0.18 },
  obInactive1h: { hex: "#787b86", alpha: 0.1 },
  obBull4h: { hex: "#26a69a", alpha: 0.3 },
  obBear4h: { hex: "#ef5350", alpha: 0.3 },
  obInactive4h: { hex: "#787b86", alpha: 0.16 },
  // Umrandung jetzt eigenständig statt eines fest verdrahteten Alpha-Verhältnisses zur Füllfarbe
  // (Chat 2026-07-30, Philip: "diese Boxumrandung stylebar machen") — eigene Hex+Alpha pro Zustand/
  // Timeframe, Breite bleibt wie bisher am Füll-Key (obBull*/obBear*/obInactive*) in
  // chartLineWidths.js, da es nur einen Stroke gibt, keinen zweiten unabhängigen Breiten-Regler
  // braucht. Startwerte = alte Default-Verhältnisse (Border ≈ 2,3-2,5× Füll-Alpha) 1:1 übernommen,
  // damit sich am Erscheinungsbild zunächst nichts ändert.
  obBullM5Border: { hex: "#26a69a", alpha: 0.3 },
  obBearM5Border: { hex: "#ef5350", alpha: 0.3 },
  obInactiveM5Border: { hex: "#787b86", alpha: 0.16 },
  obBull1hBorder: { hex: "#26a69a", alpha: 0.45 },
  obBear1hBorder: { hex: "#ef5350", alpha: 0.45 },
  obInactive1hBorder: { hex: "#787b86", alpha: 0.23 },
  obBull4hBorder: { hex: "#26a69a", alpha: 0.75 },
  obBear4hBorder: { hex: "#ef5350", alpha: 0.75 },
  obInactive4hBorder: { hex: "#787b86", alpha: 0.37 },
  tradeSetupShort: { hex: "#ffd700", alpha: 0.9 },
  tradeSetupLong: { hex: "#2196f3", alpha: 0.9 },
  tradeSetupProtected: { hex: "#ffffff", alpha: 0.95 },
  rangeHigh: { hex: "#ef5350", alpha: 0.95 },
  rangeLow: { hex: "#00e676", alpha: 0.95 },
  rangeProtectedLow: { hex: "#ffffff", alpha: 0.95 },
  rangeLqSweep: { hex: "#ffd700", alpha: 0.9 },
  rangeBreakOfStructure: { hex: "#ef5350", alpha: 0.95 },
  // Verbindungslinie der AKTUELL laufenden (noch nicht archivierten) Range, nach Trendrichtung
  // (Chat 2026-07-31, Bug-Report Philip: "abgeschlossene range konfiguriert nicht die echte
  // abgeschlossene range, sondern die aktuelle" — vorher teilten sich live und abgeschlossene
  // Range denselben Key rangeClosed/rangeChoch, siehe dort). Default = alte rangeClosed-Farbe.
  rangeLiveUptrend: { hex: "#00e676", alpha: 0.5 },
  // Default = alte rangeChoch-Farbe (siehe unten).
  rangeLiveDowntrend: { hex: "#ff7043", alpha: 0.95 },
  // Abgeschlossene Range nach einer Trend-Promotion (Chat 2026-07-25) — einfache Linie
  // range.low -> range.high, dieselbe Grundfarbe wie rangeLow (bullische Range), aber
  // transparenter, damit sie sich als "Historie" von der aktuell laufenden Range abhebt.
  // Seit Chat 2026-07-31 NUR NOCH für archivierte Uptrend-Ranges (siehe rangeLiveUptrend oben für
  // die laufende Range).
  rangeClosed: { hex: "#00e676", alpha: 0.5 },
  // Archivierte Downtrend-Range, Pendant zu rangeClosed (Chat 2026-07-31) — bewusst eigener Key
  // statt weiterhin rangeChoch mitzubenutzen, damit dieser Regler unabhängig von der
  // CHoCH-Warnfarbe (echtes CHoCH-Signal, siehe rangeChoch unten) einstellbar ist. Default = alte
  // rangeChoch-Farbe.
  rangeClosedDowntrend: { hex: "#ff7043", alpha: 0.95 },
  // CHoCH-Label des Nested-Gegentrend-Trackers (Chat 2026-07-25, siehe advanceNestedTrend) —
  // eigene Farbe statt rangeBreakOfStructure, weil ein CHoCH (Vorlauf-Signal) fachlich etwas
  // anderes ist als ein Break of Structure (Warnsignal im bestehenden Trend).
  rangeChoch: { hex: "#ff7043", alpha: 0.95 },
  // 0,5er-Fib-Level (Chat 2026-07-30, siehe marketStructureAnalysis.ts: computeFibLevels) — ein
  // Key für beide Varianten (reiner Tick am Range-Fib vs. gestrichelte Zickzack-Linie+Tick am
  // Protected-Fib), weder bullisch noch bärisch, daher eigener neutraler Farbton statt Wiederverwendung.
  rangeFib: { hex: "#26c6da", alpha: 0.95 },
  rangesMarker: { hex: "#00bcd4", alpha: 0.9 },
  // Periode-2-Debug-Marker (siehe Chat 2026-07-19: "früherer Uptrend-Erkennung") — bewusst
  // dieselbe Grundfarbe wie rangesMarker (Periode 5), aber deutlich transparenter, damit man
  // beide auf einen Blick auseinanderhält, ohne extra eine zweite Farbe lernen zu müssen.
  rangesMarker2: { hex: "#00bcd4", alpha: 0.5 },
  tradeWin: { hex: "#26a69a", alpha: 1 },
  tradeLoss: { hex: "#ef5350", alpha: 1 },
  // Fallback-Farbe für Exit-Marker ohne win/loss-Outcome (Chat 2026-07-31: "open"/"invalid" als
  // eigene Marker-Farben raus — "open" hat in der Praxis nie einen Exit-Preis, "invalid" gibt's als
  // Outcome gar nicht mehr, siehe tradeMarkers.js: tradeOptions) — greift nur noch im Rest-Fall
  // "Exit-Preis gesetzt, aber noch kein Ergebnis gewählt".
  tradeInvalid: { hex: "#787b86", alpha: 1 },
  tradeConnector: { hex: "#2962ff", alpha: 0.75 },
  // Vertikale News-Marker (Chat 2026-07-26, siehe newsMarkers.js) — Default = candleDown-Rot,
  // dieselbe Warnfarbe wie das TSC-No-Go-Banner (NO_GO_COLOR in tradeSetupCockpit.ts).
  newsEvent: { hex: "#ef5350", alpha: 0.9 },
  // Target-Linien (Chat 2026-07-28, Pivot- oder OB-Ziel eines Trades) — eigene Farbe statt
  // tradeSetupLong/-Short oder liquidityHigh/-Low, damit ein Target auch dann als "das ist ein
  // Target" erkennbar bleibt, wenn es zufällig mit einer normalen Liquiditäts-/OB-Zeichnung
  // überlappt (siehe PriceChart.vue: refreshTradeTargetLinksInternal).
  tradeTarget: { hex: "#ab47bc", alpha: 0.95 },
  // Bestätigungs-Linien (PLAN-trade-confluences.md #1) — eigene Farbe, damit sich Bestätigung
  // (bereits passierte Evidenz) und Target (zukünftige Erwartung) auch farblich unterscheiden,
  // trotz gleicher Klick-/Zeichen-Infrastruktur (siehe refreshTradeConfirmationLinksInternal).
  tradeConfirmation: { hex: "#5c6bc0", alpha: 0.95 },
  // Invalidierungs-Linie einer dealing_range (Chat 2026-07-31) — dieselbe Gefahren-Rot-Semantik
  // wie NO_GO_COLOR/candleDown/tradeLoss (dieser Preis = die ganze Idee ist tot), eigener Key statt
  // Wiederverwendung, damit ein späteres Anpassen von z.B. tradeLoss diese Linie nicht mitverschiebt.
  tradeInvalidation: { hex: "#ef5350", alpha: 0.9 },
  // Hover-Hervorhebung (Chat 2026-08-01) — Halo-Ring um Entry/Exit einer in TradesTable.vue
  // gehoverten Zeile (siehe tradeMarkers.js: TradeMarkerRenderer). Eigener neutraler Akzentton statt
  // Wiederverwendung von tradeWin/tradeLoss, weil die Hervorhebung unabhängig von Gewinn/Verlust
  // immer gleich aussehen soll.
  tradeHover: { hex: "#ffd600", alpha: 0.9 },
  // Laniakea-Kontext (Chat 2026-08-01, siehe laniakeaContext.js) — EIN Akzentton für alles, was
  // mit "an Lana übergeben" zu tun hat (permanenter Chart-Ring UND Tabellenzeilen-Tönung), damit
  // die beiden Stellen erkennbar zusammengehören statt zwei unabhängige Farben zu lernen. Die
  // dezentere Tabellenzeilen-Tönung wird per cssColorScaled("laniakea", ratio) aus demselben Wert
  // abgeleitet (Muster wie OB-Fill/Border), kein zweiter Farb-Key nötig.
  // Pink statt Lila (tradeTarget/tradeConfirmation belegen Lila/Indigo bereits) — soll auf den
  // ersten Blick nicht mit Target-/Bestätigungs-Linien verwechselbar sein.
  laniakea: { hex: "#ec407a", alpha: 0.9 },
};

function loadInitial() {
  let saved = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = {}; // korrupter/fremder Wert unter dem Key -> ignorieren, Defaults nutzen
  }
  const result = {};
  for (const [key, def] of Object.entries(DEFAULT_CHART_COLORS)) {
    const s = saved[key];
    if (s && typeof s === "object" && typeof s.hex === "string") {
      result[key] = { hex: s.hex, alpha: typeof s.alpha === "number" ? s.alpha : def.alpha };
    } else if (typeof s === "string") {
      // Altes Format von vor der Transparenz-Erweiterung (nur Hex-String) -> Farbton
      // übernehmen, Standard-Alpha behalten statt den gespeicherten Wert zu verwerfen.
      result[key] = { hex: s, alpha: def.alpha };
    } else {
      result[key] = { ...def };
    }
  }
  return result;
}

export const chartColors = reactive(loadInitial());

// true während ein DB-Fetch die Werte reinschreibt — verhindert, dass genau dieser Merge sofort
// wieder einen Save auslöst (würde die gerade gelesenen Werte unnötig zurückschreiben, siehe
// applyRemote unten). Per nextTick statt synchron zurückgesetzt, weil Vues watch-Callback erst
// im nächsten Flush läuft, nicht sofort bei der Mutation.
let suppressSave = false;
// DB-Schreiben debounced (Farb-/Alpha-Regler feuern viele Events beim Ziehen) — localStorage
// bleibt dagegen sofort synchron (billig, kein Netzwerk).
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 500;

watch(
  chartColors,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // localStorage kann fehlschlagen (privater Modus, Quota) — Farben gelten dann nur
      // für die aktuelle Session, kein Show-Stopper.
    }
    if (suppressSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToRemote, SAVE_DEBOUNCE_MS);
  },
  { deep: true },
);

async function saveToRemote() {
  const rows = Object.entries(chartColors).map(([key, c]) => ({ key, hex: c.hex, alpha: c.alpha }));
  const { error } = await supabase.from("chart_colors").upsert(rows, { onConflict: "key" });
  if (error) console.error("Chart-Farben in DB speichern fehlgeschlagen:", error);
}

// Geräteübergreifender Sync (siehe Chat: "hab mehrere Geräte") — localStorage sorgt für den
// sofortigen ersten Render, bevor die Antwort da ist; kommt sie an, gewinnt die DB (letztes
// Gerät, das etwas geändert hat). Leere Tabelle (Migration noch nicht ausgerollt) -> lokale
// Werte unangetastet lassen statt auf nichts zurückzusetzen.
async function syncFromRemote() {
  try {
    const { data, error } = await supabase.from("chart_colors").select("key, hex, alpha");
    if (error) throw error;
    if (!data || data.length === 0) return;
    suppressSave = true;
    for (const row of data) {
      if (DEFAULT_CHART_COLORS[row.key]) {
        chartColors[row.key] = { hex: row.hex, alpha: row.alpha };
      }
    }
    nextTick(() => {
      suppressSave = false;
    });
  } catch (err) {
    console.error("Chart-Farben aus DB laden fehlgeschlagen:", err);
  }
}
syncFromRemote();

export function resetChartColors() {
  for (const key of Object.keys(DEFAULT_CHART_COLORS)) {
    chartColors[key] = { ...DEFAULT_CHART_COLORS[key] };
  }
}

// Hex-Farbe (#rrggbb) + Alpha -> rgba(...).
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

// Hauptweg für Render-Module: chartColors[key] (hex+alpha) -> fertiger rgba()-String.
export function cssColor(key) {
  const c = chartColors[key];
  return hexToRgba(c.hex, c.alpha);
}

// Für Konzepte mit mehreren Alpha-Varianten derselben Basisfarbe (Order-Block Fill/Weak/Border,
// Trade-Setup-LS-Linie vs. -OB-Box) — ratio ist das Verhältnis der Ziel-Alpha zur "Haupt"-Alpha
// im ursprünglichen Default-Design (z.B. Border war immer das 2.5-fache der Fill-Alpha), damit
// EIN Regler alle zusammengehörigen Varianten proportional mitskaliert statt sie unabhängig
// einstellbar (und damit potenziell inkonsistent zueinander) zu machen.
export function cssColorScaled(key, ratio) {
  const c = chartColors[key];
  return hexToRgba(c.hex, c.alpha * ratio);
}
