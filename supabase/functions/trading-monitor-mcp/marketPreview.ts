import { activeMt5Account, checked, mt5Database } from './mt5Credentials.ts';
import { executionConfig, createExecutionOrder } from './mt5Execution.ts';
import { validateWorkerSnapshot } from './executionContract.js';
import { buildMarketPreview, buildEntrySearchPreview, signMarketPreview, verifyMarketPreview } from './marketPreviewContract.js';

export async function marketPreviewAction(body:Record<string,any>) {
  const now=Math.floor(Date.now()/1000);
  const key=Deno.env.get('MT5_CREDENTIAL_KEY');
  if(!key) throw new Error('preview_key_missing');
  const secret='mmt-market-preview:'+key;
  const config=await executionConfig();
  if(['preview','search_preview'].includes(body.action)) {
    const bridge=checked(await mt5Database().from('mt5_bridge_state').select('*').eq('id','primary').maybeSingle());
    if(!bridge||Date.now()-Date.parse(bridge.heartbeat_at)>15000) throw new Error('bridge_offline');
    const snapshot=validateWorkerSnapshot(bridge.snapshot,{...config,allowLive:true});
    const build=body.action==='search_preview'?buildEntrySearchPreview:buildMarketPreview;
    const preview=build(body.order,snapshot,config,now,crypto.randomUUID());
    const account=await activeMt5Account();
    return {preview:{...preview,account_name:account.name},confirmation:await signMarketPreview(preview,secret)};
  }
  if(['confirm','search_confirm'].includes(body.action)) {
    const preview=await verifyMarketPreview(body.confirmation,secret,now);
    if((body.action==='search_confirm')!==(preview.kind==='entry_search')) throw new Error('invalid_preview');
    const {intent}=preview;
    // Nur der private Control-Endpunkt kann eine signierte Vorschau in einen bestaetigten Auftrag umwandeln.
    const {created_sec,...input}=intent;
    return {order:await createExecutionOrder(input,true)};
  }
  throw new Error('unknown_action');
}
