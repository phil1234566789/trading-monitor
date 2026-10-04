import { describe, it, expect } from 'vitest';
import { evaluateChecklistNews } from '../src/tradeSetupChecklistNews.js';
import { evaluateChecklistTime } from '../src/tradeSetupChecklistTime.js';
import { createSetup2Entry } from '../src/tradeSetup2EntryGate.js';
const eventTime = Date.parse('2026-09-09T14:30:00+02:00') / 1000;
const event = { eventTime, currency: 'USD', title: 'CPI' };
const input = { instrument: 'GBPUSD', evaluatedAt: eventTime, news: [event], newsLoadStatus: 'ready' };
describe('Checklist-News', () => {
  it.each([[-1801,'passed'],[-1800,'blocked'],[0,'blocked'],[899,'blocked'],[900,'passed']])
    ('applies USD news to gold checklist and entry time gate at %s', (offset,status) => {
      const args = { ...input, instrument: 'XAUUSD', news: [{...event,eventTime:eventTime+1800}], evaluatedAt: eventTime + 1800 + offset };
      expect(evaluateChecklistNews(args).status).toBe(status);
      expect(evaluateChecklistTime({ ...args, sessions: [],
        tradingWindows: { weekday: [[840,1080]], saturday: [], sunday: [] } }).status).toBe(status);
    });
  it('keeps gold hours and calendar coverage independent from USD relevance', () => {
    const args = { ...input, instrument: 'XAUUSD' };
    expect(evaluateChecklistNews({ ...args, news: [{...event,currency:'EUR'}, {...event,currency:'GBP'}] }).status).toBe('passed');
    expect(evaluateChecklistNews({ ...args, news: [], newsLoadStatus: 'unknown' }).status).toBe('unknown');
    expect(evaluateChecklistNews({ ...args, newsLoadStatus: 'unknown' }).status).toBe('blocked');
    expect(evaluateChecklistTime({ ...args, evaluatedAt: eventTime + 12600, sessions: [],
      tradingWindows: { weekday: [[840,1080]], saturday: [], sunday: [] } }))
      .toMatchObject({ status: 'blocked', outsideTradingHours: true });
  });
  it('blocks gold entries in the shared live and replay entry gate only for USD news', () => {
    const args = { ...input, instrument: 'XAUUSD', sessionConfigs: [],
      tradingWindows: { weekday: [[840,1080]], saturday: [], sunday: [] } };
    const create = () => ({ entry: true });
    expect(createSetup2Entry(args, create)).toBeNull();
    expect(createSetup2Entry({...args,news:[{...event,currency:'EUR'}]}, create))
      .toMatchObject({entry:true,entryEligibility:{status:'passed'}});
  });
  it.each([[-1801,'passed','Keine News'],[-1800,'blocked','News bevorstehend'],[0,'blocked','News – Wartezeit'],[899,'blocked','News – Wartezeit'],[900,'passed','News vorbei']])('Grenze %s', (offset,status,label) => {
    expect(evaluateChecklistNews({ ...input, evaluatedAt: eventTime + offset })).toMatchObject({status,label});
  });
  it.each([undefined,'loading','error'])('gibt ohne fertigen Kalender kein Grün (%s)', newsLoadStatus => {
    expect(evaluateChecklistNews({ ...input, news: [], newsLoadStatus }).status).toBe('unknown');
  });
  it('bestätigt leere Kalender und trennt alte/fremde Events vom heutigen vorbei', () => {
    for (const news of [[], [{...event,eventTime:eventTime-86400}], [{...event,currency:'EUR'}]]) {
      expect(evaluateChecklistNews({...input,news})).toMatchObject({status:'passed',label:'Keine News'});
    }
    expect(evaluateChecklistNews({...input,news:undefined}).status).toBe('unknown');
    expect(evaluateChecklistNews({...input,instrument:'UNKNOWN'}).status).toBe('unknown');
  });
  it('priorisiert weitere Sperren vor bereits vergangenen News und zeigt Berlin-Warteende', () => {
    const result = evaluateChecklistNews({...input,news:[{...event,eventTime:eventTime-3600},event]});
    expect(result).toMatchObject({status:'blocked',label:'News – Wartezeit'});
    expect(result.details).toEqual(['bis 14:45 Uhr']);
  });
});
