import {expect,it,vi} from 'vitest';

const db=vi.hoisted(()=>({selection:''}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{from(){
  const query={select(fields){db.selection=fields;return query;},eq(){return query;},order(){return query;},limit(){return query;},
    then(resolve){return Promise.resolve({data:[{id:7,direction:'long',source:'live',detector_version:'historical-ts1',config_hash:'original-config',input_set_id:'original-input'}],error:null}).then(resolve);}};
  return query;
}}}));
import {fetchTradeSetups} from '../src/tradeSetups.js';

it('loads original source provenance for a separate LS-Reaktion policy evaluation',async()=>{
  const [setup]=await fetchTradeSetups('XAUUSD');
  for(const field of ['source','detector_version','config_hash','input_set_id'])expect(db.selection.split(/,\s*/)).toContain(field);
  expect(setup).toMatchObject({tradeSetupId:7,source:'live',detectorVersion:'historical-ts1',configHash:'original-config',inputSetId:'original-input'});
});
