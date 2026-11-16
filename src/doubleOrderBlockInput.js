import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {markIgnored} from './ignoredCandles.js';

// Einzige Stelle, die die DOB-Eingabe baut: Dashboard (Worker) und Chart-Debugger sehen so dieselben
// geschlossenen und session-ignorierten Kerzen; ignorierte Kerzen ändern FVG-Füllung und SL.
export function doubleOrderBlockInput({m5,m1,symbol,evaluatedAt}) {
 return {m5Candles:markIgnored(closedChecklistCandles(m5,'5m',evaluatedAt),symbol),
  m1Candles:markIgnored(closedChecklistCandles(m1,'1m',evaluatedAt),symbol),instrument:symbol,evaluatedAt};
}
