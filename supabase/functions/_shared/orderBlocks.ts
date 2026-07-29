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

// timeframe: TIMEFRAMES-Label (z.B. "5m"/"1H"/"4H") — entscheidet, ob die Pip- (Lower-TF) oder die
// Prozent-Mindestgröße (HTF) gilt. undefined/unbekanntes Label fällt auf HTF-Verhalten zurück
// (Altverhalten für die bestehenden 4H/1H-Aufrufer in poi-watcher/index.ts).
export function detectOrderBlocks(candles: Candle[], timeframe?: string): Zone[] {
  const zones: Zone[] = [];
  const isLowerTf = timeframe != null && LOWER_TF_LABELS.has(timeframe);
  const minGapAbs = isLowerTf ? LOWER_TF_MIN_GAP_PIPS[timeframe!] * PIP_SIZE : null;

  for (let i = 3; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const cur = candles[i];
    const refPrice = c1.close;

    const bullGap = cur.low - c1.high;
    const bearGap = c1.low - cur.high;
    const bullGapPct = (bullGap / refPrice) * 100;
    const bearGapPct = (bearGap / refPrice) * 100;
    const bullRelevant = isLowerTf ? bullGap >= minGapAbs! : bullGapPct >= IRRELEVANT_PCT;
    const bearRelevant = isLowerTf ? bearGap >= minGapAbs! : bearGapPct >= IRRELEVANT_PCT;

    if (bullRelevant) {
      for (const z of zones) if (z.dir === 1 && z.active) z.active = false;
      zones.push({
        top: c1.high,
        bottom: c2.low,
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
      zones.push({
        top: c2.high,
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
