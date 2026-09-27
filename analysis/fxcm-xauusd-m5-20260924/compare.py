import json
from pathlib import Path
root = Path(__file__).resolve().parent
probe = json.loads((root/'candles.json').read_text())
tv = json.loads((root/'tradingview.json').read_text())
from datetime import datetime
rows = {int(datetime.fromisoformat(r['time']).timestamp()):r for r in probe['instruments']['XAU/USD']['candles']}
bars = tv.get('bars', tv.get('data',{}).get('bars',[]))
matched = [b for b in bars if b['t'] in rows]
diffs = [{ 'time': b['t'], 'field': long, 'sdk':rows[b['t']][long], 'tv':b[short] }
    for b in matched for short,long in [('o','open'),('h','high'),('l','low'),('c','close')]]
diffs = [d for d in diffs if abs(d['sdk']-d['tv']) > 0.005]
result = {'symbol':'FX:XAUUSD','matched_bars':len(matched),'ohlc_differences_over_half_tick':diffs}
(root/'tradingview-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
