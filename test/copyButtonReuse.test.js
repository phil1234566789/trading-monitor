import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parse} from '@vue/compiler-sfc';

it('shares the existing metadata copy control with pin IDs instead of restyling a separate button',()=>{
 const pin=readFileSync(new URL('../src/components/PinPanel.vue',import.meta.url),'utf8');
 const chart=readFileSync(new URL('../src/components/PriceChart.vue',import.meta.url),'utf8');
 for(const source of [pin,chart])expect(source).toMatch(/import CopyButton from ['"]\.\/ui\/CopyButton.vue['"]/);
 expect(parse(pin).descriptor.template.content).toMatch(/<CopyButton[^>]*class="pin-id-copy"/);
 expect(parse(chart).descriptor.template.content.match(/<CopyButton\b/g)).toHaveLength(4);
 expect(pin).not.toMatch(/\.pin-id-copy\s*\{/);
 expect(chart).not.toMatch(/\.metadata-copy-btn(?:\s|:|\{)/);
});
