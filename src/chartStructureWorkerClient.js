import { beginActivity } from './composables/useHttpActivity.js';

export function createChartStructureWorker({ createWorker = () =>
  new Worker(new URL('./chartStructureWorker.js', import.meta.url), { type: 'module' }) } = {}) {
  let worker, pending, disposed = false;
  const results = new Map();
  const aborted = () => new DOMException('Aborted', 'AbortError');
  function cancel() {
    if (!pending) return;
    worker?.terminate(); worker = null;
    if (pending) { const old = pending; pending = null; old.finish(); old.reject(aborted()); }
  }
  function run(input) {
    if (disposed) return Promise.reject(aborted());
    // Vollständige Inputs statt Länge/letzter Kerze: auch Archivkorrekturen müssen invalidieren.
    const key = JSON.stringify(input);
    if (pending?.key === key) return pending.promise;
    if (pending) cancel();
    if (results.has(key)) return Promise.resolve(results.get(key));
    try { worker ??= createWorker(); } catch (error) { return Promise.reject(error); }
    const activeWorker = worker;
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    const job = { key, promise, resolve, reject, finish: beginActivity('Struktur berechnen') };
    pending = job;
    const fail = error => {
      if (worker !== activeWorker || pending !== job) return;
      pending = null; job.finish(); reject(error);
    };
    activeWorker.onmessage = ({ data }) => {
      if (worker !== activeWorker || pending !== job) return;
      if (data.error) { fail(new Error(data.error)); return; }
      pending = null; job.finish();
      if (results.size >= 2) results.delete(results.keys().next().value);
      results.set(key, data.result);
      resolve(data.result);
    };
    activeWorker.onerror = event => {
      fail(new Error(event.message));
      if (worker === activeWorker) { worker.terminate(); worker = null; }
    };
    try { activeWorker.postMessage(JSON.parse(key)); } catch (error) { fail(error); }
    return promise;
  }
  return { run, cancel, dispose() {
    disposed = true; cancel(); worker?.terminate(); worker = null; results.clear();
  } };
}
