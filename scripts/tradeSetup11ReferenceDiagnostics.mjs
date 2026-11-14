import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
try {
 const {fixture,nativeInput,nativeSetupFor,expectedFor}=await server.ssrLoadModule('/test/helpers/tradeSetup11NativeFixture.js');
 const {filterTradeSetup11Candidates,TRADE_SETUP_11_VERSION}=await server.ssrLoadModule('/src/tradeSetup11.js');
 const {tradeSetupFromRow}=await server.ssrLoadModule('/src/tradeSetupRow.js');
 const {tradeSetup11SourceTimes}=await server.ssrLoadModule('/src/tradeSetup11Context.js');
 const references=fixture.references.map(ref=>{
  const setup=nativeSetupFor(ref),evaluatedAt=setup.obStartTime+600;
  const result=filterTradeSetup11Candidates({...nativeInput,setups:[setup],evaluatedAt});
  return {pin:ref.pin,originalNote:ref.note,originalExpectation:ref.expectedByUser,
   currentExpectation:expectedFor(ref),expectationOverride:fixture.expectationOverrides?.find(o=>o.pin===ref.pin)??null,
   source:{setupId:ref.row.id,detectorVersion:ref.row.detector_version,configHash:ref.row.config_hash,
    originalLiquidity:{price:ref.row.ls_price,pivotTime:ref.row.ls_pivot_time,touchedTime:ref.row.ls_touched_time},
    canonicalNativeLiquidity:setup.ls,originalDatabaseTimes:tradeSetup11SourceTimes(tradeSetupFromRow(ref.row))},
   assessment:result.assessments[0]};
 });
 const report={version:TRADE_SETUP_11_VERSION,scope:'12 user-selected native TS1 references; no general profitability claim or year scan',
  counts:{total:references.length,passed:references.filter(r=>r.assessment.status==='passed').length,
   unmet:references.filter(r=>r.assessment.status==='unmet').length,unknown:references.filter(r=>r.assessment.status==='unknown').length},
  fixtureHashes:fixture.hashes,settings:fixture.settings,settingsProvenance:fixture.settingsProvenance,
  rules:{root:'D1-root trend is an anchor, never a directional gate',current:'Innermost confirmed nested range; existing causal close-CHoCH can establish first child if no confirmed inner chain exists',
   source:'Exact native pivot identity, causal deepest range at level birth or explicit boundary/protected membership before its sweep',
   unknown:'Missing anchor/history, source first-seen in future or unconfirmed/malformed source remains unknown',
   excludedHypotheses:['No R0b/R2 directional alignment gate','No fixed depth, age or preliminary-phase gate'],
   timestampIntegrity:'Native geometry time and original DB first-seen remain distinct; pin481 original note preserved plus explicit user override',
   sourceIntegrity:'Pin485 old DB14:00 timestamp preserved; native TS1 detector yields canonical14:10 through existing natural-key live precedence, no price-only alias'},references};
 const directory=new URL('../analysis/ts11/',import.meta.url);await mkdir(directory,{recursive:true});
 await writeFile(new URL('reference-diagnostics.json',directory),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({version:report.version,counts:report.counts,cases:references.map(r=>({pin:r.pin,expected:r.currentExpectation,status:r.assessment.status,reason:r.assessment.reason,ownerBasis:r.assessment.trendEvidence.sourceOwner?.basis??null}))},null,2));
} finally {await server.close();}
