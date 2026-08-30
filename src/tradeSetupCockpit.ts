// Trade-Setup-Cockpit (TSC): bündelt die aktuelle Analyse aus mehreren, bereits bestehenden
// Quellen (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles zusammenstöpseln", "ein
// 1h-LQ-Sweep allein reicht nicht"). Reine Anzeige/Aggregation, KEINE eigene Erkennungslogik —
// liest nur den schon berechneten MarketStructureState (H1, marketStructureAnalysis.ts) und die
// schon berechneten Trade-Setups (M5, tradeSetup.js) und stellt sie zusammengefasst dar.
//
// Seit Chat 2026-07-27 ("ich glaub es ist besser ne Vue Component draus zu machen") reine
// Datei für Datenlogik/Formatierungs-Helper — das eigentliche Zeichnen ist raus (war vorher ein
// lightweight-charts-Primitive mit Canvas-Draw, siehe Git-Historie vor diesem Commit) und lebt
// jetzt als echte Vue-Komponente in TradeSetupCockpit.vue, die computeCockpitState() + die Helper
// hier unten konsumiert. Verloren dabei: der "neben der letzten Kerze"-Positionsmodus (kein
// Pixel-Tracking der Kerze mehr aus einer Vue-Komponente heraus sinnvoll) — Philip hat das
// bewusst in Kauf genommen ("kann damit leben").
import type { MarketStructureState, Pivot, RangeTrend } from "./range.type";
import { cssColor, cssColorScaled } from "./chartColors.js";
import { businessSecondsBetween } from "./chartTimeUtils.js";

// Locker getypt (any) statt einer eigenen TradeSetup-Interface-Kopie — die eigentliche Form kommt
// aus detectTradeSetups() in tradeSetup.js (JS, kein eigener Typ dort) und wird hier nur gelesen,
// nicht verändert.
export interface CockpitState {
  h1Trend: "unknown" | "uptrend" | "downtrend";
  // Chat 2026-07-25 (Bug-Report Philip: "der TSC zeigt nicht an, dass der 1h uptrend schwächelt
  // (BOS wurde bestätigt)") — true, sobald irgendein structurePivot als 'break-of-structure'
  // markiert ist. Richtungsunabhängig (dasselbe Feld gilt für Uptrend UND Downtrend, siehe
  // markLqSweeps' direction-Parameter in marketStructureAnalysis.ts) — welche Konfluenz das genau
  // entwertet, entscheidet trendSetupConfirmation unten.
  h1Weakening: boolean;
  h1LqSweep: Pivot | null;
  m5Setup: {
    dir: 1 | -1;
    label: string;
    // "A" = eigenes bestätigtes Protected-Pivot, "B" = fractal===ls (Chat 2026-07-26: "möchte es
    // visuell unterschieden haben"), siehe pathType in tradeSetup.js.
    pathType: "A" | "B";
    // 1..n je Richtung, nur bei aktiver Trade-Setups-Historie gesetzt (siehe computeTradeSetups in
    // PriceChart.vue) — sonst null. Als "#x" ans Kartenlabel angehängt, damit sich die Karte
    // eindeutig der passenden OB-Box im Chart zuordnen lässt (Chat 2026-07-27).
    setupNumber: number | null;
    lsPrice: number;
    // Chat 2026-07-22: "im TSC ... bei den relevanten LQ-Leveln das Alter anzeigen" — pivotTime des
    // M5-LQ-Sweeps, nur für die Alters-Anzeige, sonst nirgends genutzt.
    lsPivotTime: number | undefined;
    // Zeitpunkt, an dem der LS-Pivot tatsächlich geswept wurde (Bug-Report Philip 2026-07-27: die
    // Alters-Anzeige zeigte "Zeit bis jetzt" statt "Zeit bis zum Sweep") — siehe ageSuffix unten.
    lsTouchedTime: number | undefined;
    obTop: number;
    obBottom: number;
    // Verknüpfung zu einem geloggten Trade (Chat 2026-07-27: "im TSC muss die setup-id noch hin,
    // auch da gehts mir um visuelle Zuordnung") — nur gesetzt, wenn der TSC gerade auf einen Trade
    // aus der Liste fokussiert ist (siehe fetchTradeSetupForCockpit in tradeIntake.js); bei der
    // normalen Live-Verfolgung null, weil es dafür (noch) keine geloggte Zeile/keine "#<id>"-Box im
    // Chart gibt, mit der man es abgleichen könnte.
    tradeSetupId: number | null;
  } | null;
  antiConfluences: AntiConfluence[];
  // No-Go (isNoGo-Eintrag in antiConfluences) ODER Punktesumme >= ANTI_CONFLUENCE_THRESHOLD.
  locked: boolean;
}

// "Spricht dagegen"-Eintrag (Chat 2026-07-26: Philips Idee einer Gewichtung für Anti-Confluences,
// "ab 10 Punkten darf man den Trade nicht machen", No-Gos direkt sperren). isNoGo ist ABSICHTLICH
// ein eigenes Flag statt einfach "weight = ANTI_CONFLUENCE_THRESHOLD" — sonst würde ein späteres
// Hochsetzen der Schwelle (z.B. auf 12) ein No-Go rechnerisch stillschweigend entsperren, obwohl
// ein No-Go per Definition IMMER sperren soll, unabhängig von der Punkte-Schwelle.
export interface AntiConfluence {
  text: string;
  weight: number;
  isNoGo: boolean;
}

// Ab dieser Punktesumme (ohne No-Gos, die sperren immer) gilt der Trade als gesperrt. Start-Wert
// nach Philips Vorschlag — reine Zahl, kein gemessener/kalibrierter Wert, bei Bedarf anpassen.
export const ANTI_CONFLUENCE_THRESHOLD = 10;

// Farben für die Sperr-/Anti-Confluence-Darstellung — literal statt cssColor(candleDown), damit
// spätere Änderungen an der Long/Short-Farbsemantik (Grün/Rot=Richtung) diesen eigenständigen
// Warnzustand nicht mitverschieben (siehe cardAccentColors).
export const NO_GO_COLOR = "rgba(239, 83, 80, 0.95)";
export const ANTI_CONFLUENCE_COLOR = "rgba(255, 179, 0, 0.95)";
const LOCKED_ACCENT = { fill: "rgba(239, 83, 80, 0.22)", border: NO_GO_COLOR };

// Erster automatischer Anti-Confluence-Input (Chat 2026-07-26): sessions.danger existierte vorher
// nur zur Anzeige (siehe DANGER_LEVELS in sessions.js), hier zum ersten Mal tatsächlich konsumiert.
// "forbidden" ("Verboten (kein Trade-Entry)") ist ein No-Go, "caution" ("mehr Bestätigungen nötig")
// ein gewichteter Anti-Confluence-Eintrag.
const SESSION_CAUTION_WEIGHT = 5;

// Zweiter automatischer Input (Chat 2026-07-26): High-Impact-News, siehe newsEvents.js. Kein
// externer API-Feed — Philip trägt die Termine per ForexFactory-Screenshot ein, Claude schreibt sie
// per Migration in die `news_events`-Tabelle (siehe supabase/migrations/20260726120000_news_events.sql).
// Immer ein No-Go, nie nur gewichtet — es gibt aktuell keine "leichteren" News-Stufen, weil Philip
// nur die roten (High-Impact) FF-Termine überhaupt einträgt.
function computeAntiConfluences(
  sessionDanger: { level: "caution" | "forbidden"; label: string } | null,
  newsNoGo: { title: string; currency: string } | null,
): AntiConfluence[] {
  const list: AntiConfluence[] = [];
  if (sessionDanger) {
    if (sessionDanger.level === "forbidden") {
      list.push({ text: `Sperrzeit-Session aktiv: ${sessionDanger.label}`, weight: 0, isNoGo: true });
    } else {
      list.push({ text: `Vorsicht-Session aktiv: ${sessionDanger.label}`, weight: SESSION_CAUTION_WEIGHT, isNoGo: false });
    }
  }
  if (newsNoGo) {
    list.push({ text: `News-Event: ${newsNoGo.currency} ${newsNoGo.title}`, weight: 0, isNoGo: true });
  }
  return list;
}

// tradeSetups: die schon von computeTradeSetups() berechnete Liste (siehe PriceChart.vue,
// chronologisch) — nimmt den zeitlich JÜNGSTEN (letzten) Eintrag, unabhängig von Richtung, als
// "die aktuell relevante" Analyse. Bewusst NICHT geprüft, ob h1LqSweep und der M5-LQ-Sweep aus
// m5Setup derselbe sind — das ist laut Philip nicht immer der Fall (Trade-Setups bezieht auch
// kleinere LQ-Sweeps mit ein) und wird hier nur nebeneinander dargestellt, nicht verglichen.
// sessionDanger/newsNoGo: schon fürs aktuelle Instrument/JETZT ermittelt (siehe
// currentSessionDanger in sessions.js, currentNewsNoGo in newsEvents.js) — computeCockpitState
// bleibt reine Aggregation, keine eigene Zeit-/Session-/News-Logik.
export function computeCockpitState(
  structureState: MarketStructureState | null,
  tradeSetups: any[],
  sessionDanger: { level: "caution" | "forbidden"; label: string } | null = null,
  newsNoGo: { title: string; currency: string } | null = null,
): CockpitState {
  const h1Trend = structureState?.trend ?? "unknown";
  const h1Weakening = structureState?.structurePivots.some((p) => p.type === "break-of-structure") ?? false;
  const h1LqSweep = structureState?.structurePivots.find((p) => p.type === "LQ-sweep") ?? null;
  const last = tradeSetups.length > 0 ? tradeSetups[tradeSetups.length - 1] : null;
  const m5Setup = last
    ? {
        dir: last.dir as 1 | -1,
        label: last.label as string,
        pathType: last.pathType as "A" | "B",
        setupNumber: (last.setupNumber ?? null) as number | null,
        lsPrice: last.ls.price as number,
        lsPivotTime: last.ls.pivotTime as number | undefined,
        lsTouchedTime: last.ls.touchedTime as number | undefined,
        obTop: last.obTop as number,
        obBottom: last.obBottom as number,
        tradeSetupId: (last.tradeSetupId ?? null) as number | null,
      }
    : null;
  const antiConfluences = computeAntiConfluences(sessionDanger, newsNoGo);
  const score = antiConfluences.filter((a) => !a.isNoGo).reduce((sum, a) => sum + a.weight, 0);
  const locked = antiConfluences.some((a) => a.isNoGo) || score >= ANTI_CONFLUENCE_THRESHOLD;
  return { h1Trend, h1Weakening, h1LqSweep, m5Setup, antiConfluences, locked };
}

// Karten-Hintergrund/-Rand färben sich nach der M5-Setup-Richtung ein (Long=grün, Short=rot) —
// bewusst NICHT dieselben Farben wie die M5-LS-Linie/OB-Box (tradeSetupLong/-Short) - das bleibt
// laut Philip unabhängig ("es kann ein Short Setup geben mit 1h uptrend, das ist damit ich es gut
// einordnen kann"). Stattdessen die im Rest der App schon etablierte grün/rot-Semantik
// (candleUp/candleDown, auch tradeWin/tradeLoss) — Grün/Rot heißt hier "Long/Short", nicht "Trend"
// oder "Erfolg". Bei Sperre (state.locked) übersteuert der No-Go-/Anti-Confluence-Rahmen IMMER den
// sonstigen Long/Short-Akzent — "man darf gerade gar nicht traden" ist wichtiger als "in welche
// Richtung das Setup zeigt".
export function cardAccentColors(state: CockpitState): { fill: string; border: string } | null {
  if (state.locked) return LOCKED_ACCENT;
  if (!state.m5Setup) return null;
  const key = state.m5Setup.dir === -1 ? "candleUp" : "candleDown";
  return { fill: cssColorScaled(key, 0.16), border: cssColor(key) };
}

// Zeigt, ob das aktuelle M5-Setup den H1-Trend bestätigt oder ihm widerspricht (siehe Chat
// 2026-07-20: "Bestätigungen / Anti-Bestätigungen nur bissl visueller") — grüner Haken bei
// Übereinstimmung (Long im Uptrend, Short im Downtrend), rotes X bei Gegenrichtung. Bewusst
// symmetrisch für Downtrend mitgedacht, auch wenn der Algo den noch nicht produziert (siehe
// marketStructureAnalysis.ts). Kein Icon ohne Setup oder ohne bekannten Trend — nichts zu
// bestätigen/widerlegen.
// KEIN Haken mehr, sobald der Trend schwächelt (h1Weakening, Chat 2026-07-25: "da schwächelnder
// uptrend: keinen Haken (=Confluence) für einen Long setzen") — ein bestätigtes Break of Structure
// bedeutet, die Konfluenz mit dem H1-Trend ist nicht mehr belastbar, auch wenn Richtung und Trend
// formal noch übereinstimmen. Das X bei tatsächlichem Widerspruch bleibt unverändert (schwächelnder
// Trend macht einen Widerspruch nicht "weniger falsch").
export function trendSetupConfirmation(state: CockpitState): { text: string; color: string } | null {
  if (!state.m5Setup || state.h1Trend === "unknown") return null;
  const setupIsLong = state.m5Setup.dir === -1;
  const trendIsUp = state.h1Trend === "uptrend";
  const confirms = setupIsLong === trendIsUp;
  if (confirms && state.h1Weakening) return null;
  return confirms ? { text: "✓", color: cssColor("candleUp") } : { text: "✗", color: cssColor("candleDown") };
}

// Sperr-Banner-Text: bei No-Go dessen eigener Grund, sonst (Sperre allein durch Punktesumme) ein
// generischer Hinweis mit Punktestand — siehe ANTI_CONFLUENCE_THRESHOLD.
export function lockedReason(state: CockpitState): string {
  const noGo = state.antiConfluences.find((a) => a.isNoGo);
  if (noGo) return noGo.text;
  const score = state.antiConfluences.reduce((sum, a) => sum + a.weight, 0);
  return `zu viele Anti-Confluences (${score}/${ANTI_CONFLUENCE_THRESHOLD})`;
}

// Trend-Kette fürs TSC (Chat 2026-08-29, Philip: "der Trend soll rein") — läuft die rekursive
// nestedTrend-Verschachtelung des 1h-Structure-Algos ab (siehe range.type.ts: MarketStructureState.
// nestedTrend) und liefert pro Ebene Trend + Alter. WICHTIG: das ist KEINE echte 4H/1H/M5-
// Mehrfach-Timeframe-Berechnung — der ganze State kommt aus computeMarketStructure auf reinen
// 1H-Kerzen (siehe compute1hStructureState in der MCP dataExport.ts), die Verschachtelungstiefe
// steht nur ANALOG für "großer Trend -> Korrektur -> Gegenkorrektur" (siehe trendChainLevelDisplay).
// Terminiert von selbst: ein State mit trend==='unknown' hat laut advanceNestedTrend
// (marketStructureAnalysis.ts) immer nestedTrend=null.
export interface TrendChainLevel {
  trend: RangeTrend;
  ageSeconds: number | null;
  // Nur fürs "seit Do, 27.08."-Fallback bei < 1 Tag Alter gebraucht (siehe formatTrendAge) — sonst
  // wäre ageSeconds allein (nur die Differenz) nicht genug, um ein Kalenderdatum zu formatieren.
  originTimeSec: number | null;
}

// Bug-Report Philip 2026-08-29: erste Version nahm firstConfirmedAt als Anker ("seit wann läuft
// dieser Trend") — falsch, das ist der EINMALIGE Bestätigungs-Zeitpunkt (siehe firstConfirmedAt-
// Kommentar in range.type.ts, für die CHoCH-Darstellung gedacht), nicht der eigentliche Range-
// Ursprung. Ein Downtrend-Beispiel zeigte "1d 17h", obwohl currRange (high 21.08./low 27.08.) klar
// eine ~6-tägige Range war. Richtiger Anker ist der Pivot, an dem die aktuelle Range tatsächlich
// STARTET: der jeweils ÄLTERE der beiden currRange-Randpunkte — bei einem bestätigten Downtrend ist
// das strukturell immer currRange.high (der Ausgangspunkt der Bewegung), currRange.low der aktuell
// fortlaufende, JÜNGERE Extrempunkt; symmetrisch beim Uptrend. Min() statt Direction-Verzweigung
// deckt so automatisch auch trend==='unknown' mit ab, wo dieselbe fixer-Ursprung-plus-wandernder-
// Kandidat-Struktur gilt (siehe initMarketStructureState in marketStructureAnalysis.ts) — praktisch
// bedeutungslos seit 2026-08-30: computeTrendChain filtert 'unknown'-Level komplett aus der Kette,
// diese Funktion wird für sie also nie mehr aufgerufen (siehe dort).
function trendOriginPivotTime(state: MarketStructureState): number | null {
  const highTime = state.currRange.high.pivotTime ?? null;
  const lowTime = state.currRange.low.pivotTime ?? null;
  if (highTime == null) return lowTime;
  if (lowTime == null) return highTime;
  return Math.min(highTime, lowTime);
}

// Bug-Report Philip 2026-08-30: "unknown" bedeutet nicht Konsolidierung, sondern nur, dass der
// Algorithmus noch mehr Strukturpunkte braucht, um sich einzupegeln — reine Interna, "kann ich
// nichts mit anfangen". 'unknown'-Level (und alles darunter, siehe advanceNestedTrend-Garantie
// oben) fliegen deshalb komplett aus der Kette statt sie als eigene Ebene mitzuzählen.
export function computeTrendChain(structureState: MarketStructureState | null, nowSec: number): TrendChainLevel[] {
  const chain: TrendChainLevel[] = [];
  let state: MarketStructureState | null = structureState;
  while (state && state.trend !== "unknown") {
    const originTime = trendOriginPivotTime(state);
    chain.push({
      trend: state.trend,
      ageSeconds: originTime != null ? businessSecondsBetween(originTime, nowSec) : null,
      originTimeSec: originTime,
    });
    state = state.nestedTrend;
  }
  return chain;
}

// Pfeil-Symbole (Philip: "ein grüner Pfeil der hochgeht ... vice versa für die anderen") —
// diagonale Pfeile statt gerader ▲/▼, näher an seinem "Zigzag"-Vorschlag; reine Textglyphen (kein
// Emoji) statt 📈/📉, damit sie über --level-color dieselbe Richtungsfarbe wie der Rest des Chips
// bekommen (ein Farb-Emoji würde die eigene fixe Farbe behalten). KEIN Text-Label (Uptrend/
// Downtrend/Unbekannt) mehr daneben (Philip 2026-08-29: "dank den Pfeilen sind die wörter doch
// redundant") — der Pfeil allein trägt die Richtung, der Chip zeigt nur noch das Alter.
const TREND_DIRECTION_ICON: Record<RangeTrend, string> = { uptrend: "↗", downtrend: "↘", unknown: "→" };
const TREND_UNKNOWN_COLOR = "#9aa0ac"; // dasselbe Grau wie .tsc-date (TradeSetupCockpit.vue) — neutral, keine Richtung

// Hover-Hint je Verschachtelungstiefe (Philip 2026-08-29: "als mouse hover hint reicht mir: outer
// structure, nested structure, nested nested structure") — ersetzt die vorherige, jetzt nicht mehr
// sichtbare Trend/Korrektur/Gegenkorrektur-Beschriftung; erklärt die Tiefe nur noch beim Hovern,
// nicht mehr im Fließtext. Ab Tiefe 3 (bisher in der Praxis nicht vorgekommen) generisch
// weitergezählt statt eines vierten festen Namens.
function trendChainDepthHint(depth: number): string {
  if (depth === 0) return "outer structure";
  return `${Array(depth).fill("nested").join(" ")} structure`;
}

// Bewusst NICHT das gemeinsame formatAge (chartTimeUtils.js, "1d 3h") — Philip 2026-08-29: "Die
// Stunden info interessiert mich nicht", nur ganze Tage. Unter einem Tag lieber ein konkretes
// Kalenderdatum ("seit Do, 27.08.") als eine vage "< 1 Tag"-Angabe (Philip: "wenn '< Tag', dann
// lieber schreiben: '(seit Do, 27.08.)'") — Europe/Berlin wie überall sonst in der App (siehe
// CLAUDE.md Timezone-Konvention). .replace(".", "") entfernt nur den ERSTEN Punkt (den von de-DE an
// den Wochentag angehängten, "Do." -> "Do") — der Punkt am Datum ("27.08.") bleibt, exakt dasselbe
// Muster wie TSC_DATE_FORMATTER/dateLabel in TradeSetupCockpit.vue (hier separat gehalten statt von
// dort importiert, damit diese reine Formatierungslogik nicht an eine Vue-Komponente koppelt).
const TREND_AGE_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });

// Unter 1 Tag bleibt die "(seit ...)"-Klammer erhalten (Philip 2026-08-29 hatte das explizit so
// gewünscht), auch nachdem "Trend: {Richtung}" daneben wegfiel — ab 1 Tag nur noch die reine
// Tage-Zahl, keine Klammer mehr nötig (nichts, woran sie noch "hängen" würde).
function formatTrendAge(seconds: number, originTimeSec: number): string {
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return days === 1 ? "1 Tag" : `${days} Tage`;
  return `(seit ${TREND_AGE_DATE_FORMATTER.format(new Date(originTimeSec * 1000)).replace(".", "")})`;
}

// Nur noch das Alter als Text (Philip 2026-08-29: "dank den Pfeilen sind die wörter doch redundant"
// — IST "{Tage} Trend: {Richtung}", SOLL "{Tage}") — Richtung steckt komplett im Pfeil (icon,
// TREND_DIRECTION_ICON), die Tiefe nur noch im hint (trendChainDepthHint). "–" ohne Alter (praktisch
// nie der Fall, siehe trendOriginPivotTime — nur wenn currRange gänzlich ohne pivotTime ist).
export function trendChainLevelDisplay(level: TrendChainLevel, depth: number): { text: string; icon: string; color: string; hint: string } {
  const color = level.trend === "uptrend" ? cssColor("candleUp") : level.trend === "downtrend" ? cssColor("candleDown") : TREND_UNKNOWN_COLOR;
  const text = level.ageSeconds != null && level.originTimeSec != null ? formatTrendAge(level.ageSeconds, level.originTimeSec) : "–";
  return { text, icon: TREND_DIRECTION_ICON[level.trend], color, hint: trendChainDepthHint(depth) };
}
