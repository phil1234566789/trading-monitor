export function recoveryHealthReady(report, reportedAt = null) {
 const enabled = report.instruments.filter(row => row.enabled);
 return ['live','waiting'].includes(report.state) && !report.actionRequired && enabled.length > 0
  && enabled.every(row => !row.error && !row.stale && Number.isFinite(Date.parse(row.lastSuccessAt))
   && (reportedAt === null || Date.parse(row.lastSuccessAt) > Date.parse(reportedAt)));
}

