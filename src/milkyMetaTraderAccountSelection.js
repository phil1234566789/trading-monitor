export const ALL_HISTORY_ACCOUNTS='all-history';
export function accountAvailability(accounts){
 return {active:accounts.filter(a=>!a.archived),inactive:accounts.filter(a=>a.archived)};
}
const archiveLabels={breached:'Breached',closed:'Geschlossen',passed:'Bestanden'};
export const accountArchiveLabel=account=>archiveLabels[account.archive_details?.status]??'Inaktiv';
export function statisticsAccounts(accounts,selection){
 return selection?accounts.filter(a=>selection===ALL_HISTORY_ACCOUNTS||a.id===selection):accountAvailability(accounts).active;
}
