import {it,expect} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
import Status from '../src/components/MmtDailyStopStatus.vue';
const now=Date.now(),status={online:true,bridge:{heartbeat_at:new Date(now).toISOString()},daily_stop:{daily_stop_ready:true,latched:false,commands:[]}};
it('does not display a stale or offline worker as a current daily guard',async()=>{
 expect(await renderToString(createSSRApp(Status,{status,now}))).toContain('Tagesprüfung aktuell');
 for(const [s,time] of [[status,now+6000],[{...status,online:false},now]]){
  const html=await renderToString(createSSRApp(Status,{status:s,now:time}));
  expect(html).toContain('Schutzprüfung fehlt oder ist veraltet');expect(html).not.toContain('Tagesprüfung aktuell');
 }
});
it('keeps latched stops and unresolved close results visible without claiming a fill',async()=>{
 const s={...status,daily_stop:{...status.daily_stop,latched:true,reason:'daily_loss',day:'2026-10-31',commands:[{id:'a',ticket:77,symbol:'XAUUSD.gbe',kind:'close',status:'unknown'}]}};
 const html=await renderToString(createSSRApp(Status,{status:s,now}));
 expect(html).toContain('role="alert"');expect(html).toContain('Tagesverlustgrenze erreicht');
 expect(html).toContain('Ausgang ungeklärt · kein erneuter Versand');expect(html).not.toContain('Ausgeführt');
});
