// Bug-Report Philip 2026-08-30: get_ob_zones lieferte für GBPUSD (8397 Zeilen, aufsteigend
// sortiert) nur noch uralte 2025er-Zonen — derselbe PostgREST-~1000-Zeilen-Cap wie in CLAUDE.md
// für backfillObZones/forexCandles dokumentiert (siehe fetchAllCandles dort, exakt dasselbe
// Cursor-Muster hier übernommen), nur bisher nicht auf getObZones/getLiquidityLevels anwandt —
// data.length < READ_PAGE_SIZE ist KEIN verlässliches "letzte Seite"-Signal (kann auch nur der
// Server-Cap sein), deshalb um die TATSÄCHLICH zurückgegebene Zeilenzahl weiterzählen statt um
// READ_PAGE_SIZE, nur eine wirklich leere Seite beendet die Schleife.
const READ_PAGE_SIZE = 1000;
export async function fetchAllRows<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + READ_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    from += data.length;
  }
  return all;
}
