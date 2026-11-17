// Gemeinsame Grundlage der Konto-Labore (Drawdown, Tageslimit): Lauf dob-setup-v3 aus der DB mit Philips gespeicherter Konfig,
// eindeutige erlaubte Trades nach Entry sortiert; R je Trade später über dobRowConfigScore (src/dobPartialProfit.js).
// Lauf und Konfig gehören derselben POI-Art an; beides bleibt HTF-OB, bis ein LQ-Sweep-Lauf existiert.
export const DOB_CONFIG_RUN = 'dob-setup-v3';

export async function loadDobConfigTrades(server, poiType = 'htf_ob') {
  const L = p => server.ssrLoadModule(p);
  const [{ supabase }, g, pp, st, bt, db] = await Promise.all(['/src/supabaseClient.js', '/src/dobGuardrails.js', '/src/dobPartialProfit.js',
    '/src/dobTradeStatistics.js', '/src/berlinTime.js', '/src/dbReadPaging.js'].map(L));
  const { data: cfgRow, error } = await g.dobGuardrailsQuery(supabase, 'XAUUSD', poiType);
  if (error) throw error;
  const cfg = g.dobGuardrailsFromRow(cfgRow);
  const { data: rows, error: rowsError } = await db.fetchAllRows((from, to) => supabase.from('dob_trade_setups').select('*').eq('instrument', 'XAUUSD')
    .eq('run_id', DOB_CONFIG_RUN).order('id').range(from, to));
  if (rowsError) throw rowsError;
  const { data: sessions } = await supabase.from('sessions').select('label,from_minutes,to_minutes,days').eq('instrument', 'XAUUSD').limit(200);
  const allowed = [...new Map(rows.filter(r => !g.dobRowGuardrailReason(cfg, r)).map(r => [st.dobTradePinKey(r), r])).values()]
    .sort((a, b) => a.entry_time - b.entry_time);
  return { supabase, cfg, allowed, sessions, g, pp, st, bt };
}
