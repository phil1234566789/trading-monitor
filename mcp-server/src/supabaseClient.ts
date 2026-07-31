import { createClient } from "@supabase/supabase-js";

// Analog src/supabaseClient.js, aber ohne Vite: Env kommt über process.env (von `claude mcp add
// --env ...` gesetzt, siehe .mcp.json), nicht über import.meta.env — das gibt's unter Node nicht.
// Bewusst derselbe anon-key wie das Frontend (nicht service_role): least privilege, und alle vom
// MCP-Server gelesenen/geschriebenen Tabellen erlauben anon bereits select (ob_zones/
// liquidity_levels/trade_setups/dealing_ranges/trade_positions/trade_targets/
// trade_partial_exits/news_events/trading_schedules) bzw. select+insert (claude_annotations) nach
// demselben Single-User-Modell wie das restliche Repo (siehe CLAUDE.md).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY fehlen — siehe .mcp.json bzw. mcp-server/.env.example.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { SUPABASE_URL, SUPABASE_ANON_KEY };
