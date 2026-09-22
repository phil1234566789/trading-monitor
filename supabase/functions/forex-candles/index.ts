import { createClient } from "npm:@supabase/supabase-js@2";
import { readFxcmCandles } from "../_shared/fxcmCandles.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Content-Type": "application/json" };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });

// Nur geschlossene native FXCM-Bid-Kerzen; GET/POST-Vertrag bleibt erhalten.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (!["GET", "POST"].includes(req.method)) return reply({ error: "Method not allowed" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (req.method === "POST") {
      const body = await req.json();
      if (!Array.isArray(body?.requests) || !body.requests.length || body.requests.length > 10) return reply({ error: "Expected 1–10 requests" }, 400);
      const results = await Promise.all(body.requests.map((r: { symbol: string; period: string; count: number; to?: number }) =>
        readFxcmCandles(db, r?.symbol, r?.period, Math.min(r?.count, 5000), r?.to)));
      return reply({ results });
    }
    const p = new URL(req.url).searchParams;
    return reply(await readFxcmCandles(db, p.get("symbol") ?? "GBPUSD", p.get("period") ?? "1h",
      Math.min(Number(p.get("count") ?? 300), 5000), p.has("to") ? Number(p.get("to")) : undefined));
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "Invalid candle request")) return reply({ error: "Invalid candle request" }, 400);
    console.error("FXCM archive read failed", error);
    return reply({ error: "Candle archive unavailable" }, 502);
  }
});
