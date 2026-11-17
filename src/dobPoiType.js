// POI-Art des DOB-Setups (POI = Ursprungszone der Dealing Range, erkannt über die Kraft): htf_ob = aktive H1/H4-OB-Zone
// (alle Läufe v0–v3), lq_sweep = Sweep eines Liquiditätslevels (Erkennung folgt). Konfig (dob_guardrails), Läufe, Alarme und
// Statistik laufen je POI-Art getrennt, damit eine LQ-Sweep-Änderung HTF-OB nie mitverändert. Die Erkennung je Art steht in
// dobTradeSetup.js (DOB_POI_DETECTORS); setup.poi ist die gefundene Zone, poiType nur die Art.
export const DOB_POI_TYPES={htf_ob:'HTF-OB',lq_sweep:'LQ-Sweep'};
export const DOB_DEFAULT_POI_TYPE='htf_ob';
export const dobPoiTypeLabel=poiType=>DOB_POI_TYPES[poiType]??poiType;
// Referenzlauf je Instrument und POI-Art (Statistik der Sperren im ⛔-Alarm): HTF-OB v3, LQ-Sweep v0; XAU ohne Instrument im Namen.
export function dobCanonicalRunId(instrument,poiType){
 const suffix=instrument==='XAUUSD'?'':`-${instrument.toLowerCase()}`;
 return poiType==='lq_sweep'?`dob-lq-sweep${suffix}-v0`:`dob-setup${suffix}-v3`;
}
export function dobPoiTypeOf(poiType){
 if(poiType==null)return DOB_DEFAULT_POI_TYPE;
 if(!Object.hasOwn(DOB_POI_TYPES,poiType))throw new Error(`Unbekannte POI-Art ${poiType}`);
 return poiType;
}
