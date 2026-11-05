import { accountBridge, activeMt5Account, checked, mt5Database } from './mt5Credentials.ts';
import { executionConfig, createExecutionOrder } from './mt5Execution.ts';
import { validateWorkerSnapshot } from './executionContract.js';
import { buildMarketPreview, buildEntrySearchPreview, signMarketPreview, verifyMarketPreview } from './marketPreviewContract.js';

export async function marketPreviewAction(body:Record<string,any>) {
  const now=Math.floor(Date.now()/1000);
  const key=Deno.env.get('MT5_CREDENTIAL_KEY');
  if(!key) throw new Error('preview_key_missing');
  const secret='mmt-market-preview:'+key;
  const config=await executionConfig(body.account_id);
  if(['preview','search_preview'].includes(body.action)) {
    const bridge=await accountBridge(await activeMt5Account(body.account_id));
    if(!bridge||Date.now()-Date.parse(bridge.heartbeat_at)>15000) throw new Error('bridge_offline');
    const snapshot=validateWorkerSnapshot(bridge.snapshot,{...config,allowLive:true});
    if(body.action==='preview'&&body.order?.risk_mode!=null)throw new Error('invalid_risk_mode');
    const build=body.action==='search_preview'?buildEntrySearchPreview:buildMarketPreview;
    const preview=build(body.order,snapshot,config,now,crypto.randomUUID());
    const account=await activeMt5Account(body.account_id);
    return {preview:{...preview,account_name:account.name},confirmation:await signMarketPreview(preview,secret)};
  }
  if(body.action==='search_abandon') {
    const preview=await verifyMarketPreview(body.confirmation,secret,now,{allowExpired:true});
    if(preview.kind!=='entry_search'||preview.intent.account_login!==config.login||preview.intent.account_server!==config.server)throw new Error('invalid_preview');
    // Die Tombstone-ID verhindert auch bei verspätetem Enqueue einen doppelten Suchauftrag.
    return {order:checked(await mt5Database().rpc('mt5_abandon_order',{new_intent:preview.intent}))};
  }
  if(['confirm','search_confirm'].includes(body.action)) {
    const preview=await verifyMarketPreview(body.confirmation,secret,now);
    if((body.action==='search_confirm')!==(preview.kind==='entry_search')) throw new Error('invalid_preview');
    const {intent}=preview;
    // Nur der private Control-Endpunkt kann eine signierte Vorschau in einen bestaetigten Auftrag umwandeln.
    const {created_sec,...input}=intent;
    return {order:await createExecutionOrder(input,true,body.account_id)};
  }
  throw new Error('unknown_action');
}
