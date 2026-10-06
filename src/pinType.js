export const PIN_TYPES={observation:'Beobachtung',bug:'Bug'};
export const pinTypeLabel=type=>PIN_TYPES[type] ?? 'Typ fehlt';
export function pinTypeFields(type) {
  if(type===undefined)return {};
  if(type!==null && !Object.hasOwn(PIN_TYPES,type))throw new Error('Unbekannter Pin-Typ.');
  return {pin_type:type};
}
