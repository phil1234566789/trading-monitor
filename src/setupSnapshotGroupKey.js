export function setupSnapshotGroupKey(snapshot) {
  const lifecycle = snapshot.checklist?.setup?.primary?.lifecycle ?? snapshot.rangeCourse?.lifecycle;
  const ideaKey = snapshot.entry?.ideaKey ?? lifecycle?.sourceIdeaKey;
  const ideaKnownAt = snapshot.entry?.ideaKnownAt ?? lifecycle?.sourceIdeaKnownAt;
  const identity = ideaKey && Number.isFinite(ideaKnownAt) && ideaKnownAt <= snapshot.knownAt
    ? ideaKey : snapshot.setupKey ?? snapshot.entry?.setupKey ?? snapshot.id;
  return `${snapshot.runId ?? ''}:${snapshot.instrument}:${identity}`;
}
