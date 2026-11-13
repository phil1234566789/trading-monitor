import {expect,it,vi} from 'vitest';
import {effectScope,ref,nextTick} from 'vue';
import {projectBrokerPositions,brokerPositionLines} from '../src/mmtBrokerPositions.js';
import {useBrokerPositionDrawing} from '../src/composables/useBrokerPositionDrawing.js';
import {setTargetDraft,removeTargetDraft} from '../src/mmtTargetDrafts.js';
import {nativeTargetKey} from '../src/mmtTargetSave.js';
vi.mock('../src/chartColors.js',()=>({cssColor:key=>key}));
const account={id:'one',name:'Hauptkonto',login:26781,server:'Demo'};
const position={ticket:3107609,symbol:'XAUUSD.gbe',type:0,tp:3922.38,sl:3893.49,price_open:3895.87,volume:.7,magic:0,opened_at_sec:100};
const oldOrder={id:'old',status:'executed',intent:{account_login:26781,account_server:'Demo',symbol:'XAUUSD.gbe',direction:'long'},result:{position:3105690,position_lifecycle:{state:'closed'}}};
const project=(p=position,orders=[])=>projectBrokerPositions([{account,position:p,online:true}],orders);
it('synchronizes the whole reopened native position without inventing execution or initial stop',()=>{
 const rows=project(position,[oldOrder]);
 expect(rows[0]).toMatchObject({id:'one:3107609',entryPrice:3895.87,stopLoss:3893.49,takeProfit:3922.38,volume:.7,managedOrderId:undefined});
 expect(rows[0]).not.toHaveProperty('initialSl');
 expect(brokerPositionLines(rows[0]).map(line=>line.price)).toEqual([3895.87,3893.49,3922.38]);
 expect(projectBrokerPositions([], [oldOrder])).toEqual([]);
 const changed=project({...position,sl:3896,tp:3940})[0];
 expect(brokerPositionLines(changed).map(line=>line.price)).toEqual([3895.87,3896,3940]);
});
it('also projects managed positions with actual SL and keeps identical tickets on other accounts separate',()=>{
 const managed={...oldOrder,id:'managed',result:{position:position.ticket}};
 expect(project(position,[managed])[0]).toMatchObject({managedOrderId:'managed',stopLoss:3893.49});
 const other={...account,id:'two',name:'Anderes Konto',login:99};
 const row=projectBrokerPositions([{account:other,position,online:false}],[managed])[0];
 expect(row.id).toBe('two:3107609');expect(row.managedOrderId).toBeUndefined();
 expect(brokerPositionLines(row)[0].title).toContain('Anderes Konto · #3107609 · 0,7 Lot · alter Stand');
});
it('never fabricates a missing SL, TP or entry price',()=>{
 expect(brokerPositionLines(project({...position,sl:0,tp:0})[0]).map(line=>line.price)).toEqual([3895.87]);
 expect(brokerPositionLines(project({...position,sl:0,tp:0,price_open:undefined})[0])).toEqual([]);
});
it('deduplicates only a saved matching TP for the exact position and keeps actual TP visible during editing',async()=>{
 const positions=ref(project()),symbol=ref('XAUUSD'),key=nativeTargetKey(account.id,position.ticket);
 const series={createPriceLine:vi.fn(options=>options),removePriceLine:vi.fn()},scope=effectScope();
 try{
  const drawing=scope.run(()=>useBrokerPositionDrawing(()=>positions.value,()=>symbol.value));drawing.create(series);
  setTargetDraft(key,{symbol:'XAUUSD',positionId:position.ticket,positionVolume:.7,targets:[{price:position.tp,volume:.7}],dirty:false});await nextTick();
  expect(series.createPriceLine.mock.calls.slice(-2).map(call=>call[0].price)).toEqual([position.price_open,position.sl]);
  setTargetDraft(key,{symbol:'XAUUSD',positionId:position.ticket,positionVolume:.7,targets:[{price:3940,volume:.7}],dirty:true});await nextTick();
  expect(series.createPriceLine).toHaveBeenLastCalledWith(expect.objectContaining({price:position.tp}));
 }finally{scope.stop();removeTargetDraft(key);}
});
it('replaces all native levels after changes, close/reopen, asset switches and disposal',async()=>{
 const positions=ref(project()),symbol=ref('XAUUSD');
 const series={createPriceLine:vi.fn(options=>options),removePriceLine:vi.fn()},scope=effectScope();
 const drawing=scope.run(()=>useBrokerPositionDrawing(()=>positions.value,()=>symbol.value));
 drawing.create(series);expect(series.createPriceLine).toHaveBeenCalledTimes(3);
 positions.value=project({...position,ticket:42,sl:3900,tp:3940});await nextTick();
 expect(series.removePriceLine).toHaveBeenCalledTimes(3);
 expect(series.createPriceLine).toHaveBeenLastCalledWith(expect.objectContaining({price:3940,title:expect.stringContaining('#42')}));
 symbol.value='EURUSD';await nextTick();expect(series.removePriceLine).toHaveBeenCalledTimes(6);
 symbol.value='XAUUSD';await nextTick();
 positions.value=[];await nextTick();expect(series.removePriceLine).toHaveBeenCalledTimes(9);
 scope.stop();
});
