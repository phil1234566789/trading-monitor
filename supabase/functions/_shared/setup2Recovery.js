export function recoveryHealthReady(report, reportedAt = null) {
 const enabled = report.instruments.filter(row => row.enabled);
 // Der neue Nachweis enthält den begrenzten M5-Spielraum; SQL fordert zusätzlich echten Marktfortschritt.
 if(typeof report.recoveryReady==='boolean')return report.recoveryReady && !report.actionRequired && enabled.length>0
  && enabled.every(row=>Number.isFinite(Date.parse(row.lastSuccessAt))
   && (reportedAt===null || Date.parse(row.lastSuccessAt)>Date.parse(reportedAt)));
 return ['live','waiting'].includes(report.state) && !report.actionRequired && enabled.length > 0
  && enabled.every(row => !row.error && !row.stale && Number.isFinite(Date.parse(row.lastSuccessAt))
   && (reportedAt === null || Date.parse(row.lastSuccessAt) > Date.parse(reportedAt)));
}

