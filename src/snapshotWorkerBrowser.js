// Abbruch beendet auch die CPU-Arbeit, nicht nur das spätere Zeichnen.
export function runSnapshotWorker(input, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const worker = new Worker(new URL('./snapshotIndicatorWorker.js', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); signal?.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.progress) { if (!signal?.aborted) onProgress?.(data.progress); return; }
      cleanup();
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.onerror = event => { cleanup(); reject(new Error(event.message)); };
    try { worker.postMessage(input); } catch (error) { cleanup(); reject(error); }
  });
}
