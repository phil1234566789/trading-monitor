// Laufzeitdetails und Reporter sind keine neue Störung; ein echter Erfolg beginnt die nächste Episode.
export function runnerIncidentId(instrument,lastSuccessAt,message) {
 const reason=message.replace(/,\s*\d+(?:\.\d+)?ms$/,'');
 return `runner-incident:v1:${JSON.stringify([instrument,lastSuccessAt ?? null,reason])}`;
}
