const transportCategories = {
 ECONNRESET:'connection', ECONNREFUSED:'connection', EPIPE:'connection', UND_ERR_SOCKET:'connection',
 ENOTFOUND:'dns', EAI_AGAIN:'dns', ETIMEDOUT:'timeout', UND_ERR_CONNECT_TIMEOUT:'timeout',
 UND_ERR_HEADERS_TIMEOUT:'timeout', UND_ERR_BODY_TIMEOUT:'timeout'
};
// Nur selbst erzeugte, feste Diagnosefelder freigeben; fremde Error-Properties dürfen nicht ins Log gelangen.
const diagnostics = new WeakMap();
export function requestDiagnostic(error) { return diagnostics.get(error); }

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
  const error = new Error(`${operation}: ${phase}, ${reason}, ${durationMs}ms`);
  const code = [failure?.cause?.code, failure?.code].find(value=>typeof value==='string' && Object.hasOwn(transportCategories,value)) ?? null;
  const category = response && !response.ok ? 'http' : phase==='JSON decode' ? 'decode'
   : failure?.name==='TimeoutError' ? 'timeout' : failure?.name==='AbortError' ? 'abort'
   : code ? transportCategories[code] : 'unknown';
  // Die Meldung bleibt identisch: zusätzliche Diagnose darf bestehende Incident-IDs nicht aufspalten.
  diagnostics.set(error,Object.freeze({phase,category,code}));
  throw error;
 }
}
