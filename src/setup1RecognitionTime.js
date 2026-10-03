/** Der OB-Zeitstempel bezeichnet C2; die FVG wird erst mit dem Schluss von C3 bekannt. */
export function setup1RecognitionTime(setup) {
  const createdAt = setup?.createdAt;
  const obStartTime = setup?.obStartTime;
  if (!Number.isFinite(createdAt) || !Number.isFinite(obStartTime) || createdAt < obStartTime
    || obStartTime % 300 !== 0) {
    throw new Error(`Setup 1.0 ${setup?.tradeSetupId ?? 'ohne ID'}: Erkennungszeit nicht ableitbar (created_at/ob_start_time).`);
  }
  return Math.max(createdAt, obStartTime + 600);
}
