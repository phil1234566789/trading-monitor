// Registry-Chartobjekt (src/chartObjectRegistry.js) in einer TSC-Rolle: trade_evidence/trade_targets tragen es unter
// chart_object_*, dealing_ranges unter invalidation_chart_object_* (Migration 20261122100000). Frontend und MCP lesen und
// schreiben über diese eine Abbildung, damit beide Seiten dieselbe Form { type, key, instrument, timeframe, snapshot } sehen.
const FIELDS = ["type", "key", "instrument", "timeframe", "snapshot"];

export const chartObjectColumns = (prefix = "") => FIELDS.map((f) => `${prefix}chart_object_${f}`).join(", ");
export const CHART_OBJECT_COLUMNS = chartObjectColumns();
export const INVALIDATION_CHART_OBJECT_COLUMNS = chartObjectColumns("invalidation_");

export function chartObjectFromRow(row, prefix = "") {
  if (!row?.[`${prefix}chart_object_type`]) return null;
  return Object.fromEntries(FIELDS.map((f) => [f, row[`${prefix}chart_object_${f}`]]));
}

// null leert alle Spalten (Invalidierung ohne Registry-Objekt).
export function chartObjectToRow(chartObject, prefix = "") {
  return Object.fromEntries(FIELDS.map((f) => [`${prefix}chart_object_${f}`, chartObject?.[f] ?? null]));
}

// Prüfung an der Vertrauensgrenze (MCP-Eingabe), gleiche Regeln wie die DB-CHECKs.
export function assertChartObject(o) {
  if (!o || typeof o !== "object") throw new Error("chartObject fehlt");
  if (!/^[a-z0-9_]+$/.test(o.type ?? "")) throw new Error(`chartObject.type ungültig: ${o.type}`);
  for (const f of ["key", "instrument", "timeframe"]) {
    if (typeof o[f] !== "string" || o[f].length === 0) throw new Error(`chartObject.${f} fehlt`);
  }
  if (!o.snapshot || typeof o.snapshot !== "object" || Array.isArray(o.snapshot)) throw new Error("chartObject.snapshot muss ein Objekt sein");
  if (JSON.stringify(o.snapshot).length > 16384) throw new Error("chartObject.snapshot zu groß (max 16 KB)");
  return o;
}
