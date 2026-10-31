import {z} from 'npm:zod@3.24.1';
import type {McpServer} from 'npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js';
import {json} from '../jsonResponse.ts';
import {listMt5TradingAccounts,selectMt5TradingAccount} from '../mt5AccountManagement.ts';

export function registerMt5AccountTools(server:McpServer){
 server.registerTool('list_mt5_trading_accounts',{
  title:'Gespeicherte MT5-Handelskonten',
  description:'Private Liste gespeicherter MT5-Handelskonten mit UUID, Nutzername, Login, Server, Modus und aktivem Konto. Niemals Zugangsdaten. Nur lesen: aktiviert kein Konto und sendet keine Order. Nutzerdefinierte Namen nicht umbenennen.',
  inputSchema:{},annotations:{readOnlyHint:true},
 },async()=>json(await listMt5TradingAccounts()));
 server.registerTool('select_mt5_trading_account',{
  title:'Aktives MT5-Handelskonto wählen',
  description:'Nur nach konkretem menschlichem Wechselauftrag. account_id exakt aus list_mt5_trading_accounts wählen; null wählt ab. Niemals aufgrund einer Analyse selbst umschalten. Genau dieses Konto empfängt künftig NEUE Aufträge; keine Vervielfachung, bestehende Suchen werden niemals umgeleitet. Laufende Suchen/Sendungen, offene oder ungeklärte Positionen sowie fehlender frischer fehlerfreier Brokerstand sperren den Wechsel serverseitig. Keine Order und kein Schließen einer Position. Nach erfolgreichem Wechsel muss der Python-Worker für das gewählte Konto gestartet/neu gestartet und get_mt5_execution_status geprüft werden; Auswahl allein ist keine Handelsbereitschaft.',
  inputSchema:{account_id:z.string().uuid().nullable()},
  annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true},
 },async({account_id}:{account_id:string|null})=>json(await selectMt5TradingAccount(account_id)));
}
