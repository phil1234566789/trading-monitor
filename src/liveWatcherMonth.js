import { berlinDateStrFor, berlinDayRangeUtcMs } from './berlinTime.js';
import { fetchAllRows } from './dbReadPaging.js';

export const LIVE_MONTH_PREFIX = 'live-watcher:';
export const isLiveWatcherMonth = id => /^live-watcher:\d{4}-\d{2}$/.test(id ?? '');
export function liveMonthBounds(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Ungültiger Live-Monat');
  const [year, number] = month.split('-').map(Number);
  const next = `${year + (number === 12 ? 1 : 0)}-${String(number === 12 ? 1 : number + 1).padStart(2,'0')}`;
  return {from: new Date(berlinDayRangeUtcMs(`${month}-01`).startUtcMs).toISOString(),
    to: new Date(berlinDayRangeUtcMs(`${next}-01`).startUtcMs).toISOString()};
}
export function liveMonthOptions(firstSignal, now = Date.now()) {
  const current = berlinDateStrFor(now / 1000).slice(0,7);
  let month = firstSignal ? berlinDateStrFor(Date.parse(firstSignal)/1000).slice(0,7) : current;
  const months = [];
  while (month <= current) {
    const [y,m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(y,m-1,15));
    months.unshift({id:LIVE_MONTH_PREFIX+month,label:`Live-Watcher · ${new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'Europe/Berlin'}).format(date)}`});
    month = `${y+(m===12?1:0)}-${String(m===12?1:m+1).padStart(2,'0')}`;
  }
  return months;
}
export function liveMonthGroups(events, month, instrument = '') {
  const {from,to} = liveMonthBounds(month), groups = new Map(), seen = new Set();
  for (const event of events) {
    if (event.kind !== 'trading' || !event.setup_key || ![1,2,3].includes(event.stage)
      || Date.parse(event.signal_at)<Date.parse(from) || Date.parse(event.signal_at)>=Date.parse(to)
      || instrument && event.instrument!==instrument) continue;
    const key = `${event.instrument}:${event.setup_key}`;
    if (!groups.has(key)) groups.set(key,{key,setupKey:event.setup_key,instrument:event.instrument,direction:event.direction,events:[],entries:[]});
    const group = groups.get(key); group.events.push(event);
    const entry = event.payload?.entry;
    // Alarmstufen und SL-Varianten sind keine zusätzlichen Entries.
    if(event.stage===3 && entry?.id && !seen.has(entry.id)) {seen.add(entry.id);group.entries.push(event);}
  }
  return [...groups.values()].map(g=>({...g,entries:g.entries.toSorted((a,b)=>b.payload.entry.recognizedAt-a.payload.entry.recognizedAt)}))
    .sort((a,b)=>Math.max(...b.events.map(e=>Date.parse(e.signal_at)))-Math.max(...a.events.map(e=>Date.parse(e.signal_at))));
}
export function createLiveWatcherRepository(client) {
  return {
    async months() {
      const {data,error}=await client.from('setup2_alarm_events').select('signal_at').eq('kind','trading').gt('stage',0).order('signal_at').limit(1);
      if(error) throw error;
      return liveMonthOptions(data?.[0]?.signal_at);
    },
    async events(month) {
      const {from,to}=liveMonthBounds(month);
      const {data,error}=await fetchAllRows((start,end)=>client.from('setup2_alarm_events')
        .select('id,signal_at,detected_at,instrument,stage,setup_key,direction,kind,payload,missed_reason')
        .eq('kind','trading').gt('stage',0).gte('signal_at',from).lt('signal_at',to)
        .order('signal_at').order('id').range(start,end));
      if(error) throw error;
      return data;
    },
    async event(id) {
      const {data,error}=await client.from('setup2_alarm_events').select('id,signal_at,detected_at,instrument,stage,setup_key,direction,kind,payload,missed_reason').eq('id',id).eq('kind','trading').eq('stage',3).maybeSingle();
      if(error)throw error;
      return data;
    }
  };
}
export const liveEntryLink = event => ({path:'/live-watcher-entry',query:{event:event.id}});
