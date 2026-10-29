export function createMilkyMetaTraderClient(baseUrl, token, fetchImpl = fetch) {
  if (!baseUrl || !token) throw new Error('Milky Meta Trader ist noch nicht entsperrt.');
  return async (action, fields = {}) => {
    const response = await fetchImpl(`${baseUrl}/functions/v1/mt5-control`, {
      method:'POST', cache:'no-store', redirect:'error',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({...fields,action}),
    });
    if (!response.ok) throw new Error(response.status === 401
      ? 'Zugriffsschlüssel ungültig oder Backend noch nicht eingerichtet.'
      : 'Anfrage fehlgeschlagen. Konfiguration, Kontodaten und offene Aufträge prüfen.');
    return response.json();
  };
}
