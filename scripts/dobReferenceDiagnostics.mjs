import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=new URL('../test/fixtures/dob-native/references.json',import.meta.url);
const text=await readFile(source,'utf8'),manifest=JSON.parse(text),days=new Map(),footprint=[];
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
try{
 const {detectDoubleOrderBlocks,DOUBLE_ORDER_BLOCK_VERSION}=await server.ssrLoadModule('/src/doubleOrderBlocks.js');
 for(const day of manifest.days){
  const fixture=JSON.parse(await readFile(new URL(`../test/fixtures/dob-native/${day}.json`,import.meta.url),'utf8'));
  const result=detectDoubleOrderBlocks({instrument:manifest.instrument,m5Candles:fixture.candles.m5,
   m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to});
  days.set(day,result);footprint.push({day,pairCount:result.pairs.length,...result.stats});
 }
 const references=manifest.pairs.map(pair=>{
  const [a,b]=pair.pins.map(pin=>manifest.references.find(ref=>ref.pin===pin));
  const found=days.get(a.day).pairs.find(dob=>dob.firstOrderBlock.startTime===a.startTime&&dob.secondOrderBlock.startTime===b.startTime);
  if(!found)throw new Error(`Missing reference ${pair.id}`);
  return {reference:pair.id,pins:pair.pins,day:a.day,direction:found.direction,recognizedAt:found.recognizedAt,
   firstRetest:found.firstRetest.candleTime,firstReaction:found.firstReaction.recognizedAt,
   secondRetest:found.secondRetest.candleTime,secondReaction:found.secondReaction.recognizedAt,
   firstM5ReactionKnownAt:found.firstM5ReactionKnownAt,
   firstPenetration:found.firstPenetration,secondPenetration:found.secondPenetration,entries:found.entries};
 });
 const report={version:DOUBLE_ORDER_BLOCK_VERSION,scope:'16 selected positive examples; no general win-rate or trading approval',
  nativeManifestSha256:createHash('sha256').update(text).digest('hex'),sourceBaseline:manifest.codeBaseline,
  policy:{reaction:'first positive M1 FVG after first valid mitigation',
   pairing:'latest matching first reaction before second retest; simultaneous overlapping partners retained',
   stop:'selected second M5 OB outside edge',target:'2R price risk without commission',variants:'a and b independently'},
  footprint,references};
 const directory=new URL('../analysis/dob/',import.meta.url);
 await mkdir(directory,{recursive:true});
 await writeFile(new URL('reference-diagnostics.json',directory),`${JSON.stringify(report,null,2)}\n`);
 console.log(`DOB diagnostic ${report.version}: ${references.length} selected references, ${footprint.reduce((sum,row)=>sum+row.pairCount,0)} total candidate pairs.`);
}finally{await server.close();}
