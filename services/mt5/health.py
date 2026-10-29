"""Fehlerposition melden, niemals rohe Exception-Texte mit Zugangsdaten."""
import re
import time
import traceback

def fault_details(error,previous=None):
    frames=traceback.extract_tb(error.__traceback__)
    frame=frames[-1] if frames else None
    stage=frame.name if frame and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,79}',frame.name) else 'worker'
    fault=dict(code=type(error).__name__,stage=stage,line=frame.lineno if frame else 1,since_sec=int(time.time()))
    if previous and all(previous.get(k)==fault[k] for k in ('code','stage','line')):
        fault['since_sec']=previous['since_sec']
    return fault
