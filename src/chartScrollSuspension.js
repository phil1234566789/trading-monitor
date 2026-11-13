const suspensions=new WeakMap();

export function suspendChartScrolling(chart){
 let state=suspensions.get(chart);
 if(!state){
  const current=chart.options().handleScroll;
  // Lightweight Charts mutiert das Optionsobjekt; die Sicherung darf keine Referenz darauf bleiben.
  state={options:typeof current==='object'?{...current}:current,count:0};
  chart.applyOptions({handleScroll:false});
  suspensions.set(chart,state);
 }
 state.count++;
 let released=false;
 return ()=>{
  if(released)return;
  released=true;
  if(--state.count)return;
  suspensions.delete(chart);
  chart.applyOptions({handleScroll:state.options});
 };
}
