// Reine Order-Block-Erkennung, extrahiert aus orderBlocks.js (Chat 2026-08-02) — bewusst OHNE
// jeden Browser-Import, damit dieses Modul auch außerhalb des Browsers (Node, mcp-server) direkt
// importierbar ist, ohne chartColors.js/chartZoom.js/chartTimeUtils.js (localStorage/
// import.meta.env) mitzuschleppen. Gleicher Schnitt wie bei liquidity.js → liquidityDetection.js
// (siehe dort/CLAUDE.md "MCP-Server") — orderBlocks.js selbst importiert detectOrderBlocks jetzt
// von hier und re-exportiert es, damit sich an dessen öffentlicher API nichts ändert.
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
// einfach an die Timeframe gehängt wie bei LOWER_TF_LABELS, sondern über ein explizites isForex-Flag
// (historisch: musste früher auch für BTCs ganz anderes Kursniveau unterscheidbar bleiben, siehe
// Git-Historie — heute läuft ausschließlich Forex durch diese Funktion, das Flag bleibt trotzdem
// explizit statt aus der Timeframe abgeleitet, da eine zukünftige Nicht-Forex-Instrument-Zone sonst
// stillschweigend ein für sie bedeutungsloses Pip-Minimum bekäme).
const HTF_FOREX_LABELS = new Set(["1H", "4H"]);
const HTF_FOREX_MIN_GAP_PIPS = { "1H": 1.5, "4H": 8 }; // 1H von 4 auf 1.5 gesenkt (Bug-Report Philip 2026-08-11: eine 1,5-Pip-1H-FVG bei GBPUSD am 10.08. 07:00 wurde vom alten 4-Pip-Minimum verschluckt)

// Bug-Report Philip 2026-08-11, direkt im Anschluss an die 1,5-Pip-Absenkung oben: genau die Zone,
// die die Absenkung freischalten sollte, blieb trotzdem verschluckt — ihre Gap ist real EXAKT 1,5
// Pip (1.34919 - 1.34904), aber IEEE-754-Rundung liefert 0.00014999999999987246 statt 0.00015, also
// hauchdünn UNTER der ebenfalls float-berechneten Schwelle (1.5 * 0.0001 = 0.00015000000000000001).
// Epsilon statt exaktem >=, damit ein Gap, das auf Pip-Genauigkeit exakt der Schwelle entspricht,
// nicht von Rundungsrauschen ins "nicht relevant" kippt.
const GAP_EPSILON = 1e-9;

// FVG-Fenster über 4 Kerzen (c0..c2 + cur): bullisch, wenn cur.low über c1.high liegt (Gap),
// bärisch symmetrisch. Zone = C1-Kante bis zur gegenüberliegenden Kante von C2 (inkl. Wick) — siehe
// Pine-Kommentar "HTF-Modus" für die Herleitung. Gilt unverändert für HTF (15m/1h/4h/1D). Lower-TF
// (M1/M3/M5) erweitert seit Bug-Report Philip 2026-07-29 die NICHT-FVG-anknüpfende Kante zusätzlich
// auf den Extremwert über C1+C2+die Kerze davor — "zu eng, direkt auf der erstbesten Kerzen-Range".
//
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
    const bullRelevant = minGapAbs != null ? bullGap >= minGapAbs - GAP_EPSILON : bullGapPct >= IRRELEVANT_PCT;
    const bearRelevant = minGapAbs != null ? bearGap >= minGapAbs - GAP_EPSILON : bearGapPct >= IRRELEVANT_PCT;

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
