import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {simulationRunInputs,simulationRunInputsLabel,runNewsStatus} from '../src/simulationRunInputs.js';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
it('freezes actual configuration and distinguishes incomplete, absent and unsupported news',()=>{
  const news=[{currency:'USD',eventTime:200},{currency:'JPY',eventTime:250},{currency:'GBP',eventTime:999}];
  expect(runNewsStatus('GBPUSD',news,100,300)).toBe('loaded-incomplete');
  expect(runNewsStatus('GBPUSD',news,300,400)).toBe('none');
  expect(runNewsStatus('XXX',news,100,300)).toBe('unsupported');
  const config={instrument:'GBPUSD',sessions:[{label:'X'}],tradingWindows:{weekday:[[0,60]]},news,setupVersion:'v14',entryPattern:'entry1',costVersion:'cost1'};
  const inputs=simulationRunInputs({configuration:{instruments:[config]},from:100,to:300,fetchedAt:400,sourceHash:'source',sourceCommit:'commit',hash});
  expect(inputs.instruments[0]).toMatchObject({sessions:config.sessions,tradingWindows:config.tradingWindows,news:{count:1,first:200,last:200,status:'loaded-incomplete'},versions:{setupVersion:'v14',entryPattern:'entry1',costVersion:'cost1'}});
  expect(inputs.instruments[0].news.windowHash).toBe(hash([news[0]]));
  expect(inputs.instruments[0].news.inputHash).toBe(hash(news));
  expect(simulationRunInputsLabel({provenance:{inputs}})).toContain('Vollständigkeit unbelegt');
  expect(simulationRunInputsLabel({})).toBe('Eingaben nicht festgehalten');
});
