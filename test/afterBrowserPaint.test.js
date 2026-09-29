import { afterEach, it, expect, vi } from 'vitest';
import { afterBrowserPaint } from '../src/afterBrowserPaint.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('lets a frame paint before work and cancels superseded work', () => {
  vi.useFakeTimers();
  let frame;
  vi.stubGlobal('requestAnimationFrame', callback => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const work = vi.fn();
  const cancel = afterBrowserPaint(work);
  expect(work).not.toHaveBeenCalled();
  frame();
  expect(work).not.toHaveBeenCalled();
  cancel();
  vi.runAllTimers();
  expect(work).not.toHaveBeenCalled();
  afterBrowserPaint(work);
  frame();
  vi.runAllTimers();
  expect(work).toHaveBeenCalledOnce();
});
