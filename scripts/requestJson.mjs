export async function requestJson(url, options, operation, fetcher = fetch) {
 const started = Date.now();
 let phase = 'response headers', response;
 try {
  response = await fetcher(url, options);
  if (!response.ok) {
   let code=null;
   try {
    const body=await response.json();
    if(body.code==='P0001' && body.message==='Watcher lease expired')code='Watcher lease expired';
    else if(['P0001','57014','23503','23505','23514','42501','PGRST202','PGRST204'].includes(body.code))code=body.code;
   } catch {}
   const error=new Error('HTTP failure');error.safeCode=code;throw error;
  }
  phase = 'response body';
  const text = await response.text();
  phase = 'JSON decode';
  return {response, data:text ? JSON.parse(text) : null};
 } catch (failure) {
  const durationMs = Date.now()-started;
  const reason = response && !response.ok ? `HTTP ${response.status}${failure.safeCode?` (${failure.safeCode})`:""}`
   : ['TimeoutError','AbortError'].includes(failure?.name) ? failure.name : 'request failed';
  // URLs, Header und Originalfehler können Zugangsdaten enthalten; nur explizite Operationslabels protokollieren.
  throw new Error(`${operation}: ${phase}, ${reason}, ${durationMs}ms`);
 }
}
