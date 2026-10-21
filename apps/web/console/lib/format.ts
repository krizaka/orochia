/** Pure formatters shared by the server pages and the client tables (no server import here). */

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const size = (bytes: number | null) =>
  bytes === null
    ? "unlimited"
    : bytes >= 1024 ** 4
      ? `${(bytes / 1024 ** 4).toFixed(2)} TB`
      : bytes >= 1024 ** 3
        ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
        : `${Math.round(bytes / 1024 ** 2)} MB`;

export const minutes = (seconds: number | null) => (seconds === null ? "unlimited" : `${Math.round(seconds / 60).toLocaleString("en-US")} min`);

/** Backup sizes: a KB floor of 1. */
export const fileSize = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const whenShort = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
export const whenLong = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });
export const whenCompact = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
