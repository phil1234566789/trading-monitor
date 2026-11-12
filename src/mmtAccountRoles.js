export const MMT_ACCOUNT_ROLES=[{value:'risky',label:'Riskanter Trade'},{value:'safe',label:'Sicherer Trade'},{value:'normal',label:'Normaler Trade'}];
export const MMT_ACCOUNT_SELECTIONS=[...MMT_ACCOUNT_ROLES,
 {value:'normal+safe',label:'Normal + Sicher'},
 {value:'normal+risky',label:'Normal + Riskant'},
 {value:'safe+risky',label:'Sicher + Riskant'},
 {value:'all',label:'Alle drei Konten'}];
export function accountsForRole(accounts,role){
 if(!MMT_ACCOUNT_SELECTIONS.some(r=>r.value===role))return [];
 const roles=role==='all'?MMT_ACCOUNT_ROLES.map(r=>r.value):role.split('+');
 const selected=roles.map(r=>accounts.filter(a=>!a.archived&&a.trade_role===r));
 // Eine fehlende oder doppelt belegte Rolle darf eine Sammelauswahl nicht still verkleinern.
 return selected.every(matches=>matches.length===1)?selected.map(matches=>matches[0]):[];
}
