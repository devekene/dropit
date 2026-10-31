/** Wait for every worker, even on failure, before releasing request admission. */
export async function boundedMap<T, R>(
  items: readonly T[],
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  let failed = false;
  let firstError: unknown;
  const workers = Array.from(
    { length: Math.min(3, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        const item = items[index];
        if (item === undefined) throw new Error("Missing bounded work item");
        try {
          results[index] = await operation(item);
        } catch (error: unknown) {
          if (!failed) firstError = error;
          failed = true;
        }
      }
    },
  );
  const settled = await Promise.allSettled(workers);
  const failure = settled.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  if (failed) throw firstError;
  return results;
}
