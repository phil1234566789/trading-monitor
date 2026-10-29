import { HTTP_BACKGROUND } from '../src/composables/useHttpActivity.js';
import { describe, it, expect, vi } from 'vitest';
import { createMilkyMetaTraderClient } from '../src/milkyMetaTraderClient.js';

describe('private MT5 control client',()=>{
  it('sends credentials only in authenticated HTTPS request bodies and never URLs',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({account:{id:'1'}})});
    await createMilkyMetaTraderClient('https://project.supabase.co','control-key',fetch)('save_account',{password:'private'});
    const [url,options]=fetch.mock.calls[0];
    expect(url).toBe('https://project.supabase.co/functions/v1/mt5-control');
    expect(options.headers.Authorization).toBe('Bearer control-key');
    expect(JSON.parse(options.body).password).toBe('private');
    expect(options.redirect).toBe('error');
    expect(options.cache).toBe('no-store');
  });
  it('does not surface server response bodies containing possible credentials',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:false,status:400,text:async()=>'password=private'});
    await expect(createMilkyMetaTraderClient('https://project.supabase.co','key',fetch)('accounts')).rejects.toThrow('Anfrage fehlgeschlagen');
  });
});

it('distinguishes a rejected preview from an ambiguous storage failure',async()=>{
  for(const [code,definitive] of [['preview_expired',true],['request_failed',false]]) {
    const fetch=vi.fn().mockResolvedValue({ok:false,status:400,json:async()=>({code})});
    try {await createMilkyMetaTraderClient('https://project.supabase.co','key',fetch)('confirm');throw new Error('expected rejection');}
    catch(error) {expect(error.definitiveRejection).toBe(definitive);}
  }
});

it('marks status polls as background without putting metadata in the request body',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({})});
 await createMilkyMetaTraderClient('https://project.supabase.co','key',fetch)('status',{}, {background:true});
 expect(fetch.mock.calls[0][1][HTTP_BACKGROUND]).toBe(true);
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({action:'status'});
});
