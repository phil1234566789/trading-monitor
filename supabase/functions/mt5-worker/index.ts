import { historyWorkerAction } from '../trading-monitor-mcp/mt5History.ts';
import { workerAction } from '../trading-monitor-mcp/mt5Execution.ts';
import { workerConfiguration } from '../trading-monitor-mcp/mt5Credentials.ts';

Deno.serve(async req => {
  const token = Deno.env.get('MT5_WORKER_TOKEN');
  if (!token || req.headers.get('Authorization') !== `Bearer ${token}`) return new Response('Unauthorized',{status:401});
  if (req.method !== 'POST') return new Response('Method not allowed',{status:405});
  const text = await req.text();
  if (text.length > 64_000) return new Response('Payload too large',{status:413});
  try {
    const body=JSON.parse(text);
    return Response.json(body.action==='configuration' ? await workerConfiguration() : body.action?.startsWith('history_') ? await historyWorkerAction(body) : await workerAction(body),
      {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'worker_failed';
    const allowed = /^(mt5_not_configured|invalid_\w+|account_mismatch|live_not_enabled|unknown_action)$/;
    return Response.json({error:allowed.test(reason) ? reason : 'worker_unavailable'}, {status:400});
  }
});
