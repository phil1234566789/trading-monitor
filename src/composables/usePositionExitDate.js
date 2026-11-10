import {computed,ref,watch} from 'vue';

export function usePositionExitDate(entryTimeInput,exitTimeInput) {
  const date=ref(''),clock=ref('');
  let dateTouched=false,writing=false;
  function sync(){writing=true;exitTimeInput.value=date.value&&clock.value?`${date.value}T${clock.value}`:'';writing=false;}
  function reset(){
    dateTouched=false;
    const [savedDate,savedClock]=exitTimeInput.value.split('T');
    date.value=savedClock?savedDate:entryTimeInput.value.slice(0,10);
    clock.value=savedClock??'';
  }
  watch(exitTimeInput,()=>{if(!writing)reset();},{flush:'sync'});
  watch(entryTimeInput,()=>{
    if(!dateTouched&&!clock.value){date.value=entryTimeInput.value.slice(0,10);sync();}
  },{flush:'sync'});
  reset();
  return {
    exitDateInput:computed({get:()=>date.value,set:value=>{dateTouched=true;date.value=value;sync();}}),
    exitClockInput:computed({get:()=>clock.value,set:value=>{clock.value=value;sync();}}),
    resetExitDate:reset,
  };
}
