const messages={
  bridge_offline:'MT5-Worker ist offline.',
  bridge_not_ready:'Worker ist nicht handelsbereit oder es bestehen bereits Positionen/Auftraege.',
  quote_stale:'Brokerkurs ist veraltet. Bitte neue Vorschau anfordern.',
  minimum_volume_exceeds_budget:'Die kleinste Broker-Lotgroesse ueberschreitet das Test-Risikobudget.',
  invalid_stop_or_target:'SL oder TP liegt auf der falschen Seite des aktuellen Kurses.',
  preview_expired:'Vorschau abgelaufen. Bitte neu berechnen.',
  invalid_preview:'Vorschau ungueltig. Bitte neu berechnen.',
  live_not_enabled:'Live-Ausfuehrung ist gesperrt.',
};
export function createMilkyMetaTraderClient(baseUrl, token, fetchImpl = fetch) {
  if (!baseUrl || !token) throw new Error('Milky Meta Trader ist noch nicht entsperrt.');
  return async (action, fields = {}) => {
    const response = await fetchImpl(`${baseUrl}/functions/v1/mt5-control`, {
      method:'POST', cache:'no-store', redirect:'error',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({...fields,action}),
    });
    if (!response.ok) {
      let code;
      try {code=(await response.json()).code;} catch {}
      const error=new Error(response.status===401?'Zugriffsschluessel ungueltig oder Backend noch nicht eingerichtet.'
        :messages[code]??'Anfrage fehlgeschlagen. Konfiguration, Kontodaten und offene Auftraege pruefen.');
      // Nur Fehler vor dem Enqueue beweisen, dass kein Auftrag angenommen wurde.
      error.definitiveRejection=response.status===401||['preview_expired','invalid_preview','live_not_enabled'].includes(code);
      throw error;
    }
    return response.json();
  };
}
