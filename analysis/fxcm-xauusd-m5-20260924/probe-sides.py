import json, os, sys
from datetime import datetime, timezone
sys.path.insert(0,'/app')
from collector import read_config
from forexconnect import ForexConnect
try:
    config=read_config('/run/secrets/fxcm.env')
    os.chdir('/tmp')
    with ForexConnect() as fx:
        fx.login(config['FXCM_USERNAME'],config['FXCM_PASSWORD'],'https://www.fxcorporate.com/Hosts.jsp',config.get('FXCM_CONNECTION','Demo'))
        history=fx.get_history('XAU/USD','m5',datetime(2026,9,24,10,tzinfo=timezone.utc),datetime(2026,9,24,18,20,tzinfo=timezone.utc))
        rows=[dict(time=str(r['Date']),**{k:float(r[k]) for k in ['BidOpen','BidHigh','BidLow','BidClose','AskOpen','AskHigh','AskLow','AskClose']}) for r in history]
    print('PROBE_JSON='+json.dumps(rows,allow_nan=False))
except Exception as error:
    print('Probe failed: '+type(error).__name__)
    sys.exit(1)
