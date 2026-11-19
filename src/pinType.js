// model: Mustertrade, darf bei Algo-Änderungen nicht aus dem Lauf fallen (dobTradeSetupsFill.mjs prüft das vor dem Schreiben).
export const PIN_TYPES={observation:'Beobachtung',bug:'Bug',model:'Mustertrade'};
export const pinTypeLabel=type=>PIN_TYPES[type] ?? 'Typ fehlt';
export function pinTypeFields(type) {
  if(type===undefined)return {};
  if(type!==null && !Object.hasOwn(PIN_TYPES,type))throw new Error('Unbekannter Pin-Typ.');
  return {pin_type:type};
}
