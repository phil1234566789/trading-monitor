export async function requestJson(url, options, operation, fetcher = fetch) {
 const started = Date.now();
 let phase = 'response headers', response;
 try {
  response = await fetcher(url, options);
  if (!response.ok) throw new Error('HTTP failure');
  phase = 'response body';
  const text = await response.text();
  phase = 'JSON decode';
  return {response, data:text ? JSON.parse(text) : null};
 } catch (failure) {
  const durationMs = Date.now()-started;
  const reason = response && !response.ok ? `HTTP ${response.status}`
   : ['TimeoutError','AbortError'].includes(failure?.name) ? failure.name : 'request failed';
  // URLs, Header und Originalfehler können Zugangsdaten enthalten; nur explizite Operationslabels protokollieren.
  throw new Error(`${operation}: ${phase}, ${reason}, ${durationMs}ms`);
 }
}
