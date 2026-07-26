// Trade-Setup-Cockpit (TSC): eine Karte im Chart, die die aktuelle Analyse aus mehreren, bereits
// bestehenden Quellen bündelt (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles
// zusammenstöpseln", "ein 1h-LQ-Sweep allein reicht nicht"). Reine Anzeige/Aggregation, KEINE
// eigene Erkennungslogik — liest nur den schon berechneten MarketStructureState (H1,
// marketStructureAnalysis.ts) und die schon berechneten Trade-Setups (M5, tradeSetup.js) und
// stellt sie zusammengefasst dar.
import type { MarketStructureState, Pivot } from "./range.type";
import { cssColor, cssColorScaled } from "./chartColors.js";
import { businessSecondsBetween, formatAge } from "./chartTimeUtils.js";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

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
    lsPrice: number;
    // Chat 2026-07-22: "im TSC ... bei den relevanten LQ-Leveln das Alter anzeigen" — pivotTime des
    // M5-LQ-Sweeps, nur für die Alters-Anzeige in buildLines, sonst nirgends genutzt.
    lsPivotTime: number | undefined;
    obTop: number;
    obBottom: number;
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
        lsPrice: last.ls.price as number,
        lsPivotTime: last.ls.pivotTime as number | undefined,
        obTop: last.obTop as number,
        obBottom: last.obBottom as number,
      }
    : null;
  const antiConfluences = computeAntiConfluences(sessionDanger, newsNoGo);
  const score = antiConfluences.filter((a) => !a.isNoGo).reduce((sum, a) => sum + a.weight, 0);
  const locked = antiConfluences.some((a) => a.isNoGo) || score >= ANTI_CONFLUENCE_THRESHOLD;
  return { h1Trend, h1Weakening, h1LqSweep, m5Setup, antiConfluences, locked };
}

// --- Zeichnung ----------------------------------------------------------------------------------
// Zwei Positionsmodi (siehe Chat: "WENN MÖGLICH: einen Toggle einfügen"): 'fixed' — rechter
// Pane-Rand, vertikal mittig (wie bisher das "1h uptrend"-Label, siehe marketStructureAnalysis.ts:
// TrendLabelPrimitive) — und 'candle' — rechts neben der letzten geladenen Kerze, mit Abstand.

interface Line {
  text: string;
  color: string;
  bold?: boolean;
  // Bestätigungs-/Anti-Bestätigungs-Icon direkt hinter dem Zeilentext, in eigener Farbe (siehe
  // trendSetupConfirmation) — z.B. der grüne Haken/rote X neben "1h uptrend".
  suffix?: { text: string; color: string };
  // Abgedunkelt gezeichnet (siehe draw(), globalAlpha) — bei state.locked für alles außer Titel,
  // Sperr-Banner und "Spricht dagegen"-Sektion: der Rest der Karte bleibt lesbar (Kontext), tritt
  // aber sichtbar hinter die eigentlich wichtige Info ("warum gesperrt") zurück.
  dim?: boolean;
  // Trennlinie + extra Abstand DIREKT VOR dieser Zeile (siehe draw()) — Chat 2026-07-26 ("'spricht
  // dagegen' section bitte optisch besser trennen"): ohne das ging die Anti-Confluence-Liste im
  // selben engen Zeilenraster wie Trend/Setup optisch unter.
  separator?: boolean;
}

const FONT_SIZE = 15;
const LINE_HEIGHT = 24;
const PADDING = 16;
const EDGE_MARGIN = 12; // Abstand zum Pane-Rand im 'fixed'-Modus
// Abstand zur letzten Kerze im 'candle'-Modus — Default nur der Fallback, wenn renderTradeSetupCockpit
// ohne candleOffset aufgerufen wird. Konfigurierbar seit Chat 2026-07-19 ("etwas zu eng, am besten
// Abstand konfigurabel machen"), siehe candleOffset-Parameter unten / Dashboard.vue-Dropdown.
const DEFAULT_CANDLE_OFFSET = 24;

// Positions-Toggle DIREKT an der Karte (siehe Chat 2026-07-19: "Ein extra Toggle im TSC selbst
// bitte" — zusätzlich zum bestehenden Toolbar-Dropdown, nicht als Ersatz). Kleines Badge oben
// rechts an der Karte statt die ganze Karte klickbar zu machen, damit spätere Klicks auf die
// Karte selbst (z.B. fürs Chart dahinter) nicht versehentlich die Position umschalten.
const BADGE_RADIUS = 9;
const CARD_RADIUS = 8; // abgerundete Ecken (siehe Chat 2026-07-19), CSS-Pixel
// Extra Vertikalabstand + Trennlinie vor einer Line mit separator=true (siehe "Spricht dagegen"),
// CSS-Pixel — deutlich mehr als der normale LINE_HEIGHT-Zeilenabstand, damit die Sektion optisch
// als eigener Block erkennbar ist statt nur eine weitere Zeile in derselben Liste zu sein.
const SEPARATOR_GAP = 14;

// Karten-Hintergrund/-Rand färben sich nach der M5-Setup-Richtung ein (Long=grün, Short=rot) —
// bewusst NICHT dieselben Farben wie die M5-LS-Linie/OB-Box (tradeSetupLong/-Short, siehe
// buildLines) - das bleibt laut Philip unabhängig ("es kann ein Short Setup geben mit 1h
// uptrend, das ist damit ich es gut einordnen kann"). Stattdessen die im Rest der App schon
// etablierte grün/rot-Semantik (candleUp/candleDown, auch tradeWin/tradeLoss) — Grün/Rot heißt
// hier "Long/Short", nicht "Trend" oder "Erfolg".
// Bei Sperre (state.locked) übersteuert der No-Go-/Anti-Confluence-Rahmen IMMER den sonstigen
// Long/Short-Akzent (siehe unten) — "man darf gerade gar nicht traden" ist wichtiger als "in welche
// Richtung das Setup zeigt". Literal statt cssColor(candleDown), damit spätere Änderungen an der
// Long/Short-Farbsemantik (Grün/Rot=Richtung) diesen eigenständigen Warnzustand nicht mitverschieben.
const NO_GO_COLOR = "rgba(239, 83, 80, 0.95)";
const ANTI_CONFLUENCE_COLOR = "rgba(255, 179, 0, 0.95)";
const LOCKED_ACCENT = { fill: "rgba(239, 83, 80, 0.22)", border: NO_GO_COLOR };

function cardAccentColors(state: CockpitState): { fill: string; border: string } | null {
  if (state.locked) return LOCKED_ACCENT;
  if (!state.m5Setup) return null;
  const key = state.m5Setup.dir === -1 ? "candleUp" : "candleDown";
  return { fill: cssColorScaled(key, 0.16), border: cssColor(key) };
}

// Karte mit abgerundeten Ecken statt ctx.rect (siehe Chat: "Ecken abrunden ;D") — eigener Pfad
// statt ctx.roundRect, weil letzteres in älteren Electron/Chromium-Ständen fehlen kann.
function roundedRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface HitBox {
  left: number;
  top: number;
  width: number;
  height: number;
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
function trendSetupConfirmation(state: CockpitState): { text: string; color: string } | null {
  if (!state.m5Setup || state.h1Trend === "unknown") return null;
  const setupIsLong = state.m5Setup.dir === -1;
  const trendIsUp = state.h1Trend === "uptrend";
  const confirms = setupIsLong === trendIsUp;
  if (confirms && state.h1Weakening) return null;
  return confirms ? { text: " ✓", color: cssColor("candleUp") } : { text: " ✗", color: cssColor("candleDown") };
}

// " (1d 3h alt)" hinter dem Preis, oder "" ohne pivotTime/nowSec (siehe Chat 2026-07-22: "Wochenende
// nicht mitzählen" — businessSecondsBetween lässt Sa/So komplett raus, formatAge macht daraus die
// Kurzform). Eigene Helper-Funktion statt inline, weil beide LQ-Sweep-Zeilen unten (1h + M5) sie
// brauchen.
function ageSuffix(pivotTime: number | undefined, nowSec: number | undefined): string {
  if (pivotTime == null || nowSec == null) return "";
  const age = formatAge(businessSecondsBetween(pivotTime, nowSec));
  return age ? ` (${age} alt)` : "";
}

// Sperr-Banner-Text: bei No-Go dessen eigener Grund, sonst (Sperre allein durch Punktesumme) ein
// generischer Hinweis mit Punktestand — siehe ANTI_CONFLUENCE_THRESHOLD.
function lockedReason(state: CockpitState): string {
  const noGo = state.antiConfluences.find((a) => a.isNoGo);
  if (noGo) return noGo.text;
  const score = state.antiConfluences.reduce((sum, a) => sum + a.weight, 0);
  return `zu viele Anti-Confluences (${score}/${ANTI_CONFLUENCE_THRESHOLD})`;
}

function buildLines(state: CockpitState, formatPrice: (price: number) => string, nowSec: number | undefined): Line[] {
  const lines: Line[] = [{ text: "Trade-Setup-Cockpit", color: "rgba(209, 212, 220, 0.8)", bold: true }];

  if (state.locked) {
    lines.push({ text: `🚫 KEIN TRADE — ${lockedReason(state)}`, color: NO_GO_COLOR, bold: true });
  }

  // Analyse-Inhalt (Trend/LQ-Sweep/M5-Setup) wird bei Sperre abgedunkelt statt entfernt — bleibt
  // als Kontext lesbar, tritt aber sichtbar hinter das Sperr-Banner/die Anti-Confluences zurück
  // (siehe Line.dim, CockpitRenderer.draw).
  let hasContent = false;
  if (state.h1Trend !== "unknown") {
    hasContent = true;
    const color = state.h1Trend === "uptrend" ? cssColor("rangeLow") : cssColor("rangeHigh");
    const suffix = trendSetupConfirmation(state) ?? undefined;
    // Chat 2026-07-25: "der TSC zeigt nicht an, dass der 1h uptrend schwächelt (BOS wurde
    // bestätigt)" — Text-Hinweis direkt an der Trend-Zeile, unabhängig vom (bei Weakening ja
    // unterdrückten) Konfluenz-Haken.
    const weakeningSuffix = state.h1Weakening ? " (schwächelt, BOS)" : "";
    lines.push({ text: `1h ${state.h1Trend}${weakeningSuffix}`, color, suffix, dim: state.locked });
  }
  if (state.h1LqSweep) {
    hasContent = true;
    const age = ageSuffix(state.h1LqSweep.pivotTime, nowSec);
    lines.push({ text: `1h LQ-Sweep @ ${formatPrice(state.h1LqSweep.price)}${age}`, color: cssColor("rangeLqSweep"), dim: state.locked });
  }
  if (state.m5Setup) {
    hasContent = true;
    const color = cssColor(state.m5Setup.dir === -1 ? "tradeSetupLong" : "tradeSetupShort");
    const age = ageSuffix(state.m5Setup.lsPivotTime, nowSec);
    lines.push({ text: `M5 ${state.m5Setup.label} Setup`, color, dim: state.locked });
    lines.push({ text: `  LQ-Sweep @ ${formatPrice(state.m5Setup.lsPrice)}${age}`, color, dim: state.locked });
    lines.push({ text: `  M5-OB ${formatPrice(state.m5Setup.obBottom)}–${formatPrice(state.m5Setup.obTop)}`, color, dim: state.locked });
  }
  if (!hasContent) {
    lines.push({ text: "keine aktive Analyse", color: "rgba(120, 123, 134, 0.9)", dim: state.locked });
  }

  // "Spricht dagegen"-Sektion NIE abgedunkelt, auch nicht bei Sperre — das ist der Teil, der gerade
  // am wichtigsten zu lesen ist (siehe Chat 2026-07-26).
  if (state.antiConfluences.length > 0) {
    lines.push({ text: "Spricht dagegen:", color: "rgba(209, 212, 220, 0.8)", bold: true, separator: true });
    for (const ac of state.antiConfluences) {
      const suffix = ac.isNoGo ? " (No-Go)" : ` (${ac.weight})`;
      lines.push({ text: `  ${ac.text}${suffix}`, color: ac.isNoGo ? NO_GO_COLOR : ANTI_CONFLUENCE_COLOR });
    }
  }
  return lines;
}

class CockpitRenderer {
  private _mode: "fixed" | "candle";
  private _point: { x: number | null; y: number | null };
  private _lines: Line[];
  private _primitive: TradeSetupCockpitPrimitive;
  private _candleOffset: number;
  private _accent: { fill: string; border: string } | null;

  constructor(
    mode: "fixed" | "candle",
    point: { x: number | null; y: number | null },
    lines: Line[],
    primitive: TradeSetupCockpitPrimitive,
    candleOffset: number,
    accent: { fill: string; border: string } | null,
  ) {
    this._mode = mode;
    this._point = point;
    this._lines = lines;
    this._primitive = primitive;
    this._candleOffset = candleOffset;
    this._accent = accent;
  }

  draw(target: any) {
    if (this._lines.length === 0 || (this._mode === "candle" && (this._point.x === null || this._point.y === null))) {
      this._primitive._hitBox = null;
      return;
    }

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const fontSize = Math.round(FONT_SIZE * scope.verticalPixelRatio);
      const lineHeight = Math.round(LINE_HEIGHT * scope.verticalPixelRatio);
      const padding = Math.round(PADDING * scope.horizontalPixelRatio);
      const fontFor = (bold?: boolean) => `${bold ? "bold " : ""}${fontSize}px sans-serif`;
      ctx.font = fontFor(false);

      let maxWidth = 0;
      for (const line of this._lines) {
        ctx.font = fontFor(line.bold);
        let width = ctx.measureText(line.text).width;
        if (line.suffix) width += ctx.measureText(line.suffix.text).width;
        maxWidth = Math.max(maxWidth, width);
      }
      const boxWidth = maxWidth + padding * 2;

      // Zeilen-Mittelpunkte relativ zum Inhaltsbeginn (boxTop+padding) vorab berechnen statt eines
      // festen `lineHeight * i` — separator-Zeilen (siehe "Spricht dagegen") bekommen zusätzlich
      // SEPARATOR_GAP Abstand + eine Trennlinie VOR sich, alle anderen bleiben im normalen Raster.
      const gapPx = Math.round(SEPARATOR_GAP * scope.verticalPixelRatio);
      let relCursor = 0;
      const rowCenterOffsets: number[] = [];
      const dividerOffsets: number[] = [];
      for (const line of this._lines) {
        if (line.separator) {
          dividerOffsets.push(relCursor + gapPx / 2);
          relCursor += gapPx;
        }
        rowCenterOffsets.push(relCursor + lineHeight / 2);
        relCursor += lineHeight;
      }
      const boxHeight = relCursor + padding * 2;

      let boxLeft: number;
      let boxTop: number;
      if (this._mode === "fixed") {
        boxLeft = scope.bitmapSize.width - boxWidth - Math.round(EDGE_MARGIN * scope.horizontalPixelRatio);
        boxTop = (scope.bitmapSize.height - boxHeight) / 2;
      } else {
        boxLeft = Math.round((this._point.x as number) * scope.horizontalPixelRatio) + Math.round(this._candleOffset * scope.horizontalPixelRatio);
        boxTop = Math.round((this._point.y as number) * scope.verticalPixelRatio) - boxHeight / 2;
      }

      // Dunkler Grund IMMER zuerst (Textlesbarkeit) — bei aktivem M5-Setup kommt darüber ein
      // grüner/roter Tint + kräftigerer Rand (siehe Chat 2026-07-19: "Long -> grün, Short -> rot,
      // Ecken abrunden"). Ohne Setup bleibt die Karte neutral wie bisher.
      const radius = Math.round(CARD_RADIUS * scope.horizontalPixelRatio);
      roundedRectPath(ctx, boxLeft, boxTop, boxWidth, boxHeight, radius);
      ctx.fillStyle = "rgba(19, 23, 34, 0.92)";
      ctx.fill();
      if (this._accent) {
        roundedRectPath(ctx, boxLeft, boxTop, boxWidth, boxHeight, radius);
        ctx.fillStyle = this._accent.fill;
        ctx.fill();
      }
      roundedRectPath(ctx, boxLeft, boxTop, boxWidth, boxHeight, radius);
      ctx.strokeStyle = this._accent ? this._accent.border : "rgba(120, 123, 134, 0.5)";
      ctx.lineWidth = this._accent ? Math.max(1.5, Math.round(1.5 * scope.horizontalPixelRatio)) : 1;
      ctx.stroke();

      // Trennlinien für separator-Zeilen (siehe "Spricht dagegen") — neutrale, dezente Farbe statt
      // an Accent/Setup-Richtung gekoppelt, damit sie in JEDEM Kartenzustand als reine
      // Struktur-/Gliederungslinie lesbar bleibt.
      if (dividerOffsets.length > 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        ctx.lineWidth = Math.max(1, Math.round(scope.horizontalPixelRatio));
        const dividerLeft = boxLeft + padding * 0.6;
        const dividerRight = boxLeft + boxWidth - padding * 0.6;
        for (const offset of dividerOffsets) {
          const y = boxTop + padding + offset;
          ctx.beginPath();
          ctx.moveTo(dividerLeft, y);
          ctx.lineTo(dividerRight, y);
          ctx.stroke();
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      this._lines.forEach((line, i) => {
        // globalAlpha statt die Farbe selbst zu parsen (line.color kommt teils als fertiger
        // rgba()-String aus cssColor, teils als Literal) — einfacher Weg, jede Farbe gleich
        // abzudunkeln, siehe Line.dim.
        ctx.globalAlpha = line.dim ? 0.45 : 1;
        ctx.font = fontFor(line.bold);
        ctx.fillStyle = line.color;
        const x = boxLeft + padding;
        const y = boxTop + padding + rowCenterOffsets[i];
        ctx.fillText(line.text, x, y);
        if (line.suffix) {
          const textWidth = ctx.measureText(line.text).width; // dasselbe Font wie gerade gesetzt
          ctx.fillStyle = line.suffix.color;
          ctx.fillText(line.suffix.text, x + textWidth, y);
        }
      });
      ctx.globalAlpha = 1;

      // Positions-Toggle-Badge, oben rechts an der Karte (siehe Chat: "Ein extra Toggle im TSC
      // selbst"). hitBox wird in CSS-Pixeln (nicht Bitmap-skaliert) gespeichert, weil
      // chart.subscribeClick() (siehe PriceChart.vue) Klickpunkte in CSS-Pixeln liefert.
      const badgeRadius = Math.round(BADGE_RADIUS * scope.horizontalPixelRatio);
      const badgeCenterX = boxLeft + boxWidth - badgeRadius * 0.9;
      const badgeCenterY = boxTop + badgeRadius * 0.9;
      ctx.beginPath();
      ctx.arc(badgeCenterX, badgeCenterY, badgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(41, 98, 255, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(19, 23, 34, 0.9)";
      ctx.lineWidth = Math.max(1, Math.round(scope.horizontalPixelRatio));
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(11 * scope.verticalPixelRatio)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⇄", badgeCenterX, badgeCenterY + Math.round(scope.verticalPixelRatio));

      this._primitive._hitBox = {
        left: (badgeCenterX - badgeRadius) / scope.horizontalPixelRatio,
        top: (badgeCenterY - badgeRadius) / scope.verticalPixelRatio,
        width: (badgeRadius * 2) / scope.horizontalPixelRatio,
        height: (badgeRadius * 2) / scope.verticalPixelRatio,
      };
    });
  }
}

class CockpitPaneView {
  private _source: TradeSetupCockpitPrimitive;
  private _point: { x: number | null; y: number | null };

  constructor(source: TradeSetupCockpitPrimitive) {
    this._source = source;
    this._point = { x: null, y: null };
  }

  update() {
    if (this._source._mode !== "candle" || !this._source._chart || !this._source._series || this._source._candles.length === 0) {
      this._point = { x: null, y: null };
      return;
    }
    const last = this._source._candles[this._source._candles.length - 1];
    this._point = {
      x: this._source._chart.timeScale().timeToCoordinate(last.time),
      y: this._source._series.priceToCoordinate(last.close),
    };
  }

  renderer() {
    return new CockpitRenderer(
      this._source._mode,
      this._point,
      this._source._lines,
      this._source,
      this._source._candleOffset,
      this._source._accent,
    );
  }
}

export class TradeSetupCockpitPrimitive {
  _lines: Line[];
  _mode: "fixed" | "candle";
  _candles: Candle[];
  _candleOffset: number;
  _accent: { fill: string; border: string } | null;
  _paneViews: CockpitPaneView[];
  _chart: any;
  _series: any;
  _hitBox: HitBox | null;

  constructor(
    lines: Line[],
    mode: "fixed" | "candle",
    candles: Candle[],
    candleOffset: number,
    accent: { fill: string; border: string } | null,
  ) {
    this._lines = lines;
    this._mode = mode;
    this._candles = candles;
    this._candleOffset = candleOffset;
    this._accent = accent;
    this._paneViews = [new CockpitPaneView(this)];
    this._chart = null;
    this._series = null;
    this._hitBox = null;
  }

  // Klick-Hittest fürs Positions-Toggle-Badge (siehe CockpitRenderer.draw) — point in CSS-Pixeln,
  // wie von chart.subscribeClick() geliefert (siehe PriceChart.vue).
  hitTestToggle(point: { x: number; y: number }): boolean {
    const box = this._hitBox;
    if (!box) return false;
    return point.x >= box.left && point.x <= box.left + box.width && point.y >= box.top && point.y <= box.top + box.height;
  }

  attached({ chart, series, requestUpdate }: { chart: any; series: any; requestUpdate: () => void }) {
    this._chart = chart;
    this._series = series;
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

// Ersetzt existingPrimitives komplett (siehe renderMarketStructureAnalysis-Vorbild). state=null -> nur
// aufräumen, keine Karte. mode: 'fixed' (Default) oder 'candle', siehe oben. candleOffset nur im
// 'candle'-Modus relevant, siehe DEFAULT_CANDLE_OFFSET.
export function renderTradeSetupCockpit(
  series: any,
  state: CockpitState | null,
  existingPrimitives: any[],
  candles: Candle[],
  {
    mode = "fixed",
    formatPrice = (p: number) => String(p),
    candleOffset = DEFAULT_CANDLE_OFFSET,
    nowSec = undefined,
  }: { mode?: "fixed" | "candle"; formatPrice?: (price: number) => string; candleOffset?: number; nowSec?: number } = {},
) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!state) return;

  const lines = buildLines(state, formatPrice, nowSec);
  const accent = cardAccentColors(state);
  const primitive = new TradeSetupCockpitPrimitive(lines, mode, candles, candleOffset, accent);
  series.attachPrimitive(primitive);
  existingPrimitives.push(primitive);
}
