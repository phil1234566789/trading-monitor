import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { getSessions } from "../db.ts";
import { berlinOffsetMinutes, berlinDateTimeStrFor } from "../../_shared/berlinTime.ts";
import { sessionOccurrences } from "../../_shared/sessionOccurrences.js";
import { REPLAY_UNTIL_SEC, deprecatedTimeParam } from "../toolParams.ts";
import { json } from "../jsonResponse.ts";

export const SESSION_IMMINENT_MINUTES = 30;
// Wie weit vor/zurück nach Vorkommen gesucht wird — 2 Tage Puffer reicht für jede über Mitternacht
// laufende Session (siehe sessionOccurrences.js), auch die Freitag-23:00-bis-Sonntag-23:00
// Weekend-Gap-Session.
const OCCURRENCE_SEARCH_WINDOW_SEC = 2 * 24 * 3600;

export type SessionWindowStatus = "active" | "imminent";

export interface SessionWindowFact {
  label: string;
  status: SessionWindowStatus;
  startAt: string;
  endAt: string;
  minutesUntilStart?: number;
}

export interface SessionConfigInput {
  label: string | null;
  fromMinutes: number;
  toMinutes: number;
  days: number[] | null;
}

// Pure (nur sessionOccurrences.js + berlinTime.ts, beide dependency-frei) — nowSec statt "jetzt",
// damit Replay/Backtest denselben Code nutzt. Nur die ERSTE passende Occurrence je Session zählt
// (aktiv gewinnt vor bevorstehend, wie in buildSessionContextLookup) — eine Session kann nicht
// gleichzeitig aktiv UND bevorstehend sein.
export function evaluateSessionWindows(nowSec: number, sessions: SessionConfigInput[], imminentMinutes = SESSION_IMMINENT_MINUTES): SessionWindowFact[] {
  const facts: SessionWindowFact[] = [];
  const rangeStartSec = nowSec - OCCURRENCE_SEARCH_WINDOW_SEC;
  const rangeEndSec = nowSec + OCCURRENCE_SEARCH_WINDOW_SEC;
  for (const s of sessions) {
    const occurrences = sessionOccurrences(s.fromMinutes, s.toMinutes, rangeStartSec, rangeEndSec, (utcSec: number) => berlinOffsetMinutes(utcSec * 1000), s.days);
    const active = occurrences.find((o) => nowSec >= o.startSec && nowSec < o.endSec);
    if (active) {
      facts.push({ label: s.label ?? "", status: "active", startAt: berlinDateTimeStrFor(active.startSec), endAt: berlinDateTimeStrFor(active.endSec) });
      continue;
    }
    const imminent = occurrences
      .filter((o) => o.startSec > nowSec && (o.startSec - nowSec) / 60 <= imminentMinutes)
      .sort((a, b) => a.startSec - b.startSec)[0];
    if (imminent) {
      facts.push({
        label: s.label ?? "",
        status: "imminent",
        startAt: berlinDateTimeStrFor(imminent.startSec),
        endAt: berlinDateTimeStrFor(imminent.endSec),
        minutesUntilStart: Math.round((imminent.startSec - nowSec) / 60),
      });
    }
  }
  return facts;
}

export interface SessionWindowArgs {
  instrument: string;
  nowSec?: number;
}

export async function buildSessionWindow({ instrument, nowSec }: SessionWindowArgs) {
  const effectiveNowSec = nowSec ?? Math.floor(Date.now() / 1000);
  const sessions = await getSessions(instrument);
  const windows = evaluateSessionWindows(effectiveNowSec, sessions);

  return {
    instrument,
    nowSec: effectiveNowSec,
    at: berlinDateTimeStrFor(effectiveNowSec),
    windows,
  };
}

export function registerSessionWindowTool(server: McpServer) {
  server.registerTool(
    "check_session_window",
    {
      title: "Session-Fakten",
      description: "Listet konfigurierte Sessions, die gerade aktiv sind oder in bis zu 30 Minuten beginnen. Reine Fakten ohne Handelsentscheidung. replayUntilSec optional für historische Abfragen.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: REPLAY_UNTIL_SEC,
        nowSec: deprecatedTimeParam("nowSec"),
      },
    },
    async ({ replayUntilSec, nowSec: _nowSec, ...rest }) => {
      const args = { ...rest, nowSec: replayUntilSec };
      const result = await buildSessionWindow(args);
      return json(result);
    },
  );
}
