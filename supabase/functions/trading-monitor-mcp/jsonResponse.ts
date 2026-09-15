// Die EINE Serialisierungsstelle jeder Tool-Antwort: hängt an jedes rohe Unix-Sekunden-Feld
// automatisch einen Berlin-Zwilling (pivotTime -> pivotAt, sourceTimeSec -> sourceAt, sec -> at).
//
// Grund (Vorfall 06.09.2026, erneut 15.09.2026): Git Bash in Lanas Ausführungsumgebung hat keine
// Europe/Berlin-Zeitzonendaten — `TZ=Europe/Berlin date` fällt dort STILL auf UTC zurück, ohne
// Fehler. Eine Handumrechnung liegt deshalb nicht gelegentlich, sondern systematisch 1-2h daneben.
// tools/getLoopState.ts setzt diese Regel seit 06.09. für sein eigenes Tool um; hier gilt sie für
// alle, auch für künftig neu dazukommende.
import { berlinDateTimeStrFor } from "./berlinTime.ts";

// Trennt echte Zeitstempel von Dauer-Werten in derselben Sekunden-Einheit (businessSeconds & Co.,
// um Größenordnungen kleiner) — ohne diese Schranke bekäme eine Dauer einen Datums-Zwilling aus
// dem Jahr 1970.
const PLAUSIBLE_MIN = 1_500_000_000;
const PLAUSIBLE_MAX = 4_000_000_000;

// `time` (Kerzen) fehlt hier bewusst: eine Kerzenreihe hat bis zu mehrere hundert Einträge, deren
// Zeitachse nur numerisch verglichen, nie benannt wird — ein Zwilling pro Kerze wäre reiner Ballast.
// Stämme, die selbst auf "at" enden (atSec, knownAtSec), bekommen keinen doppelten Suffix.
function berlinTwinKey(key: string): string | null {
  if (key === "sec") return "at";
  const match = key.match(/^(.+?)(?:TimeSec|Time|Sec)$/);
  if (!match) return null;
  const stem = match[1];
  return /[Aa]t$/.test(stem) ? stem : `${stem}At`;
}

export function withBerlinTimes<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => withBerlinTimes(v)) as unknown as T;
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(source)) {
    out[key] = withBerlinTimes(val);
    const twin = berlinTwinKey(key);
    // Ein bereits vorhandenes Feld gewinnt (asOf: {sec, at} bringt seinen Zwilling selbst mit).
    if (twin && !(twin in source) && typeof val === "number" && val >= PLAUSIBLE_MIN && val <= PLAUSIBLE_MAX) {
      out[twin] = berlinDateTimeStrFor(val);
    }
  }
  return out as T;
}

export function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(withBerlinTimes(data), null, 2) }] };
}
