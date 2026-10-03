// Historische Close-Präfixe können minutenlang rechnen; Abbruch beendet auch die CPU-Arbeit.
export function calculateSnapshotIndicatorsInWorker(input, { signal } = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const worker = new Worker(new URL('./snapshotIndicatorWorker.js', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); signal?.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }) => {
      cleanup();
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.onerror = event => { cleanup(); reject(new Error(event.message)); };
    try { worker.postMessage(input); } catch (error) { cleanup(); reject(error); }
  });
}
