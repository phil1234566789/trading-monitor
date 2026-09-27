import json
from datetime import datetime,timezone
from pathlib import Path
from statistics import median
root=Path(__file__).resolve().parent
raw=next(s[11:] for s in (root/'sides-result.txt').read_text().splitlines() if s.startswith('PROBE_JSON='))
rows=json.loads(raw)
sdk={int(datetime.fromisoformat(r['time'][:26]).replace(tzinfo=timezone.utc).timestamp()):r for r in rows}
tv=json.loads((root/'tradingview.json').read_text())['bars']
result={}
for side in ['Bid','Ask','Mid']:
    differences=[]
    for b in tv:
        if b['t'] not in sdk: continue
        row=sdk[b['t']]
        for short,long in [('o','Open'),('h','High'),('l','Low'),('c','Close')]:
            value=(row['Bid'+long]+row['Ask'+long])/2 if side=='Mid' else row[side+long]
            differences.append(abs(value-b[short]))
    result[side]={'fields':len(differences),'matching_half_tick':sum(d<=0.005 for d in differences),'median_absolute_difference':median(differences),'max_absolute_difference':max(differences)}
result['note']='Mid = Mittel der Bid-/Ask-OHLC, kein tickweise rekonstruierter Mid-Chart.'
(root/'side-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
