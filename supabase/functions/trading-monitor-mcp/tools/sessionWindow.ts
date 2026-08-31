import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { getSessions } from "../db.ts";
import { berlinOffsetMinutes, berlinDateTimeStrFor } from "../berlinTime.ts";
import { sessionOccurrences } from "../sessionOccurrences.js";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// check_session_window (Schritt 4, siehe docs/state-machine.md + 04-check-session.md) — REINE
// Fakten, keine Interpretation/Auswahl (das bleibt Schritt 5, siehe run_dealing_range_loop, das
// dieses Tool bei jedem vollen Durchlauf intern erneut aufruft). Richtwert <30 Minuten für
// "unmittelbar bevorstehend" — derselbe Schwellwert, den 04-check-session.md selbst als Beispiel
// nennt (v.a. NY-Open).
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
  return {
    instrument,
    nowSec: effectiveNowSec,
    at: berlinDateTimeStrFor(effectiveNowSec),
    windows: evaluateSessionWindows(effectiveNowSec, sessions),
  };
}

export function registerSessionWindowTool(server: McpServer) {
  server.registerTool(
    "check_session_window",
    {
      title: "Schritt 4: Session-Fakten",
      description:
        "Mechanisiert Schritt 4 (Check Session) aus 00-trading-steps — REINE Fakten, keine " +
        "Interpretation/Zonen-Auswahl (das bleibt Schritt 5, run_dealing_range_loop ruft dieses " +
        "Tool bei jedem vollen Durchlauf intern erneut auf). `windows` listet NUR Sessions, die " +
        "GERADE laufen (status='active') oder in <30 Min. beginnen (status='imminent') — alle " +
        "anderen konfigurierten Sessions (Asia/MMM/Spread Hour/NY/... siehe Sessions-Modal im " +
        "Dashboard) werden bewusst weggelassen, da 'weder aktiv noch unmittelbar bevorstehend' " +
        "trivial und nicht ausgabewürdig ist (Philip). Kein Werturteil ('Vorsicht' o.ä.) — das " +
        "zieht Schritt 5 selbst aus diesen Fakten. nowSec optional für einen Backtest/Replay-" +
        "Zeitpunkt (Default: jetzt).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        nowSec: z.number().int().optional().describe("Unix-Sekunden, Default: jetzt"),
      },
    },
    async (args) => json(await buildSessionWindow(args)),
  );
}
