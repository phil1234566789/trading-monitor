import {readFileSync} from 'node:fs';
import {checkDobTradeSetup} from '../src/dobTradeSetup.js';
import {dobSourceContext} from '../src/dobSourceOfStrength.js';
import {markIgnoredCandles,htfObCandles} from '../src/sessionOccurrences.js';
import {berlinOffsetMinutes} from '../src/berlinTime.js';

// Gemeinsame Fixtures der DOB-Setup-Tests (checkDobTradeSetup, Alarme).
export const directory=new URL('./fixtures/dob-native/',import.meta.url);
export const load=day=>JSON.parse(readFileSync(new URL(`${day}.json`,directory),'utf8'));
// H1/H4 wie die Messung: Session-Ignore und Session-Extreme der XAU-Sessions, Historie ab Archivbeginn.
const htf=load('htf-xau-2026'),offset=sec=>berlinOffsetMinutes(sec*1000);
export const sourceContext=dobSourceContext({instrument:'XAUUSD',htfCandles:Object.fromEntries(Object.entries(htf.candles).map(([bar,rows])=>
 [bar,htfObCandles(markIgnoredCandles(rows.map(([time,open,high,low,close])=>({time,open,high,low,close})),htf.sessions,offset),htf.sessions,offset)]))});
export const run=(fixture,evaluatedAt=fixture.provenance.query.to,withSource=true,sourceOptions)=>checkDobTradeSetup({instrument:'XAUUSD',
 m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt,...(withSource?{sourceContext}:{}),sourceOptions});
export const berlin=(day,hhmm)=>{const utc=Date.parse(`${day}T${hhmm}:00Z`)/1000;return utc-berlinOffsetMinutes(utc*1000)*60;};
