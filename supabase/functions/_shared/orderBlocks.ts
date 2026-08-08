// Portiert aus src/orderBlocks.js (detectOrderBlocks) für die Deno-Edge-Function-Laufzeit.
// Reine Erkennungslogik, keine Chart-/Rendering-Teile — bei Änderungen an der Zonen-
// Erkennung in src/orderBlocks.js diese Kopie mitziehen.
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
// einfach an die Timeframe gehängt wie bei LOWER_TF_LABELS, weil poi-watcher denselben 1H/4H-Pfad
// AUCH für BTC durchläuft (TIMEFRAMES-Loop in index.ts läuft für okx+ctrader gleichermaßen); ein
// Pip-Minimum wäre bei BTCs Kursniveau (~60k) bedeutungslos. Daher explizites isForex-Flag, das
// index.ts an dieser Stelle mit `cfg.source === "ctrader"` setzt. Siehe src/orderBlocks.js.
const HTF_FOREX_LABELS = new Set(["1H", "4H"]);
const HTF_FOREX_MIN_GAP_PIPS: Record<string, number> = { "1H": 4, "4H": 8 };

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
  startTime: number;
  endTime: number;
}

// timeframe: TIMEFRAMES-Label (z.B. "5m"/"1H"/"4H") — entscheidet zusammen mit isForex, ob eine
// Pip- oder die Prozent-Mindestgröße gilt. undefined/unbekanntes Label fällt auf HTF-Prozent-
// Verhalten zurück (Altverhalten für die bestehenden 4H/1H-Aufrufer in poi-watcher/index.ts).
// isForex default true, weil detectSetupObs (immer "5m", garantiert Forex-only, siehe tradeSetup.ts)
// das Flag nicht mitgibt — nur index.ts' 1H/4H-Loop (BTC+Forex gemeinsam) setzt es explizit.
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
    const bullRelevant = minGapAbs != null ? bullGap >= minGapAbs : bullGapPct >= IRRELEVANT_PCT;
    const bearRelevant = minGapAbs != null ? bearGap >= minGapAbs : bearGapPct >= IRRELEVANT_PCT;

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
