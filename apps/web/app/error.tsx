"use client";

import { ServerError } from "@/components/errors/ServerError";

/** The error boundary of every page, inside the layout: the header and the footer stay, the falcon explains. */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ServerError digest={error.digest} retry={retry} />;
}
