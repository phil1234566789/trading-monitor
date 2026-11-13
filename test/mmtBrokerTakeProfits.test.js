import {expect,it,vi} from 'vitest';
import {effectScope,ref,nextTick} from 'vue';
import {unmanagedBrokerTakeProfits} from '../src/mmtBrokerTakeProfits.js';
import {useBrokerTakeProfitDrawing} from '../src/composables/useBrokerTakeProfitDrawing.js';
vi.mock('../src/chartColors.js',()=>({cssColor:()=> '#26a69a'}));
const account={id:'one',name:'Hauptkonto',login:26781,server:'Demo'};
const position={ticket:3107609,symbol:'XAUUSD.gbe',type:0,tp:3931.69};
const oldOrder={status:'executed',intent:{account_login:26781,account_server:'Demo',symbol:'XAUUSD.gbe',direction:'long'},result:{position:3105690,position_lifecycle:{state:'closed'}}};
it('shows the new manual broker TP after a different MMT position closed without inventing an execution',()=>{
 const lines=unmanagedBrokerTakeProfits([{account,position,online:true}],[oldOrder]);
 expect(lines).toEqual([{id:'one:3107609',instrument:'XAUUSD',price:3931.69,title:'Broker-TP · Hauptkonto · #3107609 · nur Anzeige'}]);
 expect(unmanagedBrokerTakeProfits([], [oldOrder])).toEqual([]);
 expect(unmanagedBrokerTakeProfits([{account,position:{...position,tp:0},online:true}],[])).toEqual([]);
});
it('does not duplicate managed targets or match a different account with the same ticket',()=>{
 const managed={...oldOrder,result:{position:position.ticket}};
 expect(unmanagedBrokerTakeProfits([{account,position,online:true}],[managed])).toEqual([]);
 const other={...account,id:'two',name:'Anderes Konto',login:99};
 const lines=unmanagedBrokerTakeProfits([{account:other,position,online:false}],[managed]);
 expect(lines[0].id).toBe('two:3107609');expect(lines[0].title).toContain('alter Stand');
});
it('removes native read-only lines when the position closes, changes target or the chart changes asset',async()=>{
 const lines=ref(unmanagedBrokerTakeProfits([{account,position,online:true}],[])),symbol=ref('XAUUSD');
 const series={createPriceLine:vi.fn(options=>options),removePriceLine:vi.fn()},scope=effectScope();
 const drawing=scope.run(()=>useBrokerTakeProfitDrawing(()=>lines.value,()=>symbol.value));
 drawing.create(series);
 expect(series.createPriceLine).toHaveBeenLastCalledWith(expect.objectContaining({price:3931.69,title:expect.stringContaining('nur Anzeige')}));
 lines.value=unmanagedBrokerTakeProfits([{account,position:{...position,tp:3940},online:true}],[]);await nextTick();
 expect(series.removePriceLine).toHaveBeenCalledTimes(1);
 expect(series.createPriceLine).toHaveBeenLastCalledWith(expect.objectContaining({price:3940}));
 symbol.value='EURUSD';await nextTick();expect(series.removePriceLine).toHaveBeenCalledTimes(2);
 symbol.value='XAUUSD';await nextTick();
 lines.value=[];await nextTick();expect(series.removePriceLine).toHaveBeenCalledTimes(3);
 scope.stop();
});
