import { db, env, json, checked, headers } from '../_shared/setup2Http.ts';
import { secretMatches, sendPushover } from '../_shared/setup2Notifications.js';
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, {headers});
  if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);
  try {
    if (Number(request.headers.get('content-length') || 0) > 1024) return json({error: 'Request too large'}, 413);
    const body = await request.text();
    if (body.length > 1024) return json({error: 'Request too large'}, 413);
    let password = '';
    try { password = JSON.parse(body).password; } catch { /* Ungültige Versuche zählen ebenfalls. */ }
    if (!env('PUSHOVER_TEST_PASSWORD')) return json({error: 'Test password secret missing'}, 503);
    const valid = await secretMatches(password, env('PUSHOVER_TEST_PASSWORD'));
    const reserved = checked(await db().rpc('pushover_reserve_test', {p_valid: valid}));
    if (!valid) return json({error: 'Passwort ungültig oder Versuchslimit erreicht'}, 403);
    if (!reserved) return json({error: 'Bitte eine Minute bis zum nächsten Test warten'}, 429);
    await sendPushover('T68 · Algo-Watcher Test. Diese Nachricht bestätigt den Versandweg; keine Handelsmeldung.', 'Trading Monitor · Test', env);
    return json({accepted: true, status: 'accepted', message: 'Pushover hat die Nachricht angenommen.'});
  } catch {
    return json({error: 'Pushover-Test konnte nicht gesendet werden. Serververbindung oder Provider prüfen.'}, 502);
  }
});
