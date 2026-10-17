/** The address of a tab: the default one is the bare path, the others carry `?tab=<id>` (URL = state). */
export function tabHref(path: string, id: string, defaultId: string): string {
  return id === defaultId ? path : `${path}?tab=${encodeURIComponent(id)}`;
}

/** The tab the address asks for, if the viewer may have it; otherwise the default. */
export function activeTab<T extends string>(asked: string | null | undefined, allowed: readonly T[], defaultId: T): T {
  return (allowed as readonly string[]).includes(asked ?? "") ? (asked as T) : defaultId;
}
