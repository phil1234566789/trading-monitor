import { assumeFixtureH1Direction } from './helpers/fixtureH1Direction.js';
assumeFixtureH1Direction();
import { describe, it, expect } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { parse } from '@vue/compiler-dom';
import TradeSetupChecklist from '../src/components/TradeSetupChecklist.vue';
import { evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import { activeM1Context, buildM1Structure, m1PrerequisiteReason } from '../src/m1Structure.js';
import { evaluateM1Checklist, inactiveM1Checklist } from '../src/m1Checklist.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';
import m1 from './fixtures/gbpusd-m1-dr114-p5.json';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const attribute = (node, name) => node.props?.find(p => p.type === 6 && p.name === name)?.value?.content;
const descendants = node => [node, ...(node.children ?? []).flatMap(descendants)];
// Tooltip-Text ist im SSR-HTML enthalten, aber nicht sichtbar. Attribute wie title/datetime
// gehören ebenfalls nicht zum normalen Detailtext und dürfen vollständige Daten behalten.
function visibleText(node) {
  if (attribute(node, 'aria-hidden') === 'true') return '';
  return node.type === 2 ? node.content : (node.children ?? []).map(visibleText).join(' ');
}

describe('Checklist calendar dates belong only in the evaluation header', () => {
  it.each([['09:25', true], ['10:05', true], ['10:05', false]])('keeps all visible A–J details free of dates at %s (news=%s)', async (clock, withNews) => {
    const evaluatedAt = at(clock);
    const state = evaluateTradeSetupChecklist({ instrument: 'GBPUSD', evaluatedAt,
      h1Candles: h1.candles, m5Candles: m5, sessionConfigs: sessions.sessions,
      settings: { rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff },
      news: withNews ? [{ currency: 'USD', eventTime: at('10:05'), title: 'Testtermin' }] : [], newsLoadStatus: 'ready',
    });
    const context = activeM1Context(state);
    const check = context ? { ...evaluateM1Checklist({ context,
      structure: buildM1Structure(m1, context.anchor, evaluatedAt), candles: m1, evaluatedAt }), instrument: 'GBPUSD' }
      : { ...inactiveM1Checklist(m1PrerequisiteReason(state)), instrument: 'GBPUSD', evaluatedAt };
    const html = await renderToString(createSSRApp(TradeSetupChecklist, { instrument: 'GBPUSD', checklistState: state, m1Check: check }));
    const nodes = descendants(parse(html));
    const details = visibleText(nodes.find(n => attribute(n, 'class') === 'checklist-checks'));
    expect(details).not.toMatch(/\b(?:\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})\b/);
    expect(visibleText(nodes.find(n => n.tag === 'time'))).toContain(`2026-09-09 ${clock}`);
    if (clock === '10:05') {
      for (const text of ['6d 17h', 'Ziele fixiert um 09:30 Uhr', '07:25 → 09:10',
        'CHOCH 1.35576 um 09:50', 'BOS 1.35554 um 10:00']) expect(details).toContain(text);
      if (withNews) {
        expect(details).toContain('bis 10:20 Uhr');
        expect(details).toContain('M1-Auswertung pausiert');
        expect(check.entry).toBeUndefined();
        return;
      }
      for (const text of ['M1-Stand um 10:05 Uhr',
        'M1 bärische FVG nach Retest um 09:48', 'Gegen den M5-Trend: bestätigter M5-CHoCH in Traderichtung fehlt.']) expect(details).toContain(text);
      expect(html).toContain('Ursprung: 2026-09-09 09:20');
      expect(check.fvg.candleTime).toBe(at('09:48'));
      // Der später bestätigte CHoCH darf den früheren Entry nicht rückwirkend freigeben.
      expect(check.entry).toBeNull();
    }
  });
});
