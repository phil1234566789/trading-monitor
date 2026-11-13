// Neue Schalter werden hinten angehängt; alte persistierte Arrays lassen sie ausgeschaltet.
export function toggleIndicatorGroup(refs, saved) {
  if (refs.some(r=>r.value)) {
    saved.value=refs.map(r=>r.value);
    refs.forEach(r=>{r.value=false;});
  } else if (Array.isArray(saved.value)) {
    refs.forEach((r,i)=>{r.value=saved.value[i]??false;});
    saved.value=null;
  } else return false;
  return true;
}
