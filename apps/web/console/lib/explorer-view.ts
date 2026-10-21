import type { Tone } from "@/console/components/ui";

/** What an operator reads of a call to Orazaka: OK, or why it did not happen (the code Orochia recorded). */
const FAILURES: Record<string, string> = {
  not_configured: "Orazaka is not configured",
  circuit_open: "Paused after repeated failures",
  unreachable: "Orazaka did not answer",
  refused: "Orazaka refused the key or the scope",
  bad_response: "Unexpected answer",
};

export function runStatus(status: string): { label: string; tone: Tone } {
  if (status === "OK") return { label: "Answered", tone: "success" };
  return { label: FAILURES[status] ?? status, tone: status === "circuit_open" ? "warning" : "danger" };
}

/** `abc12345-…` → `abc12345…`: the run id is long; the full value stays in the cell's title and is what Orazaka's logs carry. */
export function shortRunId(id: string | null): string {
  return id ? `${id.slice(0, 8)}…` : "—";
}

export function coverage(embedded: number, discoverable: number): { percent: number | null; tone: Tone } {
  if (discoverable === 0) return { percent: null, tone: "default" };
  const percent = Math.min(100, Math.round((embedded / discoverable) * 100));
  return { percent, tone: percent === 100 ? "success" : percent >= 50 ? "warning" : "danger" };
}
