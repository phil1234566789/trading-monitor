import {describe,it,expect} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
import Controls from '../src/components/MmtTargetChartControls.vue';
import {stopChoiceLabel,stopPreviewReason} from '../src/mmtExitPresentation.js';

const base={orderId:'position',index:0,kind:'stop',price:1997.75,accountLabel:'Konto 2',positionId:123,percent:50,totalPercent:100,targetCount:2,selected:true,dirty:true,y:30,lineY:30,right:0,showSave:true,saveState:{disabled:false,cancelDisabled:false,status:'Ungespeichert'},forecast:{estimatedNet:-115,rr:-1,currency:'USD'}};
const render=(rows,props={})=>renderToString(createSSRApp(Controls,{rows,...props}));

describe('shared chart SL/TP controls',()=>{
 it('renders SL split/share/move and net loss with the common Save and Cancel controls',async()=>{
  const html=await render([base]);
  expect(html).toContain('SL1');expect(html).toContain('SL 1 teilen');expect(html).toContain('SL 1 verschieben');
  expect(html).toContain('SL 1 Anteil 50 Prozent ändern');expect(html).toContain('Netto ≈ -$115.00');expect(html).toContain('-1.00R');
  expect(html).toContain('Speichern');expect(html).toContain('Abbrechen');expect(html).not.toContain('undefined');
 });
 it('hides the toolbar only for a healthy unchanged plan',async()=>{
  const html=await render([{...base,dirty:false,saveState:{disabled:true,cancelDisabled:false,unchanged:true,status:'Keine Änderungen',reason:'Keine ungespeicherten Änderungen.'}}]);
  expect(html).not.toContain('tp-savebar');expect(html).not.toContain('Speichern');expect(html).not.toContain('Abbrechen');expect(html).not.toContain('Keine Änderungen');
 });
 it('keeps cancel reachable during a drag even before the first changed price',async()=>{
  const html=await render([{...base,dirty:false,saveState:{disabled:true,cancelDisabled:false,unchanged:true,status:'Keine Änderungen'}}],{dragging:true});
  expect(html).toContain('Abbrechen');expect(html).toContain('tp-savebar');
 });
 it('keeps disabled save, available cancel and the failure visible on an invalid dirty draft',async()=>{
  const html=await render([{...base,saveState:{disabled:true,cancelDisabled:false,unchanged:false,status:'Ungespeichert · Fehler: Broker nicht verbunden',reason:'Broker nicht verbunden'}}]);
  expect(html).toContain('Speichern');expect(html).toContain('Abbrechen');expect(html).toContain('Broker nicht verbunden');
 });
 it('does not hide a clean plan when its worker or saved status is unavailable',async()=>{
  const html=await render([{...base,dirty:false,saveState:{disabled:true,cancelDisabled:true,unchanged:false,status:'Statusfehler: Netzwerk',reason:'Worker nicht verbunden',cancelReason:'Status ungeklärt'}}]);
  expect(html).toContain('Speichern');expect(html).toContain('Abbrechen');expect(html).toContain('Statusfehler: Netzwerk');expect(html).toContain('Worker nicht verbunden');
 });
 it('keeps TP controls and gains distinct from stop controls at the same index',async()=>{
  const html=await render([base,{...base,kind:'target',price:2020,forecast:{estimatedNet:995,rr:8,currency:'USD'}}]);
  expect(html).toContain('position:stop:0');expect(html).toContain('position:target:0');
  expect(html).toContain('TP 1 teilen');expect(html).toContain('Netto ≈ $995.00');
 });
 it('offers only the two risk choices at an unprotected entry and makes clamps visible',async()=>{
  const row={...base,kind:'entry',index:-1,canAddStop:true,showSave:false,stopPreviews:{risky:{price:1997,budget:{allocation:200,cost_buffer:25,effective_percent:.4}},full:{error:'risk_budget_exhausted'}}};
  const html=await render([row]);
  expect(html).toContain('SL 0,5 → 0,4 %');expect(html).toContain('SL 0,9 %');expect(html).not.toContain('Entry 0 teilen');
  expect(html).not.toContain('Speichern');expect(html).toContain('Kein freies Markt-/Tages-/Drawdownbudget.');
 });
 it('keeps unknown costs honest without hiding an available R value',async()=>{
  const html=await render([{...base,forecast:{estimatedNet:null,rr:2,currency:'USD'}}]);
  expect(html).toContain('Netto —');expect(html).toContain('+2.00R');expect(html).not.toContain('$0.00');
 });
 it('shows preset limits separately from the cost reserve',()=>{
  expect(stopChoiceLabel('risky',{budget:{effective_percent:.5}})).toBe('SL 0,5 %');
  expect(stopPreviewReason({budget:{allocation:250,cost_buffer:25}})).toContain('$250.00 Risikobudget einschließlich $25.00');
 });
});
