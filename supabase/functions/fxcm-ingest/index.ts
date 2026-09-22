import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import { validateCandles } from './validate.js';

Deno.serve(async (req) => {
  const token = Deno.env.get('FXCM_INGEST_TOKEN');
  if (!token || req.headers.get('X-FXCM-Token') !== token) return new Response('Unauthorized', { status: 401 });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const text = await req.text();
  if (text.length > 300_000) return new Response('Payload too large', { status: 413 });
  let rows;
  try {
    rows = validateCandles(JSON.parse(text));
  } catch {
    return new Response('Invalid candles', { status: 400 });
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await db.from('fxcm_candles').upsert(rows,
    { onConflict: 'instrument,bar,time', ignoreDuplicates: true });
  if (error) {
    console.error('FXCM ingest database error', error.code);
    return new Response('Database write failed', { status: 503 });
  }
  return Response.json({ accepted: rows.length });
});
