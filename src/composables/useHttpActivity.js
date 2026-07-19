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

// Fehler-Anzeige (Bug-Report Philip 2026-07-19: cTrader-Request blieb beim M5-TF-Wechsel
// minutenlang hängen, ohne dass im UI irgendwas davon zu sehen war — "Fehlermeldungen für alle
// HTTP-Requests, damit ich sehe wenn was schief läuft + dir bessere Fehlermeldungen geben kann").
// Bewusst HIER am selben Patch-Punkt wie das Aktivitäts-Tracking oben, aus demselben Grund: deckt
// automatisch jeden Fetch-Aufruf ab, ohne jede Stelle einzeln anzufassen. Fehler bleiben stehen,
// bis der Nutzer sie per dismissHttpError() explizit wegklickt (siehe App.vue) — KEIN Auto-Timeout,
// weil genau das Ziel ist, Zeit zum Rauskopieren des Fehlertexts zu haben.
const errors = reactive([]); // [{ id, label, message, status, at, count }]
let errorSeq = 0;

function pushError(label, message, status) {
  // Dedupe statt Flut: eine tote Verbindung (wie der cTrader-Hang oben) lässt sonst bei jedem
  // Poll-Versuch ein neues, identisches Banner aufpoppen. Gleiches Label+Message zählt hoch und
  // rückt den Zeitstempel nach vorn, statt ein weiteres Banner zu stapeln.
  const existing = errors.find((e) => e.label === label && e.message === message);
  if (existing) {
    existing.count += 1;
    existing.at = Date.now();
    return;
  }
  errors.push({ id: ++errorSeq, label, message, status: status ?? null, at: Date.now(), count: 1 });
}

export function dismissHttpError(id) {
  const idx = errors.findIndex((e) => e.id === id);
  if (idx !== -1) errors.splice(idx, 1);
}

// Body EINMAL klonen und lesen (der Original-Response bleibt für den eigentlichen Aufrufer
// unangetastet lesbar) — Edge-Functions/Supabase liefern Fehler i.d.R. als {error: "..."} oder
// {message: "..."} JSON (siehe ctrader-candles/index.ts), sonst Klartext oder als letzter Fallback
// der HTTP-Statustext.
async function extractErrorMessage(res) {
  try {
    const text = await res.clone().text();
    try {
      const json = JSON.parse(text);
      if (json?.error) return String(json.error);
      if (json?.message) return String(json.message);
    } catch {
      // kein JSON -> Klartext unten verwenden
    }
    return text || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
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
      const res = await originalFetch(...args);
      if (!res.ok) pushError(label, await extractErrorMessage(res), res.status);
      return res;
    } catch (err) {
      // Netzwerkfehler/Timeout/Abort (z.B. der 20s-AbortSignal in ctraderCandles.js) — hier NUR
      // sichtbar machen, nicht schlucken: rethrow, damit die aufrufende Stelle ihr bestehendes
      // catch/console.error weiterhin wie bisher bekommt.
      pushError(label, err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      const n = (counts.get(label) ?? 1) - 1;
      if (n <= 0) counts.delete(label);
      else counts.set(label, n);
    }
  };
}

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

export function useHttpActivity() {
  const activeLabels = computed(() => [...counts.keys()].sort());
  const isActive = computed(() => counts.size > 0);
  return { activeLabels, isActive, errors };
}
