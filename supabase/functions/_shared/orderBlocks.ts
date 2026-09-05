// Portiert aus src/orderBlocks.js (detectOrderBlocks) für die Deno-Edge-Function-Laufzeit.
// Reine Erkennungslogik, keine Chart-/Rendering-Teile — bei Änderungen an der Zonen-
// Erkennung in src/orderBlocks.js diese Kopie mitziehen.
//
// ACHTUNG DRITTE KOPIE (Bug-Report Philip 2026-09-05, beim Fix hier zunächst übersehen): es
// existiert noch eine unabhängige, untypisierte Kopie in
// supabase/functions/trading-monitor-mcp/orderBlockDetection.js (von dataExport.ts/
// findTargetCandidates.js/backfillObZones.ts genutzt, da poi-watcher/tradeSetup.ts hier aus
// _shared importieren, aber diese Tools nicht). Bei Änderungen an der Erkennungslogik selbst
// IMMER ALLE DREI Kopien nachziehen (src/orderBlockDetection.js, diese Datei, die MCP-lokale).
const IRRELEVANT_PCT = 0.05;
const WEAK_PCT = 0.15;

// Lower-TF-Pip-Minimum aus src/orderBlocks.js portiert (Bug-Report Philip 2026-07-29: "egal
// welcher M5 OB wo in welcher Code-Stelle von uns, sollten alle dieselbe Erkennungslogik haben")
// — vorher hatte diese Backend-Kopie GAR keine Lower-TF-Sonderbehandlung (nur die für M5 viel zu
// grobe Prozent-Schwelle IRRELEVANT_PCT, ~6-7 Pip auf GBPUSD/EURUSD), weil poi-watchers eigene
// OB-Zonen-Erkennung (index.ts) nur auf 4H/1H läuft und diesen Pfad nie mit "5m" aufruft — jetzt
// aber auch von detectSetupObs (tradeSetup.ts) für M5 genutzt. Bei Änderungen hier IMMER auch
// src/orderBlocks.js nachziehen (und umgekehrt).
const LOWER_TF_LABELS = new Set(["1m", "3m", "5m"]);
const LOWER_TF_MIN_GAP_PIPS: Record<string, number> = { "1m": 1, "3m": 1, "5m": 0.5 };
const PIP_SIZE = 0.0001; // gilt für beide unterstützten FX-Paare (GBPUSD/EURUSD)

// HTF (1H/4H) Pip-Minimum NUR für Forex (Bug-Report Philip 2026-07-30: eine 4,5-Pip-1H-FVG bei
// EURUSD wurde von der 0,05%-Prozent-Schwelle verschluckt, ~5,7 Pip bei diesem Kurs nötig) — nicht
// einfach an die Timeframe gehängt wie bei LOWER_TF_LABELS, sondern über ein explizites isForex-
// Flag (Default true, da index.ts inzwischen ausschließlich Forex-Instrumente verarbeitet). Siehe
// src/orderBlocks.js.
const HTF_FOREX_LABELS = new Set(["1H", "4H"]);
const HTF_FOREX_MIN_GAP_PIPS: Record<string, number> = { "1H": 1.5, "4H": 8 }; // 1H von 4 auf 1.5 gesenkt, siehe src/orderBlockDetection.js

// Float-Rundungs-Epsilon (Bug-Report Philip 2026-08-11), siehe src/orderBlockDetection.js für die
// volle Herleitung: eine Gap, die real exakt der Pip-Schwelle entspricht, kann durch IEEE-754-
// Rundung hauchdünn drunter landen und faelschlich rausfallen.
const GAP_EPSILON = 1e-9;

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Zone {
  top: number;
  bottom: number;
  dir: 1 | -1;
  weak: boolean;
  active: boolean;
  touched: boolean;
  invalidated: boolean;
  // "Retest bestätigt" (Feature Philip 05.09.2026, siehe orderblöcke.md#retest-status) — nur
  // aussagekräftig wenn touched && !invalidated, sonst immer false (offen bzw. ohnehin invalidiert/
  // irrelevant). Bewusst KEIN Alters-Label mehr an OBs (anders als bei Liquidity-Leveln) — sobald
  // retested, zählt eine OB als Confluence unabhängig davon, wie lange der Retest her ist, solange
  // der Preis seitdem nicht auf die Gegenseite gewechselt ist (das prüft der jeweilige Aufrufer).
  retested: boolean;
  // Zeitpunkt der retest-bestätigenden Kerze/FVG (null solange retested=false) — separat von
  // endTime (bleibt der Touch-Zeitpunkt), noetig fuer eine korrekte Replay-Rueckrechnung (siehe
  // applyAsOfZones/db.ts, dieselbe Bug-Klasse wie bei touched/invalidated).
  retestedAt: number | null;
  startTime: number;
  endTime: number;
}

// timeframe: TIMEFRAMES-Label (z.B. "5m"/"1H"/"4H") — entscheidet zusammen mit isForex, ob eine
// Pip- oder die Prozent-Mindestgröße gilt. undefined/unbekanntes Label fällt auf HTF-Prozent-
// Verhalten zurück (Altverhalten für die bestehenden 4H/1H-Aufrufer in poi-watcher/index.ts).
// isForex default true — jeder Aufrufer (detectSetupObs, index.ts' 1H/4H-Loop) ist inzwischen
// garantiert Forex-only.
export function detectOrderBlocks(candles: Candle[], timeframe?: string, isForex = true): Zone[] {
  const zones: Zone[] = [];
  const isLowerTf = timeframe != null && LOWER_TF_LABELS.has(timeframe);
  const isHtfForexPip = isForex && timeframe != null && HTF_FOREX_LABELS.has(timeframe);
  const minGapAbs = isLowerTf
    ? LOWER_TF_MIN_GAP_PIPS[timeframe!] * PIP_SIZE
    : isHtfForexPip
      ? HTF_FOREX_MIN_GAP_PIPS[timeframe!] * PIP_SIZE
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
      // Lower-TF (Bug-Report Philip 2026-07-29: "die Kante, die NICHT an die FVG anknüpft, ist zu
      // eng, direkt auf der erstbesten Kerzen-Range") — bezieht die Impuls-Kerze (c2) UND die 2
      // Kerzen davor mit ein (candles[i-3]/c1/c2), nimmt den Extremwert. Die FVG-anknüpfende Kante
      // (top hier) bleibt unverändert. HTF bleibt bei der alten, engen Box. Siehe src/orderBlocks.js.
      const bottom = isLowerTf ? Math.min(candles[i - 3].low, c1.low, c2.low) : c2.low;
      zones.push({
        top: c1.high,
        bottom,
        dir: 1,
        weak: bullGapPct < WEAK_PCT,
        active: true,
        touched: false,
        invalidated: false,
        retested: false,
        retestedAt: null,
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
        retested: false,
        retestedAt: null,
        startTime: c2.time,
        endTime: cur.time,
      });
    }

    for (const z of zones) {
      if (z.invalidated) continue;
      const wasTouched = z.touched; // vor der Pruefung dieser Kerze festhalten

      // Einfache Preisüberschreitung invalidiert (Wick genügt, kein Kerzenschluss nötig) — anders
      // als bei einem LQ-Sweep, wo ein Wick über/unter das Level plus schnelle Rückkehr GERADE FÜR
      // den Sweep spricht (Philip 05.09.2026: eine OB verliert bei jeder Überschreitung sämtliche
      // Relevanz, unabhängig davon ob die Kerze wieder zurückschließt). Siehe src/orderBlockDetection.js.
      if (z.dir === 1 && cur.low < z.bottom) {
        z.invalidated = true;
        z.endTime = cur.time; // Box soll die invalidierende Kerze noch einschliessen
        continue;
      }
      if (z.dir === -1 && cur.high > z.top) {
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

  // "Retest bestätigt" (siehe orderblöcke.md#retest-status, Philip 05.09.2026) — nur für touched &&
  // !invalidated relevant. Lower-TF (M1/M3/M5): eine gleichgerichtete FVG entsteht NACH dem Touch
  // (z.endTime, das bei touched-Zonen auf den Touch-Zeitpunkt eingefroren ist) — die Reaktion hat
  // sich in einem eigenen Impuls entladen. HTF (1H/4H): eine spätere Kerze DERSELBEN Timeframe
  // schließt komplett außerhalb der Zone — kein FVG-Nachweis nötig/üblich auf HTF, ein sauberer
  // Kerzenschluss reicht als Beleg für eine abgeschlossene, entschiedene Reaktion.
  for (const z of zones) {
    if (!z.touched || z.invalidated) continue;
    if (isLowerTf) {
      // zones ist chronologisch (Push-Reihenfolge) — find() liefert damit automatisch die
      // ZEITLICH ERSTE bestätigende FVG, nicht irgendeine spätere.
      const confirming = zones.find((other) => other.dir === z.dir && other.startTime > z.endTime);
      z.retested = confirming != null;
      z.retestedAt = confirming?.startTime ?? null;
    } else {
      const confirming = candles.find((c) => c.time > z.endTime && (c.close < z.bottom || c.close > z.top));
      z.retested = confirming != null;
      z.retestedAt = confirming?.time ?? null;
    }
  }

  return zones;
}

// Prüft eine BEKANNTE Box (z.B. eine einmalig als Snapshot persistierte trade_setups-Zeile, siehe
// poi-watcher/index.ts: "touched/invalidated bleiben hier bewusst auf Default false — dieses
// Referenz-Objekt wird nicht live nachverfolgt") gegen spätere Kerzen auf Invalidierung, ohne
// Zonen komplett neu aus einer Kerzenreihe zu erkennen — dieselbe Wick-Überschreitungs-Regel wie
// oben in detectOrderBlocks. `candles` sollte nur Kerzen NACH Boxentstehung enthalten.
export function isBoxInvalidated(candles: Candle[], box: { top: number; bottom: number }, dir: 1 | -1): boolean {
  return dir === 1 ? candles.some((c) => c.low < box.bottom) : candles.some((c) => c.high > box.top);
}
