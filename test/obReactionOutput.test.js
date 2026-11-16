import {expect,it} from 'vitest';
import {obReactionGraph,reactionOutput} from '../src/obReactionGraph.js';

const routes={a:{status:'rejected',reason:'opposingFvgOpen',knownAt:600},b:{status:'entry',entryTime:900,entryPrice:114,stopLoss:99,stopAnchor:'m5-edge'}};

it('Ausgabe zeigt false, pending und unknown ohne Begründung',()=>{
 for(const state of ['false','pending','unknown'])
  expect(reactionOutput({verdict:{state,reason:'opposingFvgOpen',knownAt:600},routes})).toEqual({state,entry:''});
 expect(reactionOutput(null)).toEqual({state:'unknown',entry:''});
});

it('Ausgabe true nennt den frühesten Entry mit SL-Anker im Klartext',()=>{
 const early={status:'entry',entryTime:600,entryPrice:113,stopLoss:98,stopAnchor:'retestExtreme'};
 expect(reactionOutput({verdict:{state:'true'},routes}).entry).toMatch(/^Entry \d\d:\d\d @ 114 · SL 99 \(OB-Kante\)$/);
 expect(reactionOutput({verdict:{state:'true'},routes:{...routes,a:early}}).entry).toMatch(/@ 113 · SL 98 \(Retest\)$/);
});

it('Ausgabe ist rollenunabhängig: auch OB1 zeigt seinen Entry, ohne DOB-Rollentext',()=>{
 const orderBlock={top:120,bottom:100,dir:1,startTime:0,recognizedAt:300,timeframe:'5M'};
 const reaction={state:'true',structuralState:'true',reason:null,knownAt:600,fvg:{direction:'long',top:113,bottom:111,candleTime:480,recognizedAt:600},contact:{candleTime:420,knownAt:480,status:'touch'},verdict:{state:'true',knownAt:900},routes};
 const g=obReactionGraph({dir:1,entry:{role:'first',orderBlock,reaction,internalFvgs:[]},context:{rows:[],evaluatedAt:1800},evaluatedAt:1800});
 expect(g.nodes.result).toMatchObject({headline:'Reaktion: true',sub:expect.stringMatching(/^Entry .* \(OB-Kante\)$/)});
 expect(g.nodes.result.detail.join('\n')).not.toContain('OB1');
});
