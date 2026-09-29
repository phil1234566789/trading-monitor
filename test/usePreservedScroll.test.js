import { describe, it, expect, vi } from 'vitest';
const hooks = vi.hoisted(() => ({}));
vi.mock('vue', () => ({ ref: value => ({ value }), onBeforeUpdate: fn => { hooks.before = fn; }, onUpdated: fn => { hooks.after = fn; } }));
import { usePreservedScroll } from '../src/composables/usePreservedScroll.js';

describe('scroll through temporary loading content', () => {
  it('restores the user position after browser clamping, and respects subsequent manual scrolling', () => {
    const keeper = usePreservedScroll();
    let top = 0, max = 1000;
    keeper.element.value = { get scrollTop() { return top; }, set scrollTop(value) { top = Math.min(value, max); } };
    top = 700;
    keeper.rememberScroll();
    hooks.before();
    max = 200; top = 200;
    hooks.after(); keeper.rememberScroll();
    expect(top).toBe(200);
    hooks.before(); max = 1000; hooks.after(); keeper.rememberScroll();
    expect(top).toBe(700);
    top = 350; keeper.rememberScroll();
    hooks.before(); hooks.after();
    expect(top).toBe(350);
  });
});
