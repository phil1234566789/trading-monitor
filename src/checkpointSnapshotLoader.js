// Erst beim Öffnen von H den einen Originalstand laden, nicht die ganze Statistik vergrößern.
export function createCheckpointSnapshotLoader(repository) {
  const pending=new WeakMap();
  return snapshot=>{
    if(!pending.has(snapshot)){
      const request=Promise.resolve().then(()=>snapshot.entry
        ?repository.getSnapshot(snapshot.runId,snapshot.id):repository.getSetupSnapshot(snapshot.runId,snapshot.id))
        .then(result=>{if(!result)throw new Error('Gespeicherter Originalstand fehlt.');return result;})
        .catch(error=>{pending.delete(snapshot);throw error;});
      pending.set(snapshot,request);
    }
    return pending.get(snapshot);
  };
}
