import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=new URL('../test/fixtures/dob-native/references.json',import.meta.url);
const text=await readFile(source,'utf8'),manifest=JSON.parse(text),days=new Map(),unrestrictedDays=new Map(),footprint=[];
const previous=JSON.parse(await readFile(new URL('../analysis/dob/reference-diagnostics.json',import.meta.url),'utf8'));
const previousPolicy=previous.version.endsWith('v3')?{version:previous.version,previousPolicy:previous.previousPolicy,
 footprint:previous.footprint.map(({day,pairCount})=>({day,pairCount}))}:previous.previousPolicy;
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
try{
 const {detectDoubleOrderBlocks,DOUBLE_ORDER_BLOCK_VERSION}=await server.ssrLoadModule('/src/doubleOrderBlocks.js');
 const {evaluateDoubleOrderBlockDepth}=await server.ssrLoadModule('/src/doubleOrderBlockDepth.js');
 for(const day of manifest.days){
  const fixture=JSON.parse(await readFile(new URL(`../test/fixtures/dob-native/${day}.json`,import.meta.url),'utf8'));
  const result=detectDoubleOrderBlocks({instrument:manifest.instrument,m5Candles:fixture.candles.m5,
   m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to});
  const unrestricted=detectDoubleOrderBlocks({instrument:manifest.instrument,m5Candles:fixture.candles.m5,
   m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to,maxRetestDepthFraction:1});
  unrestrictedDays.set(day,unrestricted);
  const priorIds=new Set(unrestricted.pairs.map(pair=>pair.id));
  days.set(day,result);footprint.push({day,pairCount:result.pairs.length,withoutDepthLimitPairCount:unrestricted.pairs.length,
   olderQualifyingReplacementPairs:result.pairs.filter(pair=>!priorIds.has(pair.id)).length,...result.stats});
 }
 const references=manifest.pairs.map(pair=>{
  const [a,b]=pair.pins.map(pin=>manifest.references.find(ref=>ref.pin===pin));
  const match=dob=>dob.firstOrderBlock.startTime===a.startTime&&dob.secondOrderBlock.startTime===b.startTime;
  const confirmed=days.get(a.day).pairs.find(match),found=confirmed??unrestrictedDays.get(a.day).pairs.find(match);
  if(!found)throw new Error(`Reference geometry unavailable ${pair.id}`);
  const depth=evaluateDoubleOrderBlockDepth(found.firstPenetration,found.secondPenetration);
  return {reference:pair.id,pins:pair.pins,day:a.day,recognized:!!confirmed,rejectionReason:confirmed?null:depth.reason,
   direction:found.direction,recognizedAt:confirmed?found.recognizedAt:null,historicalConfirmationAt:found.recognizedAt,
   firstRetest:found.firstRetest.candleTime,firstReaction:found.firstReaction.recognizedAt,
   secondRetest:found.secondRetest.candleTime,secondReaction:found.secondReaction.recognizedAt,
   firstM5ReactionKnownAt:found.firstM5ReactionKnownAt,
   firstPenetration:found.firstPenetration,secondPenetration:found.secondPenetration,firstRetestHold:found.firstRetestHold,entries:found.entries};
 });
 const report={version:DOUBLE_ORDER_BLOCK_VERSION,scope:'16 selected positive examples; no general win-rate or trading approval',
  nativeManifestSha256:createHash('sha256').update(text).digest('hex'),sourceBaseline:manifest.codeBaseline,
  previousPolicy,policy:{reaction:'first positive M1 FVG after first valid mitigation',
   pairing:'latest matching first reaction before second retest; simultaneous overlapping partners retained',
   retestDepth:{appliesTo:'both OBs independently',maximumFraction:.5,window:'each first M1 retest through its own first reaction FVG close inclusive',
    unknown:'not confirmed',selection:'latest depth-and-hold-qualified matching first reaction; older qualifying partners may replace a rejected latest partner'},
   firstRetestHold:{anchor:'fixed first-retest through first-reaction M1 extreme',from:'first reaction knownAt',
    through:'second reaction knownAt inclusive',sweep:'strict low below anchor long / strict high above anchor short; equality passes',
    coverage:'missing or ignored M1 before a decisive sweep: unknown, never confirmed'},
   retestDay:'both first M1 touches must share the same Europe/Berlin calendar date; formation may be earlier',
   stop:'selected second M5 OB outside edge',target:'2R price risk without commission',variants:'a and b independently'},
  footprint,references};
 const directory=new URL('../analysis/dob/',import.meta.url);
 await mkdir(directory,{recursive:true});
 await writeFile(new URL('reference-diagnostics.json',directory),`${JSON.stringify(report,null,2)}\n`);
 console.log(`DOB diagnostic ${report.version}: ${references.filter(r=>r.recognized).length}/${references.length} historical references recognized, ${footprint.reduce((sum,row)=>sum+row.pairCount,0)} total candidate pairs.`);
}finally{await server.close();}
