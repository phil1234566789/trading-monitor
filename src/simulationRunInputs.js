import { newsEventsForInstrument, supportsNewsInstrument } from './newsEventRules.js';

export const RUN_INPUTS_VERSION='run-inputs-v1';
export const RUN_NEWS_LABELS={'loaded-incomplete':'Geladen · Vollständigkeit unbelegt',none:'Keine Termine vorhanden',unsupported:'Instrument nicht unterstützt'};
export function runNewsStatus(instrument,news,from,to) {
  if(!supportsNewsInstrument(instrument))return 'unsupported';
  return newsEventsForInstrument(news,instrument).some(e=>e.eventTime>=from && e.eventTime<to) ? 'loaded-incomplete' : 'none';
}
export function simulationRunInputs({configuration,from,to,fetchedAt,sourceHash,sourceCommit,inputSetId=null,hash}) {
  return {version:RUN_INPUTS_VERSION,fetchedAt,sourceHash,sourceCommit,inputSetId,
    instruments:configuration.instruments.map(config=>{
      const relevant=newsEventsForInstrument(config.news ?? [],config.instrument);
      const window=relevant.filter(e=>e.eventTime>=from && e.eventTime<to);
      return {instrument:config.instrument,sessions:config.sessions,tradingWindows:config.tradingWindows,
        news:{status:runNewsStatus(config.instrument,relevant,from,to),count:window.length,from,to,
          first:window.length?Math.min(...window.map(e=>e.eventTime)):null,last:window.length?Math.max(...window.map(e=>e.eventTime)):null,
          windowHash:hash(window),inputHash:hash(config.news ?? [])},
        configurationHash:hash(config),versions:Object.fromEntries(['setupVersion','entryModel','dealingRangeVersion','costVersion','observationRuleVersion','simulationVersion'].map(key=>[key,config[key] ?? null]))};
    })};
}
export function simulationRunInputsLabel(run) {
  const inputs=run?.provenance?.inputs;
  return inputs?.version===RUN_INPUTS_VERSION ? inputs.instruments.map(i=>`${i.instrument} News: ${RUN_NEWS_LABELS[i.news.status] ?? 'Ladestatus unbekannt'} (${i.news.count})`).join(' · ') : 'Eingaben nicht festgehalten';
}
