import {activeMt5Account,mt5Database} from './mt5Credentials.ts';

// Übergang bis zum VPS-Release des Leerlauf-Workers: Der alte Worker pollt im 1-s-Takt; eine verzögerte Antwort
// verlangsamt seinen Loop ohne Codeänderung auf dem VPS. Worker-Timeout 8 s, deshalb höchstens bis 5 s ab Request-Start.
export const IDLE_BRAKE_MS=5000;
export async function idleBrake(body:Record<string,any>,startedAt:number){
  try{
    const account=await activeMt5Account(body.account_id);
    const {data,error}=await mt5Database().rpc('mt5_worker_idle',{p_account:account.id,p_login:String(account.login),p_server:account.server});
    if(error||data!==true)return false;
    const wait=IDLE_BRAKE_MS-(Date.now()-startedAt);
    if(wait>0)await new Promise(r=>setTimeout(r,wait));
    return true;
  }catch{return false;}
}
