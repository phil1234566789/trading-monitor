// Guard für die ISO-Zeitstempel der Trade-Journal-Write-Tools (triggeredAt/exitTime) — pure Logik,
// testbar ohne DB/Deno-Fetches.
//
// Ein Zeitstempel ohne Offset ("2026-09-22T14:30:00") ist mehrdeutig: Philips Uhrzeiten sind
// Europe/Berlin, ein LLM reicht sie regelmäßig als UTC durch — 2h daneben, ohne dass der Call
// scheitert. Bei einem fremden MCP-Client (Grok o.ä.) trägt das Schema die Fachlichkeit allein, es
// gibt kein CLAUDE.md, das die Konvention nachreichen könnte. Deshalb Pflicht statt Bitte.
import { berlinOffsetMinutes } from "../_shared/berlinTime.ts";

// Datum + Uhrzeit + abschließendes Z/±HH:MM. Ein reines Datum ("2026-09-22") fällt bewusst durch:
// ohne Uhrzeit ist es genauso mehrdeutig wie ohne Offset.
const ISO_WITH_OFFSET_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;

export function hasExplicitOffset(value: string): boolean {
  return ISO_WITH_OFFSET_RE.test(value.trim());
}

export function berlinOffsetSuffix(utcMs: number = Date.now()): string {
  const min = berlinOffsetMinutes(utcMs);
  const sign = min < 0 ? "-" : "+";
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function missingOffsetError(value: string, utcMs: number = Date.now()): string {
  return (
    `Zeitstempel "${value}" hat keine Zeitzone. Erwartet wird ein ISO-Wert mit Z oder ±HH:MM ` +
    `(z.B. "2026-09-22T14:30:00${berlinOffsetSuffix(utcMs)}"). Ohne Offset ist unklar, ob eine ` +
    `Berliner oder eine UTC-Uhrzeit gemeint ist — Philips Angaben sind Europe/Berlin, aktuell ` +
    `${berlinOffsetSuffix(utcMs)}. Umrechnen statt raten.`
  );
}
