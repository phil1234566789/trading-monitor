// Kraftquelle aus den v1-Feldern, z.B. „H1-OB · 0,8 ATR“; v0 hat keine und zeigt „–“.
export function dobSourceLabel(row){
 if(!row.source_kind)return '–';
 const num=v=>v.toLocaleString('de-DE',{maximumFractionDigits:1});
 const distance=Number.isFinite(row.source_distance_atr)?` · ${num(row.source_distance_atr)} ATR`
  :Number.isFinite(row.source_distance_usd)?` · ${num(row.source_distance_usd)} USD`:'';
 const kind=/^ob_(h\d)$/.exec(row.source_kind);
 return (kind?`${kind[1].toUpperCase()}-OB`:row.source_kind)+distance;
}
