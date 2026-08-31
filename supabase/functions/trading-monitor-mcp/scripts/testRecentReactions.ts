// Ad-hoc Testlauf für buildRecentReactions (get_recent_reactions, 2026-08-31) — analog zu
// testDataExport.ts, ruft die Funktion direkt auf statt über die deployte Edge Function.
import { buildRecentReactions } from "../tools/recentReactions.ts";

const result = await buildRecentReactions({
  instrument: "GBPUSD",
  replayUntilSec: 1787927400, // 2026-08-28 16:30 Europe/Berlin (CEST) — News-Spike-Tag
  lookbackHours: 3,
});

console.log(JSON.stringify(result, null, 2));
