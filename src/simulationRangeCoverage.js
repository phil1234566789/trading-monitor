const STAGES=new Set(['unconfirmed','confirmed','validated','disqualified','invalidated']);
export const hasSavedValidation=group=>group.wasValidated ?? group.stage==='validated';
export const hasSavedStage=group=>STAGES.has(group.stage);
export function rangeCategory(group) {
  return hasSavedValidation(group)?group.outcome.status:hasSavedStage(group)?'notValidated':'stageUnknown';
}
export function rangeCoverage(groups) {
  const unknownStages=groups.filter(group=>!hasSavedStage(group));
  const unknownPrices=groups.filter(group=>hasSavedValidation(group) && group.outcome.status==='unknown');
  return {stageUnknown:unknownStages.length,priceUnknown:unknownPrices.length,
    confirmationTimes:groups.filter(group=>group.entries.some(snapshot=>Number.isFinite(snapshot.entry?.confirmedAt)
      && snapshot.entry.confirmedAt<=snapshot.knownAt)).length};
}
export function rangeEntryIds(groups) {
  return new Set(groups.flatMap(group=>group.entries.map(snapshot=>snapshot.entry?.id ?? snapshot.id)));
}
