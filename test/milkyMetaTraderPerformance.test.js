import {it,expect} from 'vitest';
import {tradeOutcome,tradeOutcomeClass,tradePerformance,tradeExtremes} from '../src/milkyMetaTraderPerformance.js';
it('treats inclusive ±10 before commission as neutral break-even',()=>{
 for(const trade of [{net:-25,commission:-15},{net:-5,commission:-15},{net:10,commission:0},{net:-10,commission:0},{net:0}]){
  expect(tradeOutcome(trade)).toBe('breakeven');expect(tradeOutcomeClass(trade)).toBe('');
 }
 expect(tradeOutcome({net:-25.01,commission:-15})).toBe('loss');
 expect(tradeOutcome({net:-4.99,commission:-15})).toBe('win');
});
it('ranks each outcome by net, limits both lists separately and never mutates the source',()=>{
 const trades=[{id:'be',net:-25,commission:-15},{id:'winner2',net:15,commission:-20},{id:'winner1',net:30,commission:0},{id:'loser2',net:-40,commission:0},{id:'loser1',net:-100,commission:-20}];
 const original=[...trades];
 expect(tradeExtremes(trades,1)).toMatchObject({winners:[{id:'winner1'}],losers:[{id:'loser1'}]});
 expect(tradeExtremes(trades,5).winners.map(t=>t.id)).toEqual(['winner1','winner2']);
 expect(tradeExtremes(trades,5).losers.map(t=>t.id)).toEqual(['loser1','loser2']);
 expect(trades).toEqual(original);
});
it('excludes break-even from the win-rate denominator without losing trades or changing net and costs',()=>{
 const trades=[{net:20,commission:-5},{net:-30,commission:-5},{net:-25,commission:-15},{net:0,commission:0}];
 expect(tradePerformance(trades)).toMatchObject({count:4,wins:1,losses:1,breakeven:2,winrate:50,net:-35,commission:-25});
 expect(tradePerformance([{net:-25,commission:-15}]).winrate).toBeNull();
 expect(tradePerformance([]).winrate).toBeNull();
});
