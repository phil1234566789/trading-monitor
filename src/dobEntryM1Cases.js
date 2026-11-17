import {detectOrderBlocks} from './orderBlockDetection.js';
import {doubleOrderBlockInput} from './doubleOrderBlockInput.js';
import {obMinimum} from './instrumentConfig.js';
import {evaluateDoubleOrderBlockOutcome} from './doubleOrderBlockOutcome.js';

// Sektion „DOB-Entry M1“: Philip sieht sich M1 rund um DOB-Entries an, bevor es eine Erkennungslogik gibt.
// Auswahl aus dob-setup-v3 (XAUUSD, Kombi = counter_dob_status ≠ live): 10 Losses (sl_hit, max_r < 2, also Loss bei jedem
// Konfig-TP 2–5R) und 5 Wins mit max_r ≥ 5, über beide Halbjahre und verschiedene Uhrzeiten; 28.08. 15:38 Short auf Wunsch.
export const DOB_ENTRY_M1_RUN='dob-setup-v3';
export const DOB_ENTRY_M1_CASES=[
 {id:'dob-setup-v3:dob:XAUUSD:1:1767751800:1767752700:a',kind:'loss',label:'07.01. 04:19 Long a'},
 {id:'dob-setup-v3:dob:XAUUSD:1:1770712800:1770714000:a',kind:'loss',label:'10.02. 10:23 Long a'},
 {id:'dob-setup-v3:dob:XAUUSD:1:1772628300:1772629500:b',kind:'loss',label:'04.03. 14:34 Long b'},
 {id:'dob-setup-v3:dob:XAUUSD:-1:1774323000:1774325700:b',kind:'loss',label:'24.03. 06:20 Short b'},
 {id:'dob-setup-v3:dob:XAUUSD:-1:1777483500:1777485600:a',kind:'loss',label:'29.04. 21:04 Short a'},
 {id:'dob-setup-v3:dob:XAUUSD:1:1780541100:1780546800:a',kind:'loss',label:'04.06. 07:15 Long a'},
 {id:'dob-setup-v3:dob:XAUUSD:1:1784207400:1784219400:a',kind:'loss',label:'16.07. 19:29 Long a'},
 {id:'dob-setup-v3:dob:XAUUSD:-1:1786987200:1786989600:b',kind:'loss',label:'17.08. 20:25 Short b'},
 {id:'dob-setup-v3:dob:XAUUSD:-1:1787906100:1787912100:b',kind:'loss',label:'28.08. 15:38 Short b'},
 {id:'dob-setup-v3:dob:XAUUSD:-1:1789944000:1789947600:a',kind:'loss',label:'21.09. 02:43 Short a'},
 {id:'dob-setup-v3:dob:XAUUSD:-1:1770281100:1770282000:b',kind:'win',label:'05.02. 18:01 Short b'},
 {id:'dob-setup-v3:dob:XAUUSD:-1:1774439100:1774441200:b',kind:'win',label:'25.03. 14:19 Short b'},
 {id:'dob-setup-v3:dob:XAUUSD:1:1780535100:1780541100:a',kind:'win',label:'04.06. 05:52 Long a'},
 {id:'dob-setup-v3:dob:XAUUSD:1:1787124600:1787126700:a',kind:'win',label:'19.08. 10:26 Long a'},
 {id:'dob-setup-v3:dob:XAUUSD:-1:1792417200:1792418400:b',kind:'win',label:'19.10. 16:38 Short b'},
];

const LEAD_SECONDS=3600,TAIL_SECONDS=15*60,WIN_R=5,WIN_HORIZON_SECONDS=5*24*3600;
// Sichtfenster 60 min vor Entry bis Ausgang; der Ladebereich beginnt bei OB1, damit beide Zonen erkannt werden können.
// Wins laufen bis 5R statt bis zum gespeicherten 2R-Exit; der 5R-Zeitpunkt ist nicht gespeichert, er kann Tage nach Entry liegen, daher Ladebereich bis 5 Tage.
export function dobEntryM1Window(row,kind){
 const end=kind==='win'?row.entry_time+WIN_HORIZON_SECONDS:row.exit_time??row.entry_time+LEAD_SECONDS;
 const view={from:row.entry_time-LEAD_SECONDS,to:end+TAIL_SECONDS};
 const loadFrom=Math.min(view.from,row.first_ob_start-2*3600);
 // Zählbasierter Abruf: Wochenend-/Nachtlücken holen nur mehr Vorlauf, nie zu wenig.
 return {view,loadTo:view.to,count:{'1m':Math.ceil((view.to-loadFrom)/60)+30,'5m':Math.ceil((view.to-loadFrom)/300)+30}};
}

// OB1/OB2 wie im Detektor: dieselbe Eingabe (geschlossen + Session-Ignore) und dieselbe M5-OB-Erkennung, gesucht über Startzeit.
export function dobEntryM1Zones(row,m5,m1){
 const input=doubleOrderBlockInput({m5,m1,symbol:row.instrument,evaluatedAt:row.exit_time??row.entry_time});
 const dir=row.direction==='long'?1:-1,zones=detectOrderBlocks(input.m5Candles,'5m',true,obMinimum(row.instrument,'5m'));
 return [['OB1',row.first_ob_start],['OB2',row.second_ob_start]].map(([label,start])=>({label,zone:zones.find(z=>z.startTime===start&&z.dir===dir)??null}));
}

// Anzeige-Zeile: Wins bekommen Ziel, Ausgang und Fensterende bei 5R, gerechnet mit derselben Ausgangslogik wie max_r.
export function dobEntryM1Display(row,kind,m1,window){
 if(kind!=='win')return {row,view:window.view,targetLabel:'TP 2R'};
 const o=evaluateDoubleOrderBlockOutcome({direction:row.direction,entryTime:row.entry_time,entryPrice:row.entry_price,stopPrice:row.stop_price,
  candles:m1,evaluatedAt:window.loadTo,instrument:row.instrument,rMultiple:WIN_R});
 if(o.status!=='success')return {row,view:window.view,targetLabel:'TP 2R'};
 return {row:{...row,target_price:o.targetPrice,exit_time:o.recognizedAt,exit_price:o.exitPrice,outcome:'success'},
  view:{from:window.view.from,to:o.recognizedAt+TAIL_SECONDS},targetLabel:'TP '+WIN_R+'R'};
}
