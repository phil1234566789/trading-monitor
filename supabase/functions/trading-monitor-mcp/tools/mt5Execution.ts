import { z } from 'npm:zod@3.24.1';
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js';
import { json } from '../jsonResponse.ts';
import { cancelExecutionOrder, createExecutionOrder, getExecutionStatus } from '../mt5Execution.ts';

export function registerMt5ExecutionTools(server: McpServer) {
  server.registerTool('get_mt5_execution_status', {
    title:'MT5-Verbindung und Aufträge',
    description:'Liest den privaten Python-Worker-Heartbeat (online nur bis 15 Sekunden), Konto und die letzten 20 Aufträge oder einen Auftrag per ID. Kein Orderversand. Journal-Trades sind keine Brokerpositionen.',
    inputSchema:{ id:z.string().uuid().optional() },
    annotations:{readOnlyHint:true},
  }, async ({id}: {id?:string}) => json(await getExecutionStatus(id)));

  server.registerTool('start_mt5_entry_search', {
    title:'Asynchrone MT5-Entry-Suche aktivieren',
    description:'HANDELSAUFTRAG: Nur nach ausdrücklichem menschlichem Auftrag wie „Suche einen Entry“. Eine Richtungsmeinung allein genügt nicht. ' +
      'Aktiviert für das exakt angegebene Konto und Instrument eine zeitlich begrenzte Suche. Bei gültigem M1-Schluss wird OHNE weitere Chatfreigabe ' +
      'eine Brokerposition mit SL eröffnet. V1: höchstens 0,01 Lot, Risikobudget höchstens 5 in Kontowährung, keine bestehende Kontoexposure. ' +
      'm1_directional_close wartet auf eine nach Aktivierung geschlossene M1-Kerze: Short close<open, Long close>open, kein Doji; trigger_price ist null, volume muss die bestaetigte Broker-Mindestlotgroesse enthalten. ' +
      'Trigger m1_close_above/below vergleichen den Schlusskurs streng mit trigger_price; das sind technische Preisbedingungen, keine vollständige Strategieprüfung. ' +
      'test_next_m1_close ist ausschließlich ein ausdrücklich beauftragter DEMO-Verbindungstest, keine Strategie. ' +
      'Konto, genaue Brokersymbolbezeichnung (inkl. Suffix), Richtung, SL, Budget, Trigger und Ablauf müssen feststehen, nichts erfinden. ' +
      'Eine UUID pro menschlichem Auftrag erzeugen und für jeden Retry unverändert wiederverwenden; niemals nach Timeout automatisch eine neue ID senden. ' +
      'Kein garantiert besserer Preis. Challenge-/Strategieregeln sind noch nicht implementiert. Live-Ausführung benötigt lokale UND serverseitige Freischaltung.',
    inputSchema:{
      id:z.string().uuid(), account_login:z.number().int().positive(), account_server:z.string().min(1).max(100),
      mode:z.enum(['demo','live']),symbol:z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),direction:z.enum(['long','short']),
      stop_loss:z.number().positive().finite(),take_profit:z.number().positive().finite().nullable(),
      volume:z.number().positive().max(.01).finite().optional(),
      risk_amount:z.number().positive().max(5).finite(),trigger:z.enum(['m1_directional_close','m1_close_above','m1_close_below','test_next_m1_close']),
      trigger_price:z.number().positive().finite().nullable(), expires_sec:z.number().int().positive(),
    },
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:true},
  }, async (input:Record<string,unknown>) => json(await createExecutionOrder(input)));

  server.registerTool('cancel_mt5_entry_search', {
    title:'MT5-Entry-Suche abbrechen',
    description:'Beendet einen noch suchenden Auftrag atomar. Bei sending/executed/unknown keine Rücknahme behaupten; tatsächlichen Status auswerten. Schließt KEINE bestehende Brokerposition.',
    inputSchema:{id:z.string().uuid()},
    annotations:{readOnlyHint:false,idempotentHint:true},
  }, async ({id}: {id:string}) => json(await cancelExecutionOrder(id)));
}
