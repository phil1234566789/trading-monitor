import { describe, it, expect } from 'vitest';
import { evaluateChecklistNews } from '../src/tradeSetupChecklistNews.js';
const eventTime = Date.parse('2026-09-09T14:30:00+02:00') / 1000;
const event = { eventTime, currency: 'USD', title: 'CPI' };
const input = { instrument: 'GBPUSD', evaluatedAt: eventTime, news: [event], newsLoadStatus: 'ready' };
describe('Checklist-News', () => {
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
    expect(evaluateChecklistNews({...input,instrument:'XAUUSD'}).status).toBe('unknown');
  });
  it('priorisiert weitere Sperren vor bereits vergangenen News und zeigt Berlin-Warteende', () => {
    const result = evaluateChecklistNews({...input,news:[{...event,eventTime:eventTime-3600},event]});
    expect(result).toMatchObject({status:'blocked',label:'News – Wartezeit'});
    expect(result.details).toEqual(['bis 14:45 Uhr']);
  });
});
