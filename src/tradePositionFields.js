// Einfügen und Bearbeiten verwenden dieselbe begrenzte Spaltenzuordnung.
export function tradePositionPayload(fields) {
  const payload = {};
  const columns = { entryPrice:'entry_price', stopLoss:'stop_loss', exitPrice:'exit_price', outcome:'outcome',
    reasoning:'reasoning', tradingAccountId:'trading_account_id', size:'size', netPl:'net_pl', commission:'commission' };
  for (const [field, column] of Object.entries(columns)) if (field in fields) payload[column] = fields[field];
  // triggered_at ist nicht nullbar; ein leeres Bearbeitungsfeld lässt die bisherige Zeit stehen.
  if (fields.entryTime != null) payload.triggered_at = new Date(fields.entryTime * 1000).toISOString();
  if ('exitTime' in fields) payload.exit_time = fields.exitTime != null ? new Date(fields.exitTime * 1000).toISOString() : null;
  return payload;
}
