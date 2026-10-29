export function mmtPollDelay(status) {
  return status?.bridge?.snapshot?.positions?.length||status?.bridge?.snapshot?.pending_orders
    ||status?.orders?.some(order=>['searching','sending','unknown'].includes(order.status))?1000:8000;
}
export function mmtStaleSeconds(delay) { return delay===1000?5:15; }
export function mmtConnectionStatus({unlocked,active,status,snapshot,age,error,delay}) {
  if(!unlocked)return {label:'MMT gesperrt',state:''};
  if(!active)return {label:'Kein Testkonto',state:''};
  if(error)return {label:'Verbindung gestört',state:'dead'};
  if(snapshot?.worker_error)return {label:'Worker gestört',state:'dead'};
  if(!status)return {label:'Verbinde …',state:''};
  if(!status.online)return {label:'Worker offline',state:'dead'};
  if(!snapshot||age==null||age>mmtStaleSeconds(delay))return {label:'Daten veraltet',state:'dead'};
  return {label:'Verbunden',state:'ok'};
}
