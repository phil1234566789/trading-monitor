import { HTTP_BACKGROUND } from './composables/useHttpActivity.js';
const messages={
 daily_stop_not_ready:'Frische Tagesstopp-Prüfung fehlt oder ist gesperrt.',
 daily_stop_latched:'Tagesstopp aktiv: keine neuen Entries.',
 risk_limits_unconfirmed:'Heutige Risikobasis und Kontogrenzen fehlen oder sind abgelaufen.',
 risk_guard_unavailable:'Frische Tagesstopp-/Risikoprüfung fehlt oder ist gesperrt.',
 risk_floor_reconfirmation_required:'Aktuelle Drawdown-Grenze nach neuem Höchststand erneut bestätigen.',
 risk_budget_exhausted:'Kein freies Markt-, Tages- oder Drawdownbudget.',
 risk_exposure_unavailable:'Offenes Broker-Risiko ist noch ungeklärt.',
 risk_sizing_unavailable:'Native Broker-Lotspezifikation fehlt.',
 target_position_changed:'Brokerposition wurde inzwischen verändert. Entwurf mit frischem Brokerstand abgleichen.',
 target_daily_stop:'Tagesstopp aktiv. TP-Änderung ist gesperrt.',
 target_command_unresolved:'Vorheriger Brokerauftrag ist ungeklärt. Kein erneuter Versand.',

  bridge_offline:'MT5-Worker ist offline.',
  bridge_not_ready:'Worker ist nicht handelsbereit oder es bestehen bereits Positionen/Aufträge.',
  quote_stale:'Brokerkurs ist veraltet. Bitte neue Vorschau anfordern.',
  minimum_volume_exceeds_budget:'Die kleinste Broker-Lotgröße überschreitet das Test-Risikobudget.',
  invalid_stop_or_target:'SL oder TP liegt auf der falschen Seite des aktuellen Kurses.',
  preview_expired:'Vorschau abgelaufen. Bitte neu berechnen.',
  invalid_preview:'Vorschau ungültig. Bitte neu berechnen.',
  live_not_enabled:'Live-Ausführung ist gesperrt.',
};
export function createMilkyMetaTraderClient(baseUrl, token, fetchImpl = fetch) {
  if (!baseUrl || !token) throw new Error('Milky Meta Trader ist noch nicht entsperrt.');
  return async (action, fields = {}, { background = false } = {}) => {
    const response = await fetchImpl(`${baseUrl}/functions/v1/mt5-control`, {
      [HTTP_BACKGROUND]:background,
      method:'POST', cache:'no-store', redirect:'error',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({...fields,action}),
    });
    if (!response.ok) {
      let code;
      try {code=(await response.json()).code;} catch {}
      const error=new Error(response.status===401?'Zugriffsschlüssel ungültig oder Backend noch nicht eingerichtet.'
        :messages[code]??'Anfrage fehlgeschlagen. Konfiguration, Kontodaten und offene Aufträge prüfen.');
      // Nur Fehler vor dem Enqueue beweisen, dass kein Auftrag angenommen wurde.
      error.code=code;
      error.definitiveRejection=response.status===401||['preview_expired','invalid_preview','live_not_enabled'].includes(code);
      throw error;
    }
    return response.json();
  };
}
