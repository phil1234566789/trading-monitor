import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { createDealingRange, deleteDealingRange, fetchActiveTscRangeId, fetchDealingRangeCockpit } from "../db.ts";
import { findTargetCandidates } from "../findTargetCandidates.js";
import { findAntiConfluenceCandidates } from "../findAntiConfluenceCandidates.js";
import { logDecision } from "../stateMachineLog.ts";
import { berlinDateStrFor } from "../berlinTime.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const INSTRUMENT = z.enum(["GBPUSD", "EURUSD"]);
const DIRECTION = z.enum(["long", "short"]);

// TSC-über-MCP + find_targets (Chat 2026-08-27, Philip: "jetzt bereite bitte alles so vor, dass
// Lana auch: zugriff zur find target algo hat, den TSC bedienen kann"). Das TSC (Trade-Setup-
// Cockpit) ist die Analyse-Phase VOR einem echten Trade — eine dealing_range ohne trade_positions-
// Zeile (siehe fetchActiveTscRangeId in db.ts). Bestätigungen/Targets auf einer TSC-Range laufen
// über die BESTEHENDEN add_trade_confirmation/add_trade_target-Tools (level='range', id=die hier
// zurückgegebene/angelegte dealing_range-id) — kein separates Tool dafür nötig, nur die drei
// fehlenden Bausteine (anlegen/lesen/löschen einer reinen Idee ohne Ausführung) fehlten bisher.
export function registerTscTools(server: McpServer) {
  server.registerTool(
    "create_dealing_range",
    {
      title: "TSC: Dealing-Range-Idee anlegen",
      description:
        "Legt eine neue dealing_range OHNE trade_positions-Zeile an — der Start einer TSC-Analyse " +
        "(Philip nimmt Ideen oft manuell über den TSC an, bevor überhaupt ein Entry feststeht). " +
        "direction sollte von der ersten OB-Bestätigung kommen, die danach per add_trade_confirmation " +
        "(kind='ob', obDirection=...) hinzugefügt wird — die OB ist bärisch oder bullisch, das " +
        "entscheidet die Richtung, nicht ein bloßer Sweep. Bestätigungen/Targets danach über " +
        "add_trade_confirmation/add_trade_target mit level='range' und der hier zurückgegebenen id " +
        "hinzufügen. Sobald ein echter Entry feststeht, übernimmt add_trade_position diese Range in " +
        "eine Ausführung — create_dealing_range NICHT ein zweites Mal für dieselbe Idee aufrufen.",
      inputSchema: {
        instrument: INSTRUMENT,
        direction: DIRECTION,
      },
    },
    async ({ instrument, direction }) => {
      const result = await createDealingRange(instrument, direction);
      const sec = Math.floor(Date.now() / 1000);
      void logDecision({
        instrument,
        dateStr: berlinDateStrFor(sec),
        sec,
        step: 5,
        tool: "create_dealing_range",
        decision: "dealing_range_created",
        result,
        message: `direction=${direction}`,
      });
      return json(result);
    },
  );

  server.registerTool(
    "delete_dealing_range",
    {
      title: "TSC: Dealing-Range-Idee verwerfen",
      description:
        "Löscht eine dealing_range wieder (TSC-Reset, z.B. wenn eine Analyse verworfen wird) — " +
        "trade_evidence/trade_targets hängen per on-delete-cascade mit dran, werden also " +
        "automatisch mitgelöscht. Nur sinnvoll, solange die Range noch keine trade_positions-Zeile " +
        "hat (siehe get_tsc_range) — eine bereits ausgeführte Idee NICHT über dieses Tool löschen.",
      inputSchema: {
        id: z.number().int(),
      },
    },
    async ({ id }) => json(await deleteDealingRange(id)),
  );

  server.registerTool(
    "get_tsc_range",
    {
      title: "TSC: Aktive Dealing-Range-Idee lesen",
      description:
        "Liefert die aktuell offene TSC-Idee für ein Instrument (die zuletzt angelegte dealing_range " +
        "OHNE trade_positions-Zeile, siehe create_dealing_range) samt ihrer range-level " +
        "Bestätigungen/Targets — oder null, wenn gerade keine offene Idee existiert (entweder noch " +
        "keine angelegt, oder die letzte wurde bereits per add_trade_position in einen Trade " +
        "überführt). get_journal sieht NUR Ranges MIT trade_positions-Zeile — eine reine TSC-Idee " +
        "taucht dort nicht auf, dieses Tool ist die einzige Lese-Brücke dafür.",
      inputSchema: {
        instrument: INSTRUMENT,
      },
    },
    async ({ instrument }) => {
      const id = await fetchActiveTscRangeId(instrument);
      if (id == null) return json(null);
      return json(await fetchDealingRangeCockpit(id));
    },
  );

  server.registerTool(
    "find_targets",
    {
      title: "Target-Kandidaten finden",
      description:
        "Liefert die nächstgelegenen Target-Kandidaten (Liquiditäts-Level + OB-Kanten, jeweils M5 " +
        "live + persistierte 1H/4H) für ein Instrument+Richtung, sortiert nach Preis-Distanz — " +
        "dieselbe Auswahl-Logik wie der TSC-Zielauswahl-Dialog im Chart. WICHTIG: jedes von dir " +
        "bestimmte Target MUSS einer dieser Kandidaten sein (price bei liquidityCandidates, " +
        "targetPrice bei obCandidates) — nicht eigenständig einen Preis außerhalb dieser Liste " +
        "wählen. tooFar markiert (nicht filtert) Kandidaten über 50 Pips Distanz zum aktuellen " +
        "Preis — ungewöhnlich, aber sichtbar bleibend. currentTimeSec optional für einen Replay-" +
        "Zeitpunkt (Default: jetzt, wie get_data_export's replayUntilSec).",
      inputSchema: {
        instrument: INSTRUMENT,
        direction: DIRECTION,
        currentTimeSec: z.number().int().optional().describe("Unix-Sekunden, Default: jetzt"),
      },
    },
    async (args) => json(await findTargetCandidates(args)),
  );

  server.registerTool(
    "find_anti_confluences",
    {
      title: "Anti-Confluence-Kandidaten finden",
      description:
        "Liefert Kandidaten für Dinge, die GEGEN eine Dealing-Range-Idee sprechen (Anti-Confluences) " +
        "— analog find_targets, aber für die Gegenrichtung. Zone = tiefstes Short-Target bis " +
        "aktueller Preis (bzw. aktueller Preis bis höchstes Long-Target) — zoneBoundPrice ist die " +
        "ferne Kante dieser Zone (aus den bereits per add_trade_target gesetzten Targets der Range, " +
        "siehe get_tsc_range: nimm dort das preislich extremste Target). Liefert 4 Kandidatenlisten: " +
        "obCandidates (gegenläufige — bullische bei Short, bärische bei Long — OBs in der Zone, " +
        "offen ODER bereits berührt-aber-gehalten, siehe held-Flag), sweepCandidates (gegenläufige " +
        "LQ-Sweeps in der Zone), divergenceCandidates (gegenläufige RSI-Divergenz in der Zone), " +
        "invalidationObCandidates (unberührte gegenläufige OBs knapp jenseits der Invalidierung, " +
        "max 10 Pips — nur befüllt, wenn invalidation mitgegeben wird). WICHTIG: jede per " +
        "add_trade_confirmation (category='anti_confluence') gespeicherte Anti-Confluence MUSS " +
        "einer dieser Kandidaten sein, nicht eigenständig einen Preis/ein Objekt außerhalb dieser " +
        "Listen wählen. currentTimeSec optional für einen Replay-Zeitpunkt (Default: jetzt, wie " +
        "get_data_export's replayUntilSec).",
      inputSchema: {
        instrument: INSTRUMENT,
        direction: DIRECTION,
        zoneBoundPrice: z.number().describe("Ferne Kante der Zone: tiefstes Short-Target bzw. höchstes Long-Target"),
        invalidation: z.number().optional().describe("Für invalidationObCandidates — ohne diesen Parameter bleibt die Liste leer"),
        currentTimeSec: z.number().int().optional().describe("Unix-Sekunden, Default: jetzt"),
      },
    },
    async (args) => json(await findAntiConfluenceCandidates(args)),
  );
}
