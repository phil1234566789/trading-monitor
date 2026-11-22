// Tick/Anzeige und Strategieabstände sind getrennt: Gold-Schwellen stammen aus dem September-Test.
// 15M-Gold = 1 Forex-Pip x strategyScale (wie 15M-Forex), noch nicht gemessen.
// Forex-FVG-Mindestgrößen in Pip: einzige Quelle für alle drei OB-Erkennungskopien und über obMinimum für jeden
// Aufrufer (Chart, ob_zones, Alarme, DOB, MCP). Ein Aufrufer mit eigener Schwelle wich still vom Chart ab (DOB-POI
// lief mit der 0,05-%-Schwelle). Herleitung der Werte: Kommentare in src/orderBlockDetection.js.
export const FOREX_MIN_FVG_PIPS = { '1m': 1, '3m': 1, '5m': 0.4, '15M': 1, '1H': 3, '4H': 4 };
const FOREX_PIP = 0.0001;
// obMinimum nur für HTF: M1/M5 bleiben null, weil obMinimum(…,'5m') in Konfig-Fingerprints steht (setup1Configuration,
// TS2 m5OrderBlockMinGap); der Erkennungs-Default liest dieselbe Tabelle, die Schwelle ist also identisch.
const FOREX_MIN_FVG = Object.fromEntries(['15M', '1H', '4H'].map(tf => [tf, FOREX_MIN_FVG_PIPS[tf] * FOREX_PIP]));

export function instrumentConfig(symbol) {
  return symbol === 'XAUUSD'
    ? { precision: 2, tick: 0.01, pip: 0.01, strategyScale: 15000,
        minFvg: { '5m': 0, '15M': 1.5, '1H': 2.53, '4H': 6.19 }, dobMaxPositiveZoneGap: 2,
        // POI (DOB-Setup v1): max. Abstand OB1 ↔ H1/H4-Zone in H1-ATR, gemessen nur für XAU 2026 (Philip, Q16).
        dobPoiMaxAtr: 1.5 }
    : { precision: 5, tick: 0.00001, pip: FOREX_PIP, strategyScale: 1, minFvg: FOREX_MIN_FVG, dobMaxPositiveZoneGap: null,
        // Je Forex-Paar eigens gemessen (analysis/dob-setup/source-g-<paar>-2026.json, Plateau mit Retest): GBP 0,8–1,1, EUR 0,6–0,9.
        dobPoiMaxAtr: { GBPUSD: 1, EURUSD: 0.8 }[symbol] ?? null };
}

export function strategyDistance(forexPriceDistance, symbol) {
  return forexPriceDistance * instrumentConfig(symbol).strategyScale;
}

export function obMinimum(symbol, timeframe) {
  return instrumentConfig(symbol).minFvg[timeframe] ?? null;
}
