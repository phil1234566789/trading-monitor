// Kraftquelle-Texte für Statistikseite und Alarm (Deno-Watcher importiert diese Datei, deshalb ohne weitere Abhängigkeiten).
export const dobAge=sec=>sec<3600?`${Math.round(sec/60)} min`:sec<86400?`${(sec/3600).toLocaleString('de-DE',{maximumFractionDigits:1})} h`:`${Math.round(sec/86400)} Tg`;

// Letzter Touch der Zone vor OB1: „erster Touch vor 2,2 h“; ohne Zählung (Statistik speichert nur die Art) „Folge-Touch vor 40 min“.
export function dobRetestLabel({kind,count,ageSeconds}){
 if(!kind||!Number.isFinite(ageSeconds))return '';
 return `${kind==='first'?'erster':count>1?`${count}.`:'Folge-'}${kind==='first'||count>1?' ':''}Touch vor ${dobAge(ageSeconds)}`;
}

// Kraftquelle aus den v1-Feldern, z.B. „H1-OB · 0,8 ATR · Folge-Touch vor 40 min“; v0 hat keine und zeigt „–“.
export function dobSourceLabel(row){
 if(!row.source_kind)return '–';
 const num=v=>v.toLocaleString('de-DE',{maximumFractionDigits:1});
 const distance=Number.isFinite(row.source_distance_atr)?` · ${num(row.source_distance_atr)} ATR`
  :Number.isFinite(row.source_distance_usd)?` · ${num(row.source_distance_usd)} USD`:'';
 const kind=/^ob_(h\d)$/.exec(row.source_kind);
 const retest=dobRetestLabel({kind:row.source_retest_kind,ageSeconds:row.source_retest_age_seconds});
 return (kind?`${kind[1].toUpperCase()}-OB`:row.source_kind)+distance+(retest?` · ${retest}`:'');
}
