import { computed, reactive } from "vue";

// Registriert JEDEN `fetch()`-Aufruf der App (Modul-weiter Singleton, wie useStatusBar) —
// einmaliges Patchen von window.fetch statt jede einzelne HTTP-Funktion (ctraderCandles.js,
// cvd.js, PriceChart.vue-OKX-Fetch, alle supabase-js-Queries in poiZones.js/alarmLog.js/
// trades.js/alarmSettings.js/chartColors.js) selbst instrumentieren zu müssen (siehe Chat:
// "Ladeindikator für jede HTTP-Funktion die im Code rausgefeuert wird"). supabase-js nutzt in
// der Browser-Umgebung intern ebenfalls window.fetch (kein eigener HTTP-Client, siehe
// supabaseClient.js: kein custom `fetch` an createClient übergeben) — ein Patch-Punkt deckt
// also wirklich ALLES ab, auch zukünftige Fetch-Aufrufe an neuen Stellen, ohne dass die dort
// extra angebunden werden müssten.
const counts = reactive(new Map()); // Label -> Anzahl gerade laufender Aufrufe mit diesem Label

// Grobe Zuordnung URL -> sprechendes Label, an den tatsächlich genutzten Endpunkten
// festgemacht (siehe ctraderCandles.js, cvd.js, PriceChart.vue, poiZones.js, alarmLog.js,
// trades.js, alarmSettings.js, chartColors.js). Unbekannte Supabase-Tabellen/Hosts fallen auf
// Hostname+Pfad zurück statt zu verschwinden — lieber ein technisches Label als ein
// stillschweigend nicht getrackter Aufruf.
function labelFor(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl, window.location.origin);
  } catch {
    return String(rawUrl);
  }
  const path = u.pathname;

  if (path.includes("/functions/v1/ctrader-candles")) return "cTrader-Kerzen";
  if (u.hostname.endsWith("okx.com")) return "OKX-Kerzen";
  if (u.hostname.endsWith("binance.com")) return "CVD (Binance)";

  const restMatch = path.match(/\/rest\/v1\/([^/?]+)/);
  if (restMatch) {
    const table = restMatch[1];
    const tableLabels = {
      ob_zones: "POI-Zonen",
      liquidity_levels: "Liquiditäts-Level",
      trade_setups: "Trade-Setups",
      signals: "Trades",
      chart_colors: "Farben (DB)",
      alarm_settings: "Alarm-Einstellungen",
    };
    return tableLabels[table] ?? `Supabase (${table})`;
  }

  return `${u.hostname}${path}`;
}

let patched = false;
export function installHttpActivityTracking() {
  if (patched || typeof window === "undefined" || !window.fetch) return;
  patched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = args[0] instanceof Request ? args[0].url : args[0];
    const label = labelFor(url);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    try {
      return await originalFetch(...args);
    } finally {
      const n = (counts.get(label) ?? 1) - 1;
      if (n <= 0) counts.delete(label);
      else counts.set(label, n);
    }
  };
}

export function useHttpActivity() {
  const activeLabels = computed(() => [...counts.keys()].sort());
  const isActive = computed(() => counts.size > 0);
  return { activeLabels, isActive };
}
