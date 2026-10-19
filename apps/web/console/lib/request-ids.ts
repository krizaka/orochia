import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The request ids of the calls one operator action makes to Orochia (the edge's `cf-ray`), so the audit row can say which
 * calls it was. A store per action: two actions running at once never mix their ids.
 */
const store = new AsyncLocalStorage<string[]>();

export async function collectRequestIds<T>(run: () => Promise<T>): Promise<{ value: T; ids: string[] }> {
  const ids: string[] = [];
  const value = await store.run(ids, run);
  return { value, ids };
}

export function noteRequestId(id: string | null | undefined): void {
  const ids = store.getStore();
  if (ids && id && !ids.includes(id)) ids.push(id);
}
