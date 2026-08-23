import { describe, it, expect } from "vitest";
import { cachedCandlesUpTo, safeCompleteUpTo, mergeCandles } from "../src/candleCache.js";
import { REPLAY_LOOKAHEAD_SEC, barSecondsFor } from "../src/timeframes.js";

// Bug-Report Philip 2026-07-19 (#1): M5-Replay auf 08.07.2026 21:00 gestellt, Chart zeigte trotzdem
// nur Kerzen bis 02.07.2026 — der IndexedDB-Cache für GBPUSD:5m hatte ein Loch zwischen einem alten
// Replay-Fenster (endet 02.07.) und einem späteren, disjunkten Live-Fenster (beginnt Mitte Juli).
// Bug-Report Philip 2026-07-19 (#2): "+1 Kerze" im M5-Replay zeigt keine neue Kerze — eine reine
// Gap-Toleranz (frühere Zwischenversion) hätte auch die 5-Minuten-Lücke "neue Kerze einfach noch
// nicht gefetcht" fälschlich als "Cache reicht" durchgewunken. cachedCandlesUpTo verlangt jetzt
// stattdessen ein explizites completeUpTo (nur nach einem echten Fetch gesetzt, siehe
// fetchCandlesCached) statt aus der Kerzen-Lücke selbst zu raten.
function candle(time) {
  return { time, open: 1, high: 1, low: 1, close: 1 };
}

const BAR_SECONDS = 300; // 5m

describe("cachedCandlesUpTo", () => {
  it("returns the cached window when completeUpTo covers effectiveEndSec and depth is sufficient", () => {
    const cached = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const effectiveEndSec = 999 * BAR_SECONDS;

    const result = cachedCandlesUpTo(cached, effectiveEndSec, effectiveEndSec, 1000);
    expect(result).not.toBeNull();
    expect(result.length).toBe(1000);
    expect(result[result.length - 1].time).toBe(effectiveEndSec);
  });

  it("returns null when completeUpTo is null (never actually fetched that far)", () => {
    const cached = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const effectiveEndSec = 999 * BAR_SECONDS;

    const result = cachedCandlesUpTo(cached, null, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });

  it("returns null when effectiveEndSec falls inside a gap between disjoint cache windows, even though a later window happens to exist", () => {
    // Altes Fenster: Kerzen 0..999 (completeUpTo wäre hier korrekt deren letzte Zeit gewesen).
    const oldWindow = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const gapSeconds = 7 * 24 * 3600;
    const newWindowStart = oldWindow[oldWindow.length - 1].time + gapSeconds;
    const newWindow = Array.from({ length: 1000 }, (_, i) => candle(newWindowStart + i * BAR_SECONDS));
    const cached = [...oldWindow, ...newWindow];
    const completeUpTo = oldWindow[oldWindow.length - 1].time; // nur bis hierhin je verifiziert gefetcht

    // Replay-Zeitpunkt liegt genau in der Lücke, kurz vor dem neuen (disjunkten) Fenster.
    const effectiveEndSec = newWindowStart - BAR_SECONDS * 3;

    const result = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });

  it("'+1 Kerze': a single new bar not yet fetched must NOT be served from the stale cache", () => {
    const cached = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const completeUpTo = cached[cached.length - 1].time; // letzter erfolgreicher Fetch endete genau hier
    const effectiveEndSec = completeUpTo + BAR_SECONDS; // ein "+1 Kerze"-Klick weiter

    const result = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });

  it("tolerates a normal forex weekend gap as long as it was actually fetched that far (completeUpTo past it)", () => {
    const fridayClose = 1000 * BAR_SECONDS;
    const weekendGapSeconds = 60 * 3600;
    const before = Array.from({ length: 999 }, (_, i) => candle(i * BAR_SECONDS));
    const cached = [...before, candle(fridayClose)];

    const effectiveEndSec = fridayClose + weekendGapSeconds; // Montagmorgen, echte Marktschließung dazwischen
    const completeUpTo = effectiveEndSec; // dieser genaue Zeitpunkt wurde tatsächlich schon einmal gefetcht

    const result = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, 1000);
    expect(result).not.toBeNull();
    expect(result[result.length - 1].time).toBe(fridayClose);
  });

  it("returns null when the cache doesn't have enough depth even without a gap", () => {
    const cached = Array.from({ length: 500 }, (_, i) => candle(i * BAR_SECONDS));
    const effectiveEndSec = cached[cached.length - 1].time;

    const result = cachedCandlesUpTo(cached, effectiveEndSec, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });

  // Bug-Report Philip 2026-07-29: "+1 Kerze" sprang nach ein paar Klicks unvermittelt auf den
  // echten aktuellen Zeitpunkt. Ursache: ein Cache-Hit schnitt bisher hart bei effectiveEndSec ab,
  // obwohl der ORIGINALE volle Fetch (siehe fetchCandlesCached) den Lookahead-Puffer längst mit-
  // gecacht hatte — PriceChart.vue:nextReplayTime() fand dadurch "keine geladene Kerze mehr" nach
  // dem Replay-Stand und fiel in seinen Weekend-Gap-Fallback, der mangels echter Zukunftskerzen
  // einfach die neuesten ECHTEN Kerzen zurückbekam.
  it("includes the already-cached lookahead beyond effectiveEndSec on a cache hit, capped by completeUpTo", () => {
    const cached = Array.from({ length: 1200 }, (_, i) => candle(i * BAR_SECONDS));
    const completeUpTo = cached[cached.length - 1].time; // kompletter Fetch reichte bis hierhin
    const effectiveEndSec = 999 * BAR_SECONDS; // aktueller Replay-Stand, mitten im gecachten Fenster
    const lookaheadSec = 100 * BAR_SECONDS;

    const result = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, 1000, lookaheadSec);
    expect(result).not.toBeNull();
    // Historie: die letzten 1000 Kerzen bis effectiveEndSec, wie schon ohne Lookahead.
    expect(result.slice(0, 1000)[999].time).toBe(effectiveEndSec);
    // Plus Lookahead: alles zwischen effectiveEndSec (exklusiv) und effectiveEndSec+lookaheadSec.
    expect(result[result.length - 1].time).toBe(effectiveEndSec + lookaheadSec);
  });

  it("caps the returned lookahead at completeUpTo when the cached window doesn't reach effectiveEndSec + lookaheadSec", () => {
    const cached = Array.from({ length: 1050 }, (_, i) => candle(i * BAR_SECONDS));
    const completeUpTo = cached[cached.length - 1].time; // nur 50 Kerzen Lookahead tatsächlich gecacht
    const effectiveEndSec = 999 * BAR_SECONDS;
    const lookaheadSec = 100 * BAR_SECONDS; // mehr angefragt, als der Cache tatsächlich hergibt

    const result = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, 1000, lookaheadSec);
    expect(result).not.toBeNull();
    expect(result[result.length - 1].time).toBe(completeUpTo);
  });
});

// Bug-Report Philip 2026-07-21: fetchCandlesCached setzte completeUpTo bisher IMMER auf den vollen
// angefragten Zeitpunkt, egal wie weit die tatsächliche Antwort reichte — ein Fetch, der aus
// irgendeinem Grund (fehlerhafte Eingabe, eine API-Eigenheit wie cTraders "toTimestamp zählt selbst
// noch als offene Kerze", siehe replayFetchToMs in chartTimeUtils.js) kürzer ausfiel, poisoned den
// Cache dadurch DAUERHAFT (übersteht Reloads, siehe cachedCandlesUpTo oben — completeUpTo ist die
// einzige Quelle der Wahrheit für "reicht der Cache"). safeCompleteUpTo trennt jetzt "eine ECHTE
// Marktschließzeit" (Antwort reicht nur wenig kürzer, bleibt vertrauenswürdig) von "grob falsch/leer"
// (Antwort bricht weit vor dem angefragten Ziel ab, oder gar nicht erst) — Letzteres claimt keine
// Vollständigkeit mehr, damit der NÄCHSTE Aufruf automatisch neu fetcht statt für immer hängen zu bleiben.
describe("safeCompleteUpTo", () => {
  function candleAt(time) {
    return { time, open: 1, high: 1, low: 1, close: 1 };
  }

  it("trusts the full requested end time when the response reaches it exactly", () => {
    const fresh = [candleAt(1000), candleAt(1300), candleAt(1600)];
    expect(safeCompleteUpTo(fresh, 1600)).toBe(1600);
  });

  it("still trusts the full requested end time for a normal weekend-sized gap", () => {
    const fridayClose = 1_000_000;
    const fresh = [candleAt(fridayClose - 300), candleAt(fridayClose)];
    const mondayMorning = fridayClose + 60 * 3600; // ~60h Wochenend-Lücke
    expect(safeCompleteUpTo(fresh, mondayMorning)).toBe(mondayMorning);
  });

  it("caps completeUpTo at the actual last candle when the response falls far short of the target (grober Ausreißer)", () => {
    const fresh = [candleAt(1000), candleAt(1300)];
    const requestedEnd = 1300 + 10 * 24 * 3600; // 10 Tage weiter als tatsächlich geliefert
    expect(safeCompleteUpTo(fresh, requestedEnd)).toBe(1300);
  });

  it("claims no completeness at all for a completely empty response", () => {
    expect(safeCompleteUpTo([], 999_999)).toBeNull();
  });
});

// Chat 2026-07-23: 429 beim Replay-Klicken, weil der alte 4h-Lookahead bei M5/1H-Ansichten viel zu
// knapp war (jeder ~4. "+1 Kerze"-Klick im 1h-Chart löste einen Refetch aus). REPLAY_LOOKAHEAD_SEC
// ist jetzt aus 2500 M5-Kerzen abgeleitet (2500 Historie + 2500 Lookahead = 5000, Twelve Datas
// Maximum pro Request) — dieselbe Sekundenzahl ergibt für andere Timeframes automatisch die dazu
// passende Kerzenzahl, ohne dass jede Timeframe ihren eigenen Wert braucht (siehe timeframes.js).
describe("REPLAY_LOOKAHEAD_SEC (timeframes.js): abgeleitete Kerzenzahl je Timeframe", () => {
  it("entspricht exakt 2500 M5-Kerzen (die Grundlage, aus der der Wert abgeleitet wurde)", () => {
    const lookaheadBars = Math.ceil(REPLAY_LOOKAHEAD_SEC / barSecondsFor("5m"));
    expect(lookaheadBars).toBe(2500);
  });

  it("ergibt für 1h automatisch ~209 Kerzen Vorausschau, synchron zum selben Zeitfenster wie M5", () => {
    const lookaheadBars = Math.ceil(REPLAY_LOOKAHEAD_SEC / barSecondsFor("1h"));
    expect(lookaheadBars).toBe(209);
  });

  it("2500 Historie + 2500 Lookahead bleiben bei M5 unter Twelve Datas 5000er-Request-Limit", () => {
    const TRADE_SETUP_M5_CANDLE_COUNT = 2500; // siehe PriceChart.vue, hier nur zur Dokumentation der Invariante
    const lookaheadBars = Math.ceil(REPLAY_LOOKAHEAD_SEC / barSecondsFor("5m"));
    expect(TRADE_SETUP_M5_CANDLE_COUNT + lookaheadBars).toBeLessThanOrEqual(5000);
  });
});

// Chat 2026-07-23 (Frage Philip: "wenn ich ein zweites mal im Replaymodus nachgeladen werden muss,
// dann werden natürlich [ein weiteres Lookahead-Fenster] VORNE dran gehängt. Die historischen
// Kerzen sind ja beim Nachladen schon da.") — verifiziert genau das: eine zweite Fetch-Runde (der
// Cache reicht nicht mehr, siehe cachedCandlesUpTo oben) liefert ein neues Fenster, das direkt ans
// Ende des schon gecachten Fensters anschließt. mergeCandles muss die ALTE Historie unverändert
// (dieselben Objekte/Werte) stehen lassen und nur den neuen Teil anhängen — kein Re-Fetch/Neu-
// Zusammenbauen der Vergangenheit.
describe("mergeCandles: zweites Nachladen hängt nur vorne an, fasst die Historie nicht neu an", () => {
  it("behält das alte (cached) Fenster exakt bei und hängt das neue Fenster nahtlos dahinter", () => {
    // Erstes Fenster (Replay-Einstieg): 5000 M5-Kerzen, 2500 Historie + 2500 Lookahead.
    const firstWindow = Array.from({ length: 5000 }, (_, i) => candle(i * BAR_SECONDS));
    // Zweites Fenster (Cache erschöpft, neuer Fetch): schließt exakt an firstWindows letzte Kerze an,
    // reicht wieder 5000 Kerzen weiter in die Zukunft.
    const secondWindowStart = firstWindow[firstWindow.length - 1].time + BAR_SECONDS;
    const secondWindow = Array.from({ length: 5000 }, (_, i) => candle(secondWindowStart + i * BAR_SECONDS));

    const merged = mergeCandles(firstWindow, secondWindow);

    // Historie unverändert: exakt dieselben Kerzen-Objekte wie im ersten Fenster, keine Neu-Erzeugung.
    expect(merged.slice(0, firstWindow.length)).toEqual(firstWindow);
    // Neuer Teil lückenlos angehängt.
    expect(merged.slice(firstWindow.length)).toEqual(secondWindow);
    expect(merged.length).toBe(firstWindow.length + secondWindow.length);
  });

  it("dedupliziert einen Überlapp am Nahtpunkt statt die Kerzen doppelt zu führen", () => {
    // Realistischer Fall: der neue Fetch bekommt denselben lookaheadSec draufgerechnet wie der alte,
    // sein Fenster kann also ein paar Kerzen mit dem Ende des alten Fensters überlappen.
    const firstWindow = Array.from({ length: 5000 }, (_, i) => candle(i * BAR_SECONDS));
    const overlapBars = 10;
    const secondWindowStart = firstWindow[firstWindow.length - 1 - overlapBars].time;
    const secondWindow = Array.from({ length: 5000 }, (_, i) => candle(secondWindowStart + i * BAR_SECONDS));

    const merged = mergeCandles(firstWindow, secondWindow);

    // Keine doppelten Zeitstempel im Ergebnis.
    const times = merged.map((c) => c.time);
    expect(new Set(times).size).toBe(times.length);
    // Historie VOR dem Überlapp bleibt unverändert erhalten.
    expect(merged.slice(0, firstWindow.length - overlapBars)).toEqual(firstWindow.slice(0, firstWindow.length - overlapBars));
  });

  // Bug-Report Philip 2026-08-23: GBPUSD 1H zeigte eine 12-Tage-Lücke mitten in der Historie,
  // obwohl das Archiv für genau diesen Zeitraum lückenlos Kerzen hatte — Ursache war ein `fresh`-
  // Fetch, der INNERHALB seines eigenen [start,end]-Fensters selbst eine Lücke hatte (z.B. ein
  // Live-Fetch, der genau in diesem Bereich unvollständig war). Die alte before/after-Grenzfilterung
  // verwarf dabei jede gecachte Kerze in diesem Fenster, unabhängig davon, ob `fresh` an genau
  // dieser Stelle überhaupt etwas mitbrachte.
  it("behält eine gecachte Kerze, die innerhalb von fresh's Fenster liegt, aber dort selbst fehlt (fresh hat eine eigene Lücke)", () => {
    const cached = Array.from({ length: 20 }, (_, i) => candle(i * BAR_SECONDS)); // 0..19*BAR_SECONDS, lückenlos
    // fresh deckt nominell dasselbe Gesamtfenster ab, hat aber selbst eine Lücke von Index 5 bis 14
    // (Kerzen 5..14 fehlen einfach, wie bei einem unvollständigen Live-Fetch).
    const fresh = [...Array.from({ length: 5 }, (_, i) => candle(i * BAR_SECONDS)), ...Array.from({ length: 5 }, (_, i) => candle((15 + i) * BAR_SECONDS))];

    const merged = mergeCandles(cached, fresh);

    // Lückenlos von 0 bis 19*BAR_SECONDS — die alten gecachten Kerzen 5..14 füllen fresh's eigene Lücke.
    const times = merged.map((c) => c.time);
    expect(times).toEqual(Array.from({ length: 20 }, (_, i) => i * BAR_SECONDS));
  });
});
