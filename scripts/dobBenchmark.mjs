// Laufzeit von detectDoubleOrderBlocks auf allen dob-native-Tagen; Median, weil parallele Last die Einzelwerte verzerrt.
import {fileURLToPath} from 'node:url';import fs from 'node:fs';import {createServer} from 'vite';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/[\/]$/,'');
const server=await createServer({root,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});
const median=values=>values.sort((a,b)=>a-b)[values.length>>1];
try{
 const {detectDoubleOrderBlocks,DOUBLE_ORDER_BLOCK_VERSION}=await server.ssrLoadModule('/src/doubleOrderBlocks.js');
 const load=day=>JSON.parse(fs.readFileSync(`${root}/test/fixtures/dob-native/${day}.json`,'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(root+'/test/fixtures/dob-native/references.json','utf8')).days.map(load);
 const inputs=fixtures.map(f=>({instrument:'XAUUSD',m5Candles:f.candles.m5,m1Candles:f.candles.m1,evaluatedAt:f.provenance.query.to}));
 const merged=tf=>fixtures.flatMap(f=>f.candles[tf]).sort((a,b)=>a.time-b.time);
 const chart={instrument:'XAUUSD',m5Candles:merged('m5'),m1Candles:merged('m1'),evaluatedAt:Math.max(...inputs.map(i=>i.evaluatedAt))};
 const time=(input,n)=>{const t=performance.now();for(let i=0;i<n;i++)detectDoubleOrderBlocks(input);return (performance.now()-t)/n;};
 for(const input of [...inputs,chart])time(input,3);
 const days=[],big=[];
 for(let round=0;round<7;round++){days.push(inputs.reduce((sum,input)=>sum+time(input,5),0));big.push(time(chart,3));}
 const pairs=inputs.reduce((sum,input)=>sum+detectDoubleOrderBlocks(input).pairs.length,0);
 console.log(`${DOUBLE_ORDER_BLOCK_VERSION}\n12 days: median ${median(days).toFixed(2)} ms (sum per pass), pairs ${pairs}\nall days merged (${chart.m1Candles.length} M1): median ${median(big).toFixed(2)} ms`);
}finally{await server.close();}
