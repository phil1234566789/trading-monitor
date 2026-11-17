// R-Ziel k aus max_r/sl_hit: Win, wenn k vor dem SL erreicht wurde; Loss, wenn der SL vorher kam; sonst offen bzw. unbekannt. Ohne max_r (Lauf noch nicht neu befüllt) gilt nur der gespeicherte 2R-Ausgang.
export function dobTargetOutcome(row,k=2){
 if(row.max_r==null)return k===2?row.outcome:'unknown';
 if(row.max_r>=k)return 'success';
 if(k<=(row.ambiguous_r??-1))return 'ambiguous';
 // Fehlende Kerzen (Ausgang unknown) bleiben unbekannt statt offen.
 return row.sl_hit?'loss':row.outcome==='unknown'?'unknown':'open';
}
