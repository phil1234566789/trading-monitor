// PreToolUse-Hook (Read): sobald Lana eine der 7 Wald-Schritt-Dateien im trading-Repo
// (00-trading-steps/0[1-7]-.../*.md) liest, wird das als "Schritt N erreicht" fuer den
// trading_run gewertet, der ueber trading_run_sessions an diese session_id gebunden ist (siehe
// trading-run-export-track.js, PostToolUse auf get_data_export -- muss VORHER in derselben
// Session gelaufen sein). Schritt 8 (trade-management) ist bewusst NICHT Teil des Musters --
// Boss-Encounter-Resolve ist "Teil B", noch nicht automatisiert.
//
// Fehlt die Session-Zeile (get_data_export wurde in dieser Session noch nicht aufgerufen), wird
// GEBLOCKT (exit 2, Fehlermeldung auf stderr) statt stillschweigend zu ueberspringen -- das ist
// die vom Master-Task explizit gewollte Absicherung ("erst get_data_export aufrufen"). Alle
// anderen Fehler (Netzwerk/milk-city down, fehlender anon-Key) lassen das Read normal
// durchlaufen (exit 0 + Warnung) -- ein Infra-Hickup soll Lana nicht komplett aussperren, nur die
// fehlende Grundvoraussetzung selbst.

const MILK_CITY_URL = "https://lpivzczsvuszblodeaxf.supabase.co";
const STEP_PATH_RE = /[\\/]00-trading-steps[\\/]0([1-7])-[^\\/]+[\\/][^\\/]+\.md$/i;

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

  const filePath = input.tool_input?.file_path || "";
  const match = filePath.match(STEP_PATH_RE);
  if (!match) {
    process.exit(0);
  }
  const step = Number(match[1]);

  const anonKey = process.env.MILK_CITY_SUPABASE_ANON_KEY;
  if (!anonKey) {
    process.stderr.write("trading-run-step-track: MILK_CITY_SUPABASE_ANON_KEY fehlt, ueberspringe trading_runs-Tracking.\n");
    process.exit(0);
  }

  const sessionId = input.session_id;

  try {
    const sessions = await milkCityFetch(
      anonKey,
      `/rest/v1/trading_run_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=trading_run_id`,
      { method: "GET" },
    );
    const tradingRunId = sessions?.[0]?.trading_run_id;
    if (!tradingRunId) {
      process.stderr.write(
        "Kein aktiver trading_run fuer diese Session gefunden -- erst get_data_export(instrument, dateStr?) aufrufen, " +
          "bevor ein Wald-Schritt (00-trading-steps/0N-...) gelesen wird.\n",
      );
      process.exit(2);
    }

    await milkCityFetch(anonKey, "/rest/v1/rpc/advance_trading_run", {
      method: "POST",
      body: JSON.stringify({ p_trading_run_id: tradingRunId, p_step: step }),
    });
    process.exit(0);
  } catch (err) {
    process.stderr.write(`trading-run-step-track: ${err.message}\n`);
    process.exit(0);
  }
});
