import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {markIgnored,markHtfObCandles} from './ignoredCandles.js';

// Einzige Stelle, die die DOB-Eingabe baut: Dashboard (Worker) und Chart-Debugger sehen so dieselben
// geschlossenen und session-ignorierten Kerzen; ignorierte Kerzen ändern FVG-Füllung und SL.
// h1/h4 (optional) für die POI in checkDobTradeSetup(): wie die HTF-OBs im Chart mit Session-Extremen.
export function doubleOrderBlockInput({m5,m1,h1,h4,symbol,evaluatedAt}) {
 const input={m5Candles:markIgnored(closedChecklistCandles(m5,'5m',evaluatedAt),symbol),
  m1Candles:markIgnored(closedChecklistCandles(m1,'1m',evaluatedAt),symbol),instrument:symbol,evaluatedAt};
 if(h1||h4)input.htfCandles={'1h':markHtfObCandles(closedChecklistCandles(h1??[],'1h',evaluatedAt),symbol),
  '4h':markHtfObCandles(closedChecklistCandles(h4??[],'4h',evaluatedAt),symbol)};
 return input;
}
