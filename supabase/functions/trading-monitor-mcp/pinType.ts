export type PinType = 'observation' | 'bug' | null;
export function pinTypeFields(type?: PinType) {
  if(type===undefined)return {};
  if(type!==null && type!=='observation' && type!=='bug')throw new Error('Unbekannter Pin-Typ.');
  return {pin_type:type};
}
