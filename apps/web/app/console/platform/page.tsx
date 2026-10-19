import { Database, HardDrive, History, RotateCcw, ShieldAlert } from "lucide-react";

import { backupDatabase, factoryReset } from "@/app/console/actions";
import { AuditTable } from "@/console/components/AuditTable";
import { ConfirmDialog } from "@/console/components/ConfirmDialog";
import { BackupsTable } from "@/console/components/tables";
import { cn, Empty, PageTitle, Panel, Stat } from "@/console/components/ui";
import { recentAudit } from "@/console/lib/account";
import { orochia } from "@/console/lib/orochia";

interface Platform {
  environment: { appUrl: string; indexed: boolean; nodeEnv: string };
  database: { name: string; host: string; sizeBytes: number; serverVersion: string };
  history: { kind: "empty" | "current" | "behind" | "rewritten"; applied: number; pending: number; known: number; lastAppliedAt: string | null };
  tables: { name: string; rows: number }[];
  reset: { allowed: boolean; confirmPhrase: string; ownerConfigured: boolean };
}

interface Backup {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

const size = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const HISTORY: Record<Platform["history"]["kind"], { label: string; tone: string; hint: string }> = {
  current: { label: "Up to date", tone: "text-fg-success", hint: "every migration of this release is applied" },
  behind: { label: "Behind", tone: "text-fg-warning", hint: "migrations are waiting — the next release job applies them" },
  empty: { label: "Empty", tone: "text-fg-warning", hint: "no migration applied yet" },
  rewritten: { label: "History rewritten", tone: "text-fg-danger", hint: "applied migrations this release does not ship — reset needed" },
};

/** The platform: environment, database, migrations, backups, and the factory reset of a development database. */
export default async function PlatformPage() {
  const [{ platform: p }, { backups }, log] = await Promise.all([
    orochia<{ platform: Platform }>("/api/admin/platform"),
    orochia<{ backups: Backup[] }>("/api/admin/platform/backups"),
    recentAudit(30),
  ]);
  const rows = p.tables.reduce((sum, t) => sum + t.rows, 0);
  const history = HISTORY[p.history.kind];

  return (
    <div>
      <PageTitle title="Platform & database" subtitle="The deployment this console operates, its database and migration history, backups — and, on development only, the factory reset." />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Deployment" value={p.environment.indexed ? "Production" : "Development"} tone={p.environment.indexed ? "success" : "warning"} hint={p.environment.appUrl} />
        <Stat label="Database" value={p.database.name} hint={`${p.database.host} · PostgreSQL ${p.database.serverVersion.split(" ")[0]}`} />
        <Stat label="Size" value={size(p.database.sizeBytes)} hint={`${rows.toLocaleString("en-US")} rows in ${p.tables.length} tables`} />
        <Stat label="Migrations" value={<span className={history.tone}>{history.label}</span>} hint={`${p.history.applied} applied · ${p.history.known} shipped — ${history.hint}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Backups */}
        <section aria-labelledby="backups-title">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 id="backups-title" className="flex items-center gap-2 text-sm font-bold text-fg">
              <HardDrive className="h-4 w-4 text-fg-accent" aria-hidden /> Backups
            </h2>
            <ConfirmDialog
              action={backupDatabase}
              trigger={{ label: "Back up now", tone: "primary", icon: <Database className="h-3.5 w-3.5" aria-hidden /> }}
              tone="primary"
              title="Back up the database"
              description={
                <>
                  Every table of <span className="font-mono">{p.database.name}</span> ({rows.toLocaleString("en-US")} rows) is written as compressed JSON to private storage — never publicly served. It holds personal data: e-mails, password hashes, encrypted payout details.
                </>
              }
              confirmLabel="Back up"
            />
          </div>
          {backups.length === 0 ? (
            <Empty>No backup yet.</Empty>
          ) : (
            <BackupsTable rows={backups} />
          )}
        </section>

        {/* Tables */}
        <section aria-labelledby="tables-title">
          <h2 id="tables-title" className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
            <Database className="h-4 w-4 text-fg-accent" aria-hidden /> Tables
          </h2>
          <Panel>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 lg:grid-cols-3">
              {p.tables.map((t) => (
                <li key={t.name} className="flex items-baseline justify-between gap-2 border-b border-border-subtle py-1 text-[11px]">
                  <span className="truncate font-mono text-fg-secondary">{t.name}</span>
                  <span className={cn("font-mono tabular-nums", t.rows ? "text-fg" : "text-fg-secondary")}>{t.rows.toLocaleString("en-US")}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      </div>

      {/* Operator log (the console's own database) */}
      <section aria-labelledby="log-title" className="mt-10">
        <h2 id="log-title" className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
          <History className="h-4 w-4 text-fg-accent" aria-hidden /> Operator log
          <span className="text-[11px] font-normal text-fg-secondary">— every decision and sign-in, kept in this console&apos;s database</span>
        </h2>
        {log.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <AuditTable rows={log.map((e, i) => ({ id: `${new Date(e.at).getTime()}-${i}`, at: new Date(e.at).toISOString(), action: e.action, target: e.target, ok: e.ok, detail: e.detail, actor: e.actor, requestId: e.request_id }))} />
        )}
      </section>

      {/* Danger zone */}
      <section aria-labelledby="danger-title" className="mt-10 rounded-3xl border border-danger/30 bg-danger/10 p-6">
        <h2 id="danger-title" className="flex items-center gap-2 text-sm font-bold text-fg-danger">
          <ShieldAlert className="h-4 w-4" aria-hidden /> Danger zone
        </h2>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl text-xs leading-relaxed text-fg-secondary">
            <p className="text-sm font-semibold text-fg">Factory reset</p>
            <p className="mt-1">
              Deletes every account, video, payment, auction and setting, then rebuilds the database from this release&apos;s migrations — the state of a fresh install.
              Orochia&apos;s owner account is kept{p.reset.ownerConfigured ? " (as configured)" : ""}. This console, its account and its log live in their own database and are not affected.
              Media files at Bunny are not deleted.
            </p>
            {!p.reset.allowed && (
              <p className="mt-2 font-semibold text-fg-danger">
                Disabled on this deployment. It is available only where DATABASE_ALLOW_RESET=true and never on the indexed production.
              </p>
            )}
          </div>
          <ConfirmDialog
            action={factoryReset}
            trigger={{ label: "Factory reset…", tone: "danger", icon: <RotateCcw className="h-3.5 w-3.5" aria-hidden />, disabled: !p.reset.allowed }}
            title="Factory reset of the database"
            description={
              <>
                Every row of <span className="font-mono">{p.database.name}</span> on <span className="font-mono">{p.database.host}</span> ({rows.toLocaleString("en-US")} rows in {p.tables.length} tables) is deleted and the
                schema rebuilt from {p.history.known} migration{p.history.known === 1 ? "" : "s"}. Members, creators, videos, wallets, ledgers, auctions, reports: all gone.
                This cannot be undone{" "}— except from a backup.
              </>
            }
            option={{ name: "backup", label: "Back up the database first", hint: "Recommended. If the backup fails, nothing is deleted.", defaultChecked: true }}
            phrase={p.reset.confirmPhrase}
            confirmLabel="Reset the database"
          />
        </div>
      </section>
    </div>
  );
}
