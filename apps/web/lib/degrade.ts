import { isDatabaseUnavailable } from "@orochia/db";

/** What a part of a page loaded — or that the database could not answer it right now. */
export type Loaded<T> = { ok: true; value: T } | { ok: false };

/**
 * Loads one part of a page so that a temporary database outage (too many connections, a restart) costs that part only:
 * the page renders, the part says it did not load and offers to try again (components/errors/SectionUnavailable).
 * Any other error is a bug and still reaches the page's error boundary.
 */
export async function unlessUnavailable<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, value: await load() };
  } catch (error) {
    if (isDatabaseUnavailable(error)) return { ok: false };
    throw error;
  }
}
