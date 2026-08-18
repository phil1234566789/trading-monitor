// PostToolUse-Hook (mcp__trading-monitor__get_data_export): legt/findet die milk-city-
// trading_runs-Zeile fuer (instrument, trading_date) und hinterlegt sie unter der aktuellen
// Claude-Code session_id (trading_run_sessions) -- Grundlage fuer den PreToolUse-Read-Hook
// (trading-run-step-track.js), der beim Lesen einer Trading-Step-Datei nur session_id + Dateipfad
// sieht, aber nicht das Instrument. Siehe milk-city-Task "Gamification: trading_runs-
// Statemanagement ersetzt gbp/eur-Tasks" (Master-Task) fuer die volle Architektur-Begruendung.
//
// Ruft milk-city NICHT ueber MCP auf (kein MCP-Client-Handshake in einem plain Node-Hook-Skript),
// sondern direkt per PostgREST mit dem anon-Key -- gleiches Muster wie die anon-permissiven
// Tabellen sonst im Frontend (z.B. src/newsEvents.js). Braucht MILK_CITY_SUPABASE_ANON_KEY als
// Env-Var (wie MILK_CITY_MCP_TOKEN fuer .mcp.json) -- ohne die Var: Warnung auf stderr, sonst
// normal weiterlaufen (ein fehlkonfigurierter Rechner soll Lana nicht komplett blockieren).
//
// Fehler beim Schreiben (Netzwerk/milk-city down) werden bewusst NICHT geblockt (exit 0 mit
// Warnung) -- anders als der Read-Hook, der bei fehlender Session-Zeile absichtlich blockt. Ein
// PostToolUse-Fehlschlag hier heisst nur "der Wald weiss noch nichts vom aktuellen Lauf", nicht
// "die eigentliche Analyse darf nicht weiterlaufen".

const MILK_CITY_URL = "https://lpivzczsvuszblodeaxf.supabase.co";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
function berlinDateStrFor(unixSec) {
  return DATE_FORMATTER.format(new Date(unixSec * 1000));
}

async function milkCityFetch(anonKey, path, init) {
  const res = await fetch(`${MILK_CITY_URL}${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`milk-city ${path} -> ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", async () => {
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    process.exit(0);
  }

  const anonKey = process.env.MILK_CITY_SUPABASE_ANON_KEY;
  if (!anonKey) {
    process.stderr.write("trading-run-export-track: MILK_CITY_SUPABASE_ANON_KEY fehlt, ueberspringe trading_runs-Tracking.\n");
    process.exit(0);
  }

  const sessionId = input.session_id;
  const args = input.tool_input || {};
  const instrument = String(args.instrument || "").toLowerCase();
  if (!sessionId || !instrument) {
    process.exit(0);
  }

  const tradingDate = args.dateStr || berlinDateStrFor(args.replayUntilSec ?? Math.floor(Date.now() / 1000));

  try {
    const runResult = await milkCityFetch(anonKey, "/rest/v1/rpc/find_or_create_trading_run", {
      method: "POST",
      body: JSON.stringify({ p_instrument: instrument, p_trading_date: tradingDate }),
    });
    const run = Array.isArray(runResult) ? runResult[0] : runResult;
    if (!run?.id) throw new Error("find_or_create_trading_run lieferte keine Zeile");

    await milkCityFetch(anonKey, "/rest/v1/trading_run_sessions", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ session_id: sessionId, trading_run_id: run.id }),
    });
  } catch (err) {
    process.stderr.write(`trading-run-export-track: ${err.message}\n`);
  }

  process.exit(0);
});
