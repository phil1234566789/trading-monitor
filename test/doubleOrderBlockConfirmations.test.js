import {beforeEach,expect,it,vi} from 'vitest';
import {ref} from 'vue';
import {useDoubleOrderBlockConfirmations} from '../src/composables/useDoubleOrderBlockConfirmations.js';
import * as intake from '../src/tradeIntake.js';
vi.mock('../src/tradeIntake.js',()=>({createDealingRange:vi.fn(),addRangeConfirmation:vi.fn(),addConfirmationToTrade:vi.fn()}));
const pair={instrument:'XAUUSD',direction:'long',firstOrderBlock:{dir:1,timeframe:'5M',startTime:100,top:12,bottom:10},secondOrderBlock:{dir:1,timeframe:'5M',startTime:400,top:14,bottom:12}};
const context=()=>({currentSymbol:ref('XAUUSD'),confirmationAddTrade:ref(null),rangeConfirmationAddTrade:ref(null),
  tscBootstrapArmed:ref(true),tscRangeId:ref(null),refreshTscRange:vi.fn().mockResolvedValue(true),refreshTrades:vi.fn().mockResolvedValue(true),getEvidence:()=>[]});
beforeEach(()=>{vi.resetAllMocks();intake.createDealingRange.mockResolvedValue({id:42});intake.addRangeConfirmation.mockResolvedValue(true);intake.addConfirmationToTrade.mockResolvedValue(true);});
it.each([-1,0])('rejects a mixed-direction pair before any journal write (OB2 dir %s)',async dir=>{
  const c=context(),action=useDoubleOrderBlockConfirmations(c);
  await action.save({...pair,secondOrderBlock:{...pair.secondOrderBlock,dir}});
  expect(action.error.value).toContain('Ungültiges DOB-Paar');expect(intake.createDealingRange).not.toHaveBeenCalled();expect(intake.addRangeConfirmation).not.toHaveBeenCalled();
});
it('bootstraps two existing OB confirmations, OB2 first for the existing default invalidation',async()=>{
  const c=context(),a=useDoubleOrderBlockConfirmations(c);await a.save(pair);
  expect(intake.createDealingRange).toHaveBeenCalledWith({instrument:'XAUUSD',direction:'long'});
  expect(intake.addRangeConfirmation.mock.calls.map(([,e])=>e.sourceTime)).toEqual([400,100]);
  expect(intake.addRangeConfirmation).toHaveBeenCalledWith(42,expect.objectContaining({kind:'ob',rangeLow:12,rangeHigh:14,timeframe:'5M',price:12}),'confirmation');
  expect(c.refreshTscRange).toHaveBeenCalled();expect(a.error.value).toBe('');
});
it('refreshes partial evidence and retries only the missing OB',async()=>{
  const c=context(),a=useDoubleOrderBlockConfirmations(c);intake.addRangeConfirmation.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  await a.save(pair);expect(a.error.value).toContain('nicht vollständig');expect(c.refreshTscRange).toHaveBeenCalled();
  c.tscBootstrapArmed.value=false;c.rangeConfirmationAddTrade.value={isTsc:true,dealingRangeId:42};await a.save(pair);
  expect(intake.addRangeConfirmation.mock.calls.map(([,e])=>e.sourceTime)).toEqual([400,100,100]);
  expect(intake.createDealingRange).toHaveBeenCalledTimes(1);
});
it('recognizes already persisted range evidence but never dedupes against position evidence',async()=>{
  const c=context();c.tscBootstrapArmed.value=false;c.rangeConfirmationAddTrade.value={dealingRangeId:42};
  c.getEvidence=()=>[{kind:'ob',timeframe:'5M',sourceTime:400,rangeLow:12,rangeHigh:14,level:'range',category:'confirmation'}];
  await useDoubleOrderBlockConfirmations(c).save(pair);expect(intake.addRangeConfirmation).toHaveBeenCalledTimes(1);
  c.rangeConfirmationAddTrade.value=null;c.confirmationAddTrade.value={id:9,dealingRangeId:42};
  await useDoubleOrderBlockConfirmations(c).save(pair);expect(intake.addConfirmationToTrade).toHaveBeenCalledTimes(2);
});
it('captures symbol and destination, prevents duplicate in-flight clicks and reports refresh failure',async()=>{
  const c=context();let resolve;intake.createDealingRange.mockReturnValue(new Promise(r=>{resolve=r}));
  const a=useDoubleOrderBlockConfirmations(c),pending=a.save(pair);await a.save(pair);c.currentSymbol.value='GBPUSD';resolve({id:42});
  c.refreshTscRange.mockRejectedValue(new Error('offline'));await pending;
  expect(intake.createDealingRange).toHaveBeenCalledTimes(1);expect(c.tscRangeId.value).toBe(null);
  expect(intake.addRangeConfirmation.mock.calls.every(([,e])=>e.instrument==='XAUUSD')).toBe(true);
  expect(a.error.value).toContain('Anzeige');expect(a.saving.value).toBe(false);
});
it('dedupes persisted confirmations after remount and permits re-adding evidence deliberately removed later',async()=>{
  const c=context();c.tscBootstrapArmed.value=false;c.rangeConfirmationAddTrade.value={isTsc:true,dealingRangeId:42};
  let existing=[pair.firstOrderBlock,pair.secondOrderBlock].map(ob=>({kind:'ob',category:'confirmation',level:'range',timeframe:'5M',sourceTime:ob.startTime,rangeLow:ob.bottom,rangeHigh:ob.top}));
  c.getEvidence=()=>existing;
  const a=useDoubleOrderBlockConfirmations(c);await a.save(pair);expect(intake.addRangeConfirmation).not.toHaveBeenCalled();
  existing=[];c.rangeConfirmationAddTrade.value={isTsc:true,dealingRangeId:42};await a.save(pair);
  expect(intake.addRangeConfirmation).toHaveBeenCalledTimes(2);
});
