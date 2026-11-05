export const MMT_ACCOUNT_ROLES=[{value:'risky',label:'Riskanter Trade'},{value:'safe',label:'Sicherer Trade'},{value:'normal',label:'Normaler Trade'}];
export function accountsForRole(accounts,role){
 if(!MMT_ACCOUNT_ROLES.some(r=>r.value===role))return [];
 const matches=accounts.filter(a=>!a.archived&&a.trade_role===role);
 return matches.length===1?matches:[];
}
