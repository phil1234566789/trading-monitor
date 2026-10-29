import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import OrderCard from '../src/components/MilkyMetaTraderOrderCard.vue';
const order={id:'test-order',status:'searching',created_at:'2026-10-29T10:35:15Z',intent:{symbol:'EURUSD.gbe',direction:'long',stop_loss:1.11252,take_profit:1.11506}};
const render=value=>renderToString(createSSRApp(OrderCard,{order:value}));
describe('MMT order feedback',()=>{
  it('keeps the pending entry explicit and shows both planned limits',async()=>{
    const html=await render(order);
    expect(html).toContain('wird gesucht');
    expect(html).toContain('1,11252');
    expect(html).toContain('1,11506');
    expect(html).toContain('Suche abbrechen');
  });
  it('shows broker closure and actual net result instead of an open execution',async()=>{
    const html=await render({...order,status:'executed',result:{price:1.11431,position_lifecycle:{state:'closed',close_reason:'tp',exit_price:1.11513,closed_at_sec:1793271749,net_profit:-0.77,currency:'USD'}}});
    expect(html).toContain('TP erreicht');
    expect(html).toContain('1,11431');
    expect(html).toContain('1,11513');
    expect(html).toContain('class="negative"');
    expect(html).toContain('-0,77');
    expect(html).not.toContain('Position offen');
    expect(html).not.toContain('Suche abbrechen');
  });
  it('uses the shared gold precision for broker-suffixed symbols',async()=>{
    const html=await render({...order,intent:{...order.intent,symbol:'XAUUSD.gbe',stop_loss:2700.125,take_profit:2800.999}});
    expect(html).toContain('2.700,13');
    expect(html).toContain('2.801');
  });
});
