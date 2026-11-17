import {expect,it} from 'vitest';
import {dobGuardrailsQuery,dobGuardrailsToRow,dobGuardrailsFromRow,DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';
import {load,run} from './dobFixtures.js';

// Konfig je (Instrument, Setup-Familie): Speichern und Lesen treffen nur die eigene Zeile; Primärschlüssel (instrument, poi_type)
// in 20261118120000 sorgt dafür, dass ein Upsert der LS-Zeile die HTF-OB-Zeile nie berührt.
function store(){
 const rows=new Map(),k=r=>`${r.instrument}:${r.poi_type}`;
 return {rows,upsert:row=>rows.set(k(row),{...row}),
  from:()=>{const f={};const q={select:()=>q,eq:(c,v)=>(f[c]=v,q),maybeSingle:async()=>({data:[...rows.values()].find(r=>Object.entries(f).every(([c,v])=>r[c]===v))??null,error:null})};return q;}};
}
const philips={...DOB_GUARDRAILS_DEFAULT,defaultTpR:4,blockedMonths:[1],counterDobMode:'live_block_dead_5r',counterCandlesMode:'3of3',partialAtR:3};

it('Speichern der LS-Konfig ändert HTF-OB nicht',async()=>{
 const db=store();
 db.upsert(dobGuardrailsToRow('XAUUSD',philips,'htf_ob'));
 const before=JSON.stringify(db.rows.get('XAUUSD:htf_ob'));
 db.upsert(dobGuardrailsToRow('XAUUSD',{...DOB_GUARDRAILS_DEFAULT,defaultTpR:3,blockedMonths:[5,6]},'lq_sweep'));
 expect(JSON.stringify(db.rows.get('XAUUSD:htf_ob'))).toBe(before);
 expect(dobGuardrailsFromRow((await dobGuardrailsQuery(db,'XAUUSD','htf_ob')).data)).toEqual(dobGuardrailsFromRow(dobGuardrailsToRow('XAUUSD',philips)));
 expect(dobGuardrailsFromRow((await dobGuardrailsQuery(db,'XAUUSD','lq_sweep')).data).blockedMonths).toEqual([5,6]);
});

it('ohne Familie gilt HTF-OB, eine unbekannte Familie ist ein Fehler',()=>{
 expect(dobGuardrailsToRow('XAUUSD',philips).poi_type).toBe('htf_ob');
 expect(()=>dobGuardrailsToRow('XAUUSD',philips,'fvg')).toThrow('Unbekannte POI-Art');
});

it('LS-Platzhalter liefert keine Setups, wo HTF-OB welche hat; ohne Familie gilt HTF-OB',()=>{
 const day=load('2026-11-12'),htf=run(day),implicit=run(day,undefined,true,undefined,{poiType:'htf_ob'}),lq=run(day,undefined,true,undefined,{poiType:'lq_sweep'});
 expect(htf.setups.length).toBeGreaterThan(0);
 expect(htf.poiType).toBe('htf_ob');
 expect(JSON.stringify(implicit.setups)).toBe(JSON.stringify(htf.setups));
 expect(lq.setups).toEqual([]);
});
