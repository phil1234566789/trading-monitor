// Portiert aus src/orderBlocks.js (detectOrderBlocks) für die Deno-Edge-Function-Laufzeit.
// Reine Erkennungslogik, keine Chart-/Rendering-Teile — bei Änderungen an der Zonen-
// Erkennung in src/orderBlocks.js diese Kopie mitziehen.
const IRRELEVANT_PCT = 0.05;
const WEAK_PCT = 0.15;

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

export function detectOrderBlocks(candles: Candle[]): Zone[] {
  const zones: Zone[] = [];

  for (let i = 3; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const cur = candles[i];
    const refPrice = c1.close;

    const bullGapPct = ((cur.low - c1.high) / refPrice) * 100;
    const bearGapPct = ((c1.low - cur.high) / refPrice) * 100;

    if (bullGapPct >= IRRELEVANT_PCT) {
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
    } else if (bearGapPct >= IRRELEVANT_PCT) {
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
