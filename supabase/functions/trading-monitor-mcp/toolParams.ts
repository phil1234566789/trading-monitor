// Gemeinsame Schema-Bausteine für die Tool-Signaturen (MCP-Aussenschnittstelle).
//
// Hintergrund (Vorfall 15.09.2026): Derselbe Begriff — "welche Uhrzeit gilt gerade" — hiess in den
// Tools fuenf verschiedene Namen (sec, replayUntilSec, nowSec, currentTimeSec, toSec). Zod strippt
// unbekannte Keys stillschweigend, also fiel ein Aufruf mit dem falschen Namen wortlos auf den
// Default "jetzt" zurueck: aus einem Backtest-Aufruf fuer den 09.09. wurde ein LIVE-Schreibzugriff
// auf den 15.09., der den Tag als "kein Trade" markierte, bevor ueberhaupt gearbeitet wurde.
//
// Philip 15.09.2026: "ich will nur reinschreiben, wie viel Uhr es gerade im Replay ist. Im
// Live-Modus haben wir immer eine aktuelle Live-Uhrzeit, und im Replay-Modus gilt eben die Uhrzeit,
// die im Replay gerade ist." Genau das ist die Semantik: EIN optionaler Parameter, weglassen heisst
// live. Der scheinbare Unterschied zwischen "tu so als waere jetzt X" und "decke nur bis X auf"
// existiert nicht — wenn jetzt X ist, kennt man nichts danach.
//
// Die INTERNEN Parameternamen der Builder-Funktionen bleiben, wie sie sind: dort ist im Kontext der
// jeweiligen Funktion eindeutig, was gemeint ist, und ein Durchbenennen ueber acht Dateien wuerde
// die Verwechslungsgefahr an der Schnittstelle kein Stueck weiter senken.
import { z } from "npm:zod@3.24.1";

export const REPLAY_UNTIL_SEC = z
  .number()
  .int()
  .optional()
  .describe("Unix-Sekunden — welche Uhrzeit gerade gilt. Weglassen = live 'jetzt', angeben = Backtest/Replay-Zeitpunkt.");

// Pflichtvariante fuer die log_*-Tools, die immer zu einem konkreten Analysezeitpunkt gehoeren.
export const REPLAY_UNTIL_SEC_REQUIRED = z
  .number()
  .int()
  .describe("Unix-Sekunden — Analysezeitpunkt, derselbe Wert wie beim zugehoerigen run_*-Aufruf.");

// Riegel gegen den naechsten Vertipper — bewusst NUR an den Tools, die echten State schreiben UND
// einen Live-Default haben. Ohne ihn strippt zod den alten Namen still und der Aufruf trifft
// klammheimlich den heutigen Tag statt des Replay-Tages. Ein rein lesendes Tool liefert im selben
// Fall hoechstens falsche Zahlen, die auffallen — dort waere der Guard nur Ballast.
// z.undefined() statt eines refine(): fehlt der Key, ist der Wert undefined und alles ist gut —
// steht er drin, schlaegt die Validierung fehl. Bewusst KEIN .refine()/.optional()-Konstrukt, das
// erzeugt ein ZodEffects, aus dem das MCP-SDK kein JSON-Schema bauen kann (der Server startet dann
// gar nicht mehr, Fehlerbild: WORKER_ERROR direkt nach dem Deploy).
export function deprecatedTimeParam(alterName: string) {
  return z
    .undefined({
      invalid_type_error:
        `'${alterName}' gibt es nicht mehr — alle Tools nehmen jetzt 'replayUntilSec' ` +
        `(Unix-Sekunden, weglassen = live 'jetzt').`,
    })
    .describe(`Veraltet, nicht mehr benutzen — stattdessen replayUntilSec.`);
}
