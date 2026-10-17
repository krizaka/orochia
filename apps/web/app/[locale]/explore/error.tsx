"use client";

import { ServerError } from "@/components/errors/ServerError";

/** Explore's own boundary: the sections degrade one by one (lib/degrade.ts); this is for what is left. */
export default function ExploreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ServerError digest={error.digest} retry={retry} scope="explore" />;
}
