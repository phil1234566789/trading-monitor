import { createClient } from 'npm:@supabase/supabase-js@2';
export const env = (name: string) => Deno.env.get(name) ?? '';
export const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
export const headers = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store'};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...headers, 'Content-Type': 'application/json'}});
export function checked<T>(result: {data: T; error: {message: string} | null}): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
