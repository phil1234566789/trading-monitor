import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=new URL('../test/fixtures/dob-native/references.json',import.meta.url);
const text=await readFile(source,'utf8'),manifest=JSON.parse(text),days=new Map(),footprint=[];
const previous=JSON.parse(await readFile(new URL('../analysis/dob/reference-diagnostics.json',import.meta.url),'utf8'));
const previousPolicy=previous.version.endsWith('v5')?{version:previous.version,previousPolicy:previous.previousPolicy,
 footprint:previous.footprint.map(({day,pairCount})=>({day,pairCount}))}:previous.previousPolicy;
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
try{
 const {detectDoubleOrderBlocks,DOUBLE_ORDER_BLOCK_VERSION}=await server.ssrLoadModule('/src/doubleOrderBlocks.js');
 const touch=`${(await server.ssrLoadModule('/src/orderBlockReaction.js')).TOUCH_TOLERANCE_FRACTION*100}%`;
 for(const day of manifest.days){
  const fixture=JSON.parse(await readFile(new URL(`../test/fixtures/dob-native/${day}.json`,import.meta.url),'utf8'));
  const result=detectDoubleOrderBlocks({instrument:manifest.instrument,m5Candles:fixture.candles.m5,
   m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to});
  days.set(day,result);footprint.push({day,pairCount:result.pairs.length,...result.stats});
 }
 const references=manifest.pairs.map(pair=>{
  const [a,b]=pair.pins.map(pin=>manifest.references.find(ref=>ref.pin===pin));
  const match=dob=>dob.firstOrderBlock.startTime===a.startTime&&dob.secondOrderBlock.startTime===b.startTime;
  const found=days.get(a.day).pairs.find(match);
  if(!found)return {reference:pair.id,pins:pair.pins,day:a.day,recognized:false};
  return {reference:pair.id,pins:pair.pins,day:a.day,recognized:true,direction:found.direction,recognizedAt:found.recognizedAt,
   firstRetest:found.firstRetest.candleTime,firstReaction:found.firstReaction.recognizedAt,
   secondRetest:found.secondRetest.candleTime,secondReaction:found.secondReaction.recognizedAt,
   firstM5ReactionKnownAt:found.firstM5ReactionKnownAt,
   firstPenetration:found.firstPenetration,secondPenetration:found.secondPenetration,firstRetestHold:found.firstRetestHold,priceGap:found.priceGap,entries:found.entries};
 });
 const report={version:DOUBLE_ORDER_BLOCK_VERSION,scope:'16 selected positive examples; no general win-rate or trading approval',
  nativeManifestSha256:createHash('sha256').update(text).digest('hex'),sourceBaseline:manifest.codeBaseline,
  previousPolicy,policy:{reaction:`first touch (within ${touch} of the OB height), then first same-direction M1 FVG; M5 far edge reached within ${touch} first = false`,
   pairing:'latest matching first reaction before second retest; simultaneous overlapping partners retained',
   entryB:'rejected when its M1 OB is pierced >50% after full FVG fill',
   firstRetestHold:{anchor:'first exact-touch retest extreme known before the second retest, else the near-touch reaction extreme',from:'first reaction knownAt',
    through:'second reaction knownAt inclusive',sweep:'strict low below anchor long / strict high above anchor short; equality passes',
    coverage:'missing or ignored M1 before a decisive sweep: unknown, never confirmed'},
   retestDay:'both first M1 touches must share the same Europe/Berlin calendar date; formation may be earlier',
   priceGap:{XAUUSD:2,unit:'USD per fine troy ounce',GBPUSD:null,EURUSD:null,
    formula:'Long max(0,OB2.bottom-OB1.top); Short max(0,OB1.bottom-OB2.top)',
    selection:'latest matching partner satisfying all policies; older eligible partners may replace a rejected latest partner',
    overlap:'overlap and touch allowed; directional orderflow remains mandatory'},
   stop:'second M5 OB far edge while a pre-existing internal M1 FVG is open at entry; otherwise the retest extreme (short highest high, long lowest low of non-ignored closed M1 candles from the contact candle through the entry candle, no buffer); a partially overlapping open FVG stays unknown (no entry)',target:'2R price risk without commission',variants:'a and b independently'},
  footprint,references};
 const directory=new URL('../analysis/dob/',import.meta.url);
 await mkdir(directory,{recursive:true});
 await writeFile(new URL('reference-diagnostics.json',directory),`${JSON.stringify(report,null,2)}\n`);
 console.log(`DOB diagnostic ${report.version}: ${references.filter(r=>r.recognized).length}/${references.length} historical references recognized, ${footprint.reduce((sum,row)=>sum+row.pairCount,0)} total candidate pairs.`);
}finally{await server.close();}
