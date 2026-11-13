export function mmtEquityPlot(trades,accounts,width){
 if(!trades.length)return null;
 const groups=new Map();let minX=Infinity,maxX=-Infinity;
 for(const trade of trades){
  if(!groups.has(trade.account_id))groups.set(trade.account_id,[]);
  groups.get(trade.account_id).push(trade);minX=Math.min(minX,trade.closed_at);maxX=Math.max(maxX,trade.closed_at);
 }
 minX-=1000;maxX=Math.max(minX+1000,maxX);
 const series=[...groups].map(([id,rows])=>{
  let net=0,commission=0;
  const values=[{x:minX,y:0,c:0},...rows.slice().sort((a,b)=>a.closed_at-b.closed_at||a.id.localeCompare(b.id)).map(t=>({x:t.closed_at,y:net+=t.net,c:commission+=t.commission??0}))];
  values.push({x:maxX,y:net,c:commission});
  return {id,name:accounts.find(a=>a.id===id)?.name??id,colorIndex:Math.max(0,accounts.findIndex(a=>a.id===id)),values};
 }).sort((a,b)=>a.colorIndex-b.colorIndex||a.id.localeCompare(b.id));
 const w=width,h=220,left=65,right=w-12,top=12,bottom=178;
 let lo=0,hi=0;for(const s of series)for(const v of s.values){lo=Math.min(lo,v.y,v.c);hi=Math.max(hi,v.y,v.c);}
 const pad=Math.max((hi-lo)*.08,.01),minY=lo-pad,maxY=hi+pad;
 const x=n=>left+(n-minX)/(maxX-minX)*(right-left),y=n=>bottom-(n-minY)/(maxY-minY)*(bottom-top);
 const path=(values,key)=>values.map((v,i)=>(i?'L':'M')+x(v.x).toFixed(2)+','+y(v[key]).toFixed(2)).join(' ');
 return {w,h,left,right,top,bottom,zero:y(0),series:series.map(s=>({...s,path:path(s.values,'y'),commissionPath:path(s.values,'c')})),
  ys:Array.from({length:4},(_,i)=>{const n=minY+(maxY-minY)*i/3;return {n,y:y(n)};}),
  xs:(w<480?[0,1]:[0,.5,1]).map(f=>({n:minX+(maxX-minX)*f,x:x(minX+(maxX-minX)*f),anchor:f===0?'start':f===1?'end':'middle'}))};
}
