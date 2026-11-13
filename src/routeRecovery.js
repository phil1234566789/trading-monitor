const RECOVERY_KEY='trading-monitor:route-recovery';
const IMPORT_ERROR=/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function installRouteRecovery(router,browser=window,now=Date.now) {
 let recovering=false;
 return router.onError((error,to)=>{
  if(recovering||!IMPORT_ERROR.test(error?.message??'')||browser.navigator.onLine===false)return;
  try{
   const previous=Number(browser.sessionStorage.getItem(RECOVERY_KEY)),time=now();
   // Auch ein kaputtes Deployment oder ein Netzausfall darf keine Reload-Schleife auslösen.
   if(previous>0&&time-previous<60000)return;
   browser.sessionStorage.setItem(RECOVERY_KEY,String(time));
   recovering=true;
   // Hash-Wechsel allein lädt keine neuen Assets: Ziel samt Filtern setzen, dann Dokument neu laden.
   browser.history.replaceState(browser.history.state,'',router.resolve(to).href);
   browser.location.reload();
  }catch{
   // Ohne persistenten Schleifenschutz nicht automatisch neu laden.
  }
 });
}
