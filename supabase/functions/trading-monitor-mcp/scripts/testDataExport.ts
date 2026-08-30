// Ad-hoc Testlauf für buildDataExport (Slimming-Refactor 2026-08-30) — ruft die Funktion direkt
// auf, ohne die Edge Function zu deployen (Philip: "musst du nicht [deployen]. ruf einfach deine
// implementierte funktion auf"). Nicht Teil des regulären Toolsets, nur zum lokalen Verifizieren.
import { buildDataExport } from "../tools/dataExport.ts";

const result = await buildDataExport({
  instrument: "GBPUSD",
  dateStr: "2026-08-28",
  replayUntilSec: 1787899500, // 2026-08-28 08:45 Europe/Berlin (CEST)
});

console.log(JSON.stringify(result, null, 2));
