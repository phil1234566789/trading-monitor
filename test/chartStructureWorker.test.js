import { describe, expect, it, vi } from 'vitest';
import { createChartStructureWorker } from '../src/chartStructureWorkerClient.js';

function setup() {
  const workers = [];
  const createWorker = () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn() };
    workers.push(worker); return worker;
  };
  const client = createChartStructureWorker({ createWorker });
  const reply = (worker, result) => worker.onmessage({ data: { result } });
  return { client, workers, reply };
}
const input = close => ({ kind: 'm5', symbol: 'XAUUSD', candles: [{ time: 1, open: 2, high: 4, low: 1, close }] });

describe('normal chart structure worker lifecycle', () => {
  it('coalesces equal inputs and reuses completed results across redraws', async () => {
    const { client, workers, reply } = setup();
    const a = client.run(input(3)), b = client.run(input(3));
    expect(workers).toHaveLength(1);
    expect(workers[0].postMessage).toHaveBeenCalledTimes(1);
    reply(workers[0], { state: 'current' });
    expect(await a).toEqual(await b);
    expect(await client.run(input(3))).toEqual({ state: 'current' });
    expect(workers[0].postMessage).toHaveBeenCalledTimes(1);
    client.dispose();
  });
  it('really stops obsolete CPU work and ignores an old queued answer', async () => {
    const { client, workers, reply } = setup();
    const old = client.run(input(3));
    const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' });
    const current = client.run(input(4));
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    reply(workers[0], { stale: true });
    reply(workers[1], { current: true });
    await rejected;
    expect(await current).toEqual({ current: true });
    client.dispose();
  });
  it('invalidates a corrected interior candle, settings and instrument', async () => {
    const { client, workers, reply } = setup();
    for (const value of [input(3), input(3.1), { ...input(3.1), anchor: 2 }, { ...input(3.1), symbol: 'GBPUSD' }]) {
      const promise = client.run(value); reply(workers[0], value); await promise;
    }
    expect(workers[0].postMessage).toHaveBeenCalledTimes(4);
    client.dispose();
  });
  it('bounds result retention and does not memoize failures', async () => {
    const { client, workers, reply } = setup();
    for (const close of [1, 2, 3]) { const p = client.run(input(close)); reply(workers[0], close); await p; }
    const again = client.run(input(1)); reply(workers[0], 1); await again;
    expect(workers[0].postMessage).toHaveBeenCalledTimes(4);
    const failed = client.run(input(5));
    const failure = expect(failed).rejects.toThrow('calculation failed');
    workers[0].onmessage({ data: { error: 'calculation failed' } }); await failure;
    const retry = client.run(input(5)); reply(workers[0], 5); await retry;
    expect(workers[0].postMessage).toHaveBeenCalledTimes(6);
    client.dispose();
  });
  it('terminates on dispose, rejects pending work and cannot restart', async () => {
    const { client, workers } = setup();
    const p = client.run(input(3)); const aborted = expect(p).rejects.toMatchObject({ name: 'AbortError' });
    client.dispose(); await aborted;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    await expect(client.run(input(4))).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers).toHaveLength(1);
  });
  it('reports worker startup/crash errors and permits a fresh retry', async () => {
    const broken = createChartStructureWorker({ createWorker: () => { throw Error('worker blocked'); } });
    await expect(broken.run(input(1))).rejects.toThrow('worker blocked'); broken.dispose();
    const { client, workers, reply } = setup();
    const pending = client.run(input(1)); const failure = expect(pending).rejects.toThrow('worker crash');
    workers[0].onerror({ message: 'worker crash' }); await failure;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    const retry = client.run(input(1)); reply(workers[1], 1); expect(await retry).toBe(1); client.dispose();
  });
  it('keeps the completed worker history between replay steps, but disposes its idle worker', async () => {
    const { client, workers, reply } = setup();
    const a = client.run(input(1)); reply(workers[0], 1); await a;
    client.cancel();
    const b = client.run(input(2));
    expect(workers).toHaveLength(1);
    reply(workers[0], 2); await b;
    client.dispose(); expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
});
