import { McpServer } from 'npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js';
import { Client } from 'npm:@modelcontextprotocol/sdk@^1.12.0/client/index.js';
import { InMemoryTransport } from 'npm:@modelcontextprotocol/sdk@^1.12.0/inMemory.js';
import { registerMt5ExecutionTools } from './tools/mt5Execution.ts';
import { decryptCredential, encryptCredential } from './mt5Credentials.ts';

Deno.test('AES-GCM credentials are account-bound and tamper-evident', async()=>{
  const previous=Deno.env.get('MT5_CREDENTIAL_KEY');
  Deno.env.set('MT5_CREDENTIAL_KEY',btoa('12345678901234567890123456789012'));
  try {
    const stored=await encryptCredential('test-password-only','42:Demo');
    if (JSON.stringify(stored).includes('test-password-only')) throw new Error('cleartext persisted');
    if (await decryptCredential(stored,'42:Demo')!=='test-password-only') throw new Error('roundtrip failed');
    let rejected=false;
    try {await decryptCredential(stored,'43:Demo');} catch {rejected=true;}
    if(!rejected) throw new Error('account binding missing');
    const other=await encryptCredential('test-password-only','42:Demo');
    if(other.iv===stored.iv) throw new Error('nonce reused');
  } finally {
    if(previous===undefined) Deno.env.delete('MT5_CREDENTIAL_KEY'); else Deno.env.set('MT5_CREDENTIAL_KEY',previous);
  }
});

Deno.test('MMT tools register and list over real MCP transport without a broker connection',async()=>{
  const server=new McpServer({name:'mmt-test',version:'1.0.0'});
  registerMt5ExecutionTools(server);
  const client=new Client({name:'mmt-test-client',version:'1.0.0'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport),client.connect(clientTransport)]);
    const {tools}=await client.listTools();
    for(const name of ['get_mt5_execution_status','start_mt5_entry_search','cancel_mt5_entry_search']) {
      if(!tools.some((tool:{name:string})=>tool.name===name)) throw new Error('missing '+name);
    }
    const start=tools.find((tool:{name:string})=>tool.name==='start_mt5_entry_search')!;
    if(start.inputSchema.type!=='object'||!start.inputSchema.properties?.stop_loss) throw new Error('schema invalid');
  } finally {await client.close();await server.close();}
});
