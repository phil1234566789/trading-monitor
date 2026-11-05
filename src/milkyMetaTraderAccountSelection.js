export const ALL_HISTORY_ACCOUNTS='all-history';
export function statisticsAccounts(accounts,selection){
 return accounts.filter(a=>selection===ALL_HISTORY_ACCOUNTS|| (selection?a.id===selection:!a.archived));
}
