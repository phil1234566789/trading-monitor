const listeners=new Set(),planListeners=new Set();
const writes={save_account:['catalog','snapshots','guards','balances'],assign_account_role:['catalog'],select_account:['catalog','snapshots','orders','guards','balances'],risk_policy_save:['catalog','guards'],search_confirm:['orders','snapshots','guards'],confirm:['orders','snapshots','guards'],cancel:['orders'],target_save:['snapshots','guards']};
export function invalidateMmtUi(sections){for(const listener of listeners)listener(sections);}
export function subscribeMmtUiInvalidation(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function notifyMmtWrite(action){if(writes[action])invalidateMmtUi(writes[action]);}
export function invalidateMmtPlans(){for(const listener of planListeners)listener();}
export function subscribeMmtPlans(listener){planListeners.add(listener);return()=>planListeners.delete(listener);}
