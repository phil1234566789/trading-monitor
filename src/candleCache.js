// Kerzen-Cache in IndexedDB (siehe Chat 2026-07-20: "cTrader ist das allerteuerste" + "TF-Wechsel
// ist sehr laggy") — abgeschlossene Kerzen ändern sich nie wieder, also lohnt es sich, sie über
// Reloads/TF-Wechsel/zweite Tabs hinweg zu behalten statt bei jedem Laden komplett neu von
// cTrader/OKX zu holen. Nur der potenziell neue/noch offene Teil wird frisch geholt, der Rest kommt
// aus dem Cache (siehe fetchCandlesCached) — funktioniert sowohl im Live-Modus (Delta seit dem
// letzten Fetch) als auch im Replay-Modus (fixer Zeitpunkt in der Vergangenheit, oft komplett aus
// dem Cache bedienbar, siehe unten — Default-Zustand der App ist Replay AN, siehe Dashboard.vue).
// Bewusst KEIN Ablauf/keine Obergrenze für echte Historie (siehe Chat: "keine Obergrenze bauen") —
// nur ein Sanity-Cap gegen einen Bug (z.B. eine Merge-Schleife, die nie terminiert), der den Cache
// unbegrenzt volllaufen lassen würde.

const DB_NAME = "trading-monitor-candles";
const DB_VERSION = 1;
const STORE_NAME = "candles";

// Rein defensiv, KEINE reguläre Obergrenze (siehe oben) — 500k Kerzen sind selbst auf M1 fast ein
// Jahr durchgehend Handel; jenseits davon ist mit Sicherheit ein Bug am Werk, kein legitimer Fall.
const SANITY_MAX_CANDLES = 500_000;

let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function cacheKey(symbol, bar) {
  return `${symbol}:${bar}`;
}

// Liefert die gecachten Kerzen (älteste zuerst) für symbol+bar, oder [] wenn noch nichts gecacht
// ist. Wirft nie — IndexedDB kann selten fehlschlagen (privater Modus, Quota, deaktiviert); die
// App läuft dann einfach ohne Cache weiter, genau wie vorher.
export async function getCachedCandles(symbol, bar) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(cacheKey(symbol, bar));
      req.onsuccess = () => resolve(req.result?.candles ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Kerzen-Cache lesen fehlgeschlagen:", err);
    return [];
  }
}

async function setCachedCandles(symbol, bar, candles) {
  try {
    if (candles.length > SANITY_MAX_CANDLES) {
      console.error(
        `Kerzen-Cache: ${candles.length} Kerzen für ${cacheKey(symbol, bar)} — weit über dem Sanity-Limit ` +
          `(${SANITY_MAX_CANDLES}), Schreiben übersprungen (vermutlich ein Bug statt echter Historie).`,
      );
      return;
    }
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ key: cacheKey(symbol, bar), candles });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Kerzen-Cache schreiben fehlgeschlagen:", err);
  }
}

// Bar-Dauer in Sekunden je TIMEFRAMES-Label (siehe timeframes.js) — bestimmt, wie viele Kerzen
// seit dem letzten Cache-Stand frühestens dazugekommen sein können (siehe fetchCandlesCached).
const BAR_SECONDS = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1D": 86400 };

// Vereinigt zwei Kerzen-Arrays (älteste zuerst): `fresh` ist für seinen eigenen Zeitbereich
// [ersteFresh, letzteFresh] immer die Wahrheit (frisch geholt), `cached`-Kerzen STRIKT davor oder
// STRIKT danach bleiben unangetastet erhalten. Bewusst kein simples "alles ab erster frischer Kerze
// ersetzen" (das würde bereits gecachte NEUERE Daten wegwerfen, wenn `fresh` z.B. ein Replay-Fetch
// weit in der Vergangenheit ist, während der Cache schon aktuellere Live-Daten enthält) — die
// Vereinigung hier ist in jede Richtung sicher.
function mergeCandles(cached, fresh) {
  if (fresh.length === 0) return cached;
  if (cached.length === 0) return fresh;
  const freshStart = fresh[0].time;
  const freshEnd = fresh[fresh.length - 1].time;
  const before = cached.filter((c) => c.time < freshStart);
  const after = cached.filter((c) => c.time > freshEnd);
  return [...before, ...fresh, ...after];
}

// Ersetzt einen vollen fetchFn(symbol, bar, count, toMs)-Aufruf (siehe ctraderCandles.js/OKX-
// Pendant in PriceChart.vue): liefert `targetCount` Kerzen für symbol+bar bis toMs (bzw. bis
// "jetzt", wenn toMs null ist) — holt dabei aber nur, was seit dem letzten Cache-Stand fehlt:
//
// - Replay (toMs gesetzt) UND der Cache reicht schon bis zu diesem fixen Zeitpunkt zurück UND hat
//   genug Tiefe -> KEIN Fetch, komplett aus dem Cache (der häufigste Fall beim TF-Wechsel während
//   eines Replays, siehe Chat: "TF-Wechsel ist sehr laggy" — Replay ist der App-Default, siehe
//   Dashboard.vue: replayActive Default true).
// - Live (toMs null) UND schon was gecacht -> nur der Teil seit der letzten gecachten Kerze wird
//   frisch geholt (Delta), Rest aus dem Cache.
// - Sonst (nichts gecacht, oder Cache reicht nicht tief/weit genug zurück) -> voller Fetch wie
//   bisher, Ergebnis wird für künftige Aufrufe gecacht.
export async function fetchCandlesCached(fetchFn, symbol, bar, targetCount, toMs) {
  const cached = await getCachedCandles(symbol, bar);
  const effectiveEndSec = toMs != null ? Math.floor(toMs / 1000) : Math.floor(Date.now() / 1000);

  if (toMs != null && cached.length > 0) {
    const lastCachedTime = cached[cached.length - 1].time;
    if (lastCachedTime >= effectiveEndSec) {
      const upToEnd = cached.filter((c) => c.time <= effectiveEndSec);
      if (upToEnd.length >= targetCount) return upToEnd.slice(-targetCount);
    }
  }

  if (toMs == null && cached.length > 0) {
    const lastCachedTime = cached[cached.length - 1].time;
    const barSeconds = BAR_SECONDS[bar] ?? 60;
    const elapsedBars = Math.max(1, Math.ceil((effectiveEndSec - lastCachedTime) / barSeconds));
    // +5 Puffer (Wochenend-/Feiertagslücken, Uhrzeit-Ungenauigkeiten). Nach oben durch targetCount
    // gedeckelt: bei einer sehr alten Cache-Lücke (z.B. App seit Wochen nicht offen) ist ein
    // Delta-Fetch ohnehin nicht günstiger als der volle Fetch.
    const catchUpCount = Math.min(elapsedBars + 5, targetCount);
    const fresh = await fetchFn(symbol, bar, catchUpCount, undefined);
    const merged = mergeCandles(cached, fresh);
    await setCachedCandles(symbol, bar, merged);
    return merged.slice(-targetCount);
  }

  // Nichts gecacht, oder Cache reicht (im Replay-Fall) nicht bis toMs zurück/nicht tief genug ->
  // ganz normal voll fetchen, wie ohne Cache — Ergebnis danach für künftige Aufrufe sichern.
  const fresh = await fetchFn(symbol, bar, targetCount, toMs);
  await setCachedCandles(symbol, bar, cached.length > 0 ? mergeCandles(cached, fresh) : fresh);
  return fresh;
}
