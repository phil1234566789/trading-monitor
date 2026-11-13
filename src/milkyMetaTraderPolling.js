// Browseranzeige alle acht Sekunden; die unabhängige Worker-/Fillprüfung behält ihre eigenen Fristen.
export const mmtPollDelay=()=>8000;
export const mmtStaleSeconds=()=>15;
// Ein Chat-Wechsel muss auch in einer bereits geöffneten MMT-Seite sichtbar werden.
export const mmtSelectedAccountId=(status,previous)=>Object.hasOwn(status,'active_account_id')?status.active_account_id:previous;
export function mmtConnectionStatus({unlocked,active,status,snapshot,age,error,delay}) {
  if(!unlocked)return {label:'MMT gesperrt',state:''};
  if(!active)return {label:'Kein Handelskonto',state:''};
  if(error)return {label:'Verbindung gestört',state:'dead'};
  if(snapshot?.worker_error)return {label:'Worker gestört',state:'dead'};
  if(status?.ui_cached)return {label:'Gespeicherter Stand · Prüfung bei Aktion',state:''};
  if(!status)return {label:'Verbinde …',state:''};
  if(!status.online)return {label:'Worker offline',state:'dead'};
  if(!snapshot||age==null||age>mmtStaleSeconds(delay))return {label:'Daten veraltet',state:'dead'};
  return {label:'Verbunden',state:'ok'};
}

export function mmtExecutionReady(active,status,snapshot){
 return Boolean(status?.online&&!snapshot?.worker_error&&!status?.health?.incident&&snapshot?.execution_ready&&snapshot?.trade_allowed
  &&(active?.mode==='demo'||status?.server_live_allowed));
}

export function mmtAccountSnapshot(account,bridge){
 const snapshot=bridge?.snapshot;
 return snapshot?.account_login===Number(account?.login)&&snapshot?.account_server===account?.server?snapshot:null;
}
