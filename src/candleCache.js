import { barSecondsFor } from "./timeframes.js";

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
// 3 (Bug-Report Philip 2026-07-21, zweite Runde: derselbe "Kerzen hören zu früh auf"-Effekt, jetzt
// durch den cTrader-Off-by-one statt den Nachkomma-count verursacht, siehe replayFetchToMs in
// chartTimeUtils.js + safeCompleteUpTo unten) — IndexedDB übersteht einen Browser-Reload, ein
// reiner Code-Fix räumt einen schon kaputt geschriebenen completeUpTo-Stand also NICHT auf. Noch
// ein Versions-Bump für den JETZT schon poisoned Cache; safeCompleteUpTo verhindert ab hier, dass
// dieselbe Bug-Klasse nochmal einen DAUERHAFTEN (reload-festen) Schaden anrichtet.
const DB_VERSION = 3;
const STORE_NAME = "candles";

// Rein defensiv, KEINE reguläre Obergrenze (siehe oben) — 500k Kerzen sind selbst auf M1 fast ein
// Jahr durchgehend Handel; jenseits davon ist mit Sicherheit ein Bug am Werk, kein legitimer Fall.
const SANITY_MAX_CANDLES = 500_000;

let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // Idempotent statt einem einmaligen nackten createObjectStore — ein KÜNFTIGER Versions-Bump
    // (z.B. für einen ähnlichen Reset) liefe sonst gegen einen schon existierenden Store und würde
    // mit "object store already exists" crashen, weil IndexedDB den Store aus der alten Version
    // in die Upgrade-Transaktion mitnimmt, bevor createObjectStore erneut versucht wird.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME);
      db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function cacheKey(symbol, bar) {
  return `${symbol}:${bar}`;
}

// Liefert { candles, completeUpTo } für symbol+bar (candles: [], completeUpTo: null wenn noch
// nichts gecacht ist). completeUpTo siehe cachedCandlesUpTo unten. Wirft nie — IndexedDB kann
// selten fehlschlagen (privater Modus, Quota, deaktiviert); die App läuft dann einfach ohne Cache
// weiter, genau wie vorher.
export async function getCachedCandles(symbol, bar) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(cacheKey(symbol, bar));
      req.onsuccess = () => resolve({ candles: req.result?.candles ?? [], completeUpTo: req.result?.completeUpTo ?? null });
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Kerzen-Cache lesen fehlgeschlagen:", err);
    return { candles: [], completeUpTo: null };
  }
}

async function setCachedCandles(symbol, bar, candles, completeUpTo) {
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
      tx.objectStore(STORE_NAME).put({ key: cacheKey(symbol, bar), candles, completeUpTo });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Kerzen-Cache schreiben fehlgeschlagen:", err);
  }
}

// Vereinigt zwei Kerzen-Arrays (älteste zuerst): `fresh` ist für seinen eigenen Zeitbereich
// [ersteFresh, letzteFresh] immer die Wahrheit (frisch geholt), `cached`-Kerzen STRIKT davor oder
// STRIKT danach bleiben unangetastet erhalten. Bewusst kein simples "alles ab erster frischer Kerze
// ersetzen" (das würde bereits gecachte NEUERE Daten wegwerfen, wenn `fresh` z.B. ein Replay-Fetch
// weit in der Vergangenheit ist, während der Cache schon aktuellere Live-Daten enthält) — die
// Vereinigung hier ist in jede Richtung sicher. Kann dabei bewusst eine LÜCKE zwischen `before` und
// `fresh` (oder `fresh` und `after`) stehen lassen, wenn `fresh` nicht direkt anschließt (siehe
// cachedCandlesUpTo unten, wieso das für den Cache-Hit-Check kein Problem mehr ist).
function mergeCandles(cached, fresh) {
  if (fresh.length === 0) return cached;
  if (cached.length === 0) return fresh;
  const freshStart = fresh[0].time;
  const freshEnd = fresh[fresh.length - 1].time;
  const before = cached.filter((c) => c.time < freshStart);
  const after = cached.filter((c) => c.time > freshEnd);
  return [...before, ...fresh, ...after];
}

// Kern-Entscheidung für den Replay-Cache-Hit (toMs gesetzt): liefert die letzten `targetCount`
// gecachten Kerzen bis effectiveEndSec zurück, wenn wir schon einmal ERFOLGREICH bis mindestens
// effectiveEndSec gefetcht haben (completeUpTo, siehe fetchCandlesCached) — sonst null (dann muss
// fetchCandlesCached frisch fetchen). Als eigene, reine Funktion ausgelagert (statt inline in
// fetchCandlesCached), damit sich das ohne echtes IndexedDB testen lässt.
//
// completeUpTo statt eines Gap-Toleranz-Heuristik (frühere Version, siehe Git-History) — die hatte
// zwei Bugs in entgegengesetzte Richtungen:
// 1. (Bug-Report Philip: M5-Replay auf 08.07. gestellt, Chart zeigte trotzdem nur bis 02.07.) Ein
//    Toleranz-Fenster, das groß genug ist für ein Wochenende (~60h), ist zwangsläufig AUCH groß
//    genug, um ein völlig unrelated, viel älteres Cache-Fenster (z.B. von einem alten Replay-Test)
//    fälschlich als "nah genug" durchzuwinken, wenn mergeCandles zwischen zwei disjunkten Fenstern
//    eine mehrtägige Lücke stehen gelassen hat.
// 2. (Bug-Report Philip: "+1 Kerze" im M5-Replay zeigt keine neue Kerze) Umgekehrt ist selbst eine
//    einzelne, gerade erst freigeschaltete Kerze (5 Minuten Lücke zum letzten gecachten Stand, weil
//    sie schlicht noch nicht gefetcht wurde) locker innerhalb jeder wochenend-tauglichen Toleranz —
//    der Cache wurde also fälschlich als "reicht schon" gewertet, obwohl die neue Kerze fehlte.
// completeUpTo umgeht beide Fälle: es wird NUR nach einem echten, erfolgreichen Replay-Fetch auf
// dessen effectiveEndSec gesetzt (siehe fetchCandlesCached) — cTrader liefert für so einen Fetch
// IMMER die tatsächlichen, autoritativen Kerzen bis genau zu diesem Zeitpunkt (Wochenend-Lücken
// darin sind einfach echte Marktschließzeiten, kein Cache-Problem). Ein späterer Request für einen
// SPÄTEREN Zeitpunkt (wie beim "+1 Kerze"-Klick) liegt dann automatisch über completeUpTo und
// erzwingt korrekt einen neuen Fetch.
export function cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, targetCount) {
  if (completeUpTo == null || effectiveEndSec > completeUpTo) return null;
  const upToEnd = cached.filter((c) => c.time <= effectiveEndSec);
  if (upToEnd.length >= targetCount) return upToEnd.slice(-targetCount);
  return null;
}

// Ersetzt einen vollen fetchFn(symbol, bar, count, toMs)-Aufruf (siehe forexCandles.js/OKX-
// Pendant in PriceChart.vue): liefert `targetCount` Kerzen für symbol+bar bis toMs (bzw. bis
// "jetzt", wenn toMs null ist) — holt dabei aber nur, was seit dem letzten Cache-Stand fehlt:
//
// - Replay (toMs gesetzt) UND wir haben schon einmal erfolgreich bis mindestens diesen Zeitpunkt
//   gefetcht (completeUpTo, siehe cachedCandlesUpTo) UND haben genug Tiefe -> KEIN Fetch, komplett
//   aus dem Cache (der häufigste Fall beim TF-Wechsel während eines Replays, siehe Chat:
//   "TF-Wechsel ist sehr laggy" — Replay ist der App-Default, siehe Dashboard.vue: replayActive
//   Default true).
// - Live (toMs null) UND schon was gecacht -> nur der Teil seit der letzten gecachten Kerze wird
//   frisch geholt (Delta), Rest aus dem Cache. completeUpTo bleibt hier bewusst unangetastet (siehe
//   unten) — der Delta-Fetch deckt bei einer sehr alten Cache-Lücke ggf. nicht bis zur letzten
//   gecachten Kerze zurück und würde sonst fälschlich Vollständigkeit über eine neu entstandene
//   Lücke hinweg behaupten.
// - Sonst (nichts gecacht, oder Cache reicht nicht tief/weit genug zurück) -> voller Fetch wie
//   bisher, Ergebnis wird für künftige Aufrufe gecacht.
// lookaheadSec (nur im Replay-Fall, toMs gesetzt): holt beim tatsächlichen Fetch nicht nur bis
// effectiveEndSec, sondern gleich lookaheadSec weiter in die (Replay-)Zukunft — und entsprechend
// mehr Kerzen, damit die zusätzliche Zukunft nicht die gleiche Menge an ALTER Historie vom
// Fensteranfang verdrängt. Zahlt sich beim wiederholten "+1 Kerze"-Klicken aus (Wunsch Philip
// 2026-07-20: "fetch doch gleich die nächsten 4 Stunden, dann gibt's nur einen Roundtrip") — jeder
// Klick innerhalb des Lookahead-Fensters landet danach direkt im Cache-Hit oben, OHNE dass sich am
// eigentlichen Verhalten etwas ändert: die Anzeige bleibt strikt durch clipReplay() auf den
// ECHTEN replayUntil begrenzt, unabhängig davon, wie weit im Voraus schon gecacht ist. Der
// Hit-Check oben vergleicht bewusst weiterhin gegen den WAHREN (unverschobenen) effectiveEndSec,
// nicht gegen einen pro Aufruf neu verschobenen Wert — sonst würde die "Sicherheitsmarge" nie
// tatsächlich aufgebraucht und jeder Schritt bliebe trotzdem ein Cache-Miss.
export async function fetchCandlesCached(fetchFn, symbol, bar, targetCount, toMs, lookaheadSec = 0) {
  const { candles: cached, completeUpTo } = await getCachedCandles(symbol, bar);
  const effectiveEndSec = toMs != null ? Math.floor(toMs / 1000) : Math.floor(Date.now() / 1000);

  if (toMs != null && cached.length > 0) {
    const hit = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, targetCount);
    if (hit) return hit;
  }

  if (toMs == null && cached.length > 0) {
    const lastCachedTime = cached[cached.length - 1].time;
    const barSeconds = barSecondsFor(bar);
    const elapsedBars = Math.max(1, Math.ceil((effectiveEndSec - lastCachedTime) / barSeconds));
    // +5 Puffer (Wochenend-/Feiertagslücken, Uhrzeit-Ungenauigkeiten). Nach oben durch targetCount
    // gedeckelt: bei einer sehr alten Cache-Lücke (z.B. App seit Wochen nicht offen) ist ein
    // Delta-Fetch ohnehin nicht günstiger als der volle Fetch — dieser Fetch deckt dann aber
    // möglicherweise NICHT bis lastCachedTime zurück, lässt also ggf. eine neue Lücke stehen
    // (siehe mergeCandles) -> completeUpTo bewusst NICHT setzen, sonst würde ein späterer
    // Replay-Request in genau diese neue Lücke fälschlich als "gecacht" durchgehen.
    const catchUpCount = Math.min(elapsedBars + 5, targetCount);
    const fresh = await fetchFn(symbol, bar, catchUpCount, undefined);
    const merged = mergeCandles(cached, fresh);
    await setCachedCandles(symbol, bar, merged, completeUpTo);
    return merged.slice(-targetCount);
  }

  // Nichts gecacht, oder Cache reicht (im Replay-Fall) nicht bis toMs zurück/nicht tief genug ->
  // ganz normal voll fetchen, wie ohne Cache — im Replay-Fall gleich mit Lookahead (siehe oben).
  // `fetchFn` liefert dabei IMMER die tatsächlichen, autoritativen Kerzen bis genau
  // fetchEffectiveEndSec (siehe cachedCandlesUpTo oben) -> completeUpTo entsprechend hochsetzen,
  // im Live-Fall (toMs null) unangetastet lassen (siehe Delta-Zweig oben, dieselbe Begründung:
  // "jetzt" ist kein stabiler Vergleichspunkt für später).
  const lookaheadBars = toMs != null && lookaheadSec > 0 ? Math.ceil(lookaheadSec / barSecondsFor(bar)) : 0;
  const fetchToMs = lookaheadBars > 0 ? toMs + lookaheadSec * 1000 : toMs;
  const fetchEffectiveEndSec = fetchToMs != null ? Math.floor(fetchToMs / 1000) : effectiveEndSec;
  const fresh = await fetchFn(symbol, bar, targetCount + lookaheadBars, fetchToMs);
  const merged = cached.length > 0 ? mergeCandles(cached, fresh) : fresh;
  await setCachedCandles(symbol, bar, merged, toMs != null ? safeCompleteUpTo(fresh, fetchEffectiveEndSec) : completeUpTo);
  return fresh;
}

// Sicherheitsnetz — NICHT gegen den konkreten Bug vom 2026-07-21 selbst (der ist an der Wurzel
// gefixt, siehe replayFetchToMs in chartTimeUtils.js: ein korrekt gebauter Request fällt gar nicht
// erst kurz aus), sondern gegen die Poisoning-MECHANIK, die ihn zweimal reload-fest gemacht hat:
// completeUpTo wurde bisher IMMER auf den vollen angefragten Zeitpunkt gesetzt, komplett unabhängig
// davon, was tatsächlich zurückkam. Ein normaler 1-Bar-Shortfall (z.B. die gerade noch offene
// aktuelle Kerze) ist dabei NICHT von einem Bug zu unterscheiden — beide sehen für diese Funktion
// identisch aus, MAX_ACCEPTABLE_GAP_SEC (4 Tage, deckt lange Wochenenden/Feiertage ab, siehe
// cachedCandlesUpTo-Kommentar oben zu echten Marktschließzeiten) fängt deshalb bewusst nur GROBE
// Ausreißer ab (leere/fast leere Antwort trotz erfolgreichem Request), nicht jeden kleinen
// Rand-Shortfall. Ein leerer fresh-Response claimt gar keine Vollständigkeit mehr — der nächste
// Aufruf fetcht dann automatisch neu, statt für immer auf einem falschen Stand hängen zu bleiben.
const MAX_ACCEPTABLE_GAP_SEC = 4 * 24 * 3600;
export function safeCompleteUpTo(fresh, fetchEffectiveEndSec) {
  const lastFreshTime = fresh.length > 0 ? fresh[fresh.length - 1].time : null;
  if (lastFreshTime == null) return null;
  return fetchEffectiveEndSec - lastFreshTime <= MAX_ACCEPTABLE_GAP_SEC ? fetchEffectiveEndSec : lastFreshTime;
}
