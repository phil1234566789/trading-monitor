// Rohe Outcomes behalten: beim Vorspulen werden spätere Belege lokal sichtbar.
// Laufende Jahresläufe erst beim ausdrücklichen Aktualisieren erneut lesen.
export function createLinkedSnapshotReader(repository) {
  const pending = new Map();
  return (run, id, force = false) => {
    const key = `${run}:${id}`;
    if (force) pending.delete(key);
    if (!pending.has(key)) {
      const request = repository.getEntry(run, id).then(async entry => {
        const record = entry ?? { snapshot: await repository.getSetupSnapshot(run, id), results: [] };
        if (!record?.snapshot) throw new Error('Der gespeicherte Setup-Stand fehlt.');
        return record;
      }).catch(error => {
        if (pending.get(key) === request) pending.delete(key);
        throw error;
      });
      pending.set(key, request);
    }
    return pending.get(key);
  };
}
