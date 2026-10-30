// Returns a function that runs fn once at the end of the current task, however often it is called
export function batchToMicrotask(fn: () => void): () => void {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      fn();
    });
  };
}
