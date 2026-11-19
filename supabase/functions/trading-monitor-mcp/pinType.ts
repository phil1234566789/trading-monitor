export type PinType = 'observation' | 'bug' | 'model' | null;
export function pinTypeFields(type?: PinType) {
  if(type===undefined)return {};
  if(type!==null && type!=='observation' && type!=='bug' && type!=='model')throw new Error('Unbekannter Pin-Typ.');
  return {pin_type:type};
}
