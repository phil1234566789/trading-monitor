// Ad-hoc Testlauf für buildRecentSweeps (get_recent_sweeps, 2026-08-31) — analog zu
// testDataExport.ts, ruft die Funktion direkt auf statt über die deployte Edge Function.
import { buildRecentSweeps } from "../tools/recentSweeps.ts";

const result = await buildRecentSweeps({
  instrument: "GBPUSD",
  replayUntilSec: 1787927400, // 2026-08-28 16:30 Europe/Berlin (CEST) — News-Spike-Tag
  lookbackHours: 3,
});

console.log(JSON.stringify(result, null, 2));
