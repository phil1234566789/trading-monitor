export function targetShares(targets,positionVolume){
 // Ein absichtlich unverplanter Positionsrest darf beim Teilen nicht stillschweigend zum TP werden.
 return targets.map(t=>{
  const percent=t.percent==null?Number(t.volume)/positionVolume*100:Number(t.percent);
  return Number.isFinite(percent)?Math.max(0,percent):0;
 });
}
export function splitTargetShares(targets,index,positionVolume){
 if(!targets[index]||targets.length>=5)return null;
 const shares=targetShares(targets,positionVolume),half=shares[index]/2;
 const result=targets.map((t,i)=>i===index?{...t,volume:'',percent:half}:{...t});
 result.push({...targets[index],volume:'',percent:shares[index]-half});
 return result;
}
export function redistributeTargetShares(targets,index,percent,positionVolume){
 const shares=targetShares(targets,positionVolume),total=shares.reduce((sum,n)=>sum+n,0);
 if(!targets[index]||targets.length<2||!Number.isFinite(percent)||percent<=0||percent>=total||total>100+1e-7)return null;
 const otherTotal=total-shares[index],remaining=total-percent;
 const others=targets.map((_,i)=>i).filter(i=>i!==index);
 let assigned=0;
 return targets.map((t,i)=>{
  let share=percent;
  if(i!==index){
   share=i===others.at(-1)?remaining-assigned:remaining*(otherTotal>0?shares[i]/otherTotal:1/others.length);
   assigned+=share;
  }
  return {...t,volume:'',percent:share};
 });
}
