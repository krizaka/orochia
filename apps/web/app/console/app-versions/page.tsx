import { Smartphone } from "lucide-react";

import { publishAppVersion,rollbackAppVersion } from "@/app/console/actions";
import { AppVersionForm, type AppVersionRecord } from "@/console/components/AppVersionForm";
import { ConfirmDialog } from "@/console/components/ConfirmDialog";
import { cn, Empty, PageTitle, Panel, strong } from "@/console/components/ui";
import { orochia } from "@/console/lib/orochia";

interface HistoryEntry extends AppVersionRecord {
  reason: string;
  changedBy: string;
  changedAt: string;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** The platforms Orochia's apps run on. */
const PLATFORMS = ["ios", "android"] as const;

/** App versions: what each platform's build must have, the update prompts, maintenance, the API contract, the flags. */
export default async function AppVersionsPage() {
  const [{ data: records }, ...histories] = await Promise.all([
    orochia<{ data: AppVersionRecord[] }>("/api/admin/app-config"),
    ...PLATFORMS.map((platform) => orochia<{ data: HistoryEntry[] }>(`/api/admin/app-config/${platform}/history`)),
  ]);

  return (
    <div>
      <PageTitle title="App versions" subtitle="The version contract of the apps: the minimum build, the latest, the update prompts, maintenance, the API contract (N-1) and the flags. Every change has a reason and can be rolled back." />
      <div className="space-y-10">
        {PLATFORMS.map((platform, index) => {
          const record = records.find((r) => r.platform === platform);
          const history = histories[index]?.data ?? [];
          return (
            <section key={platform} aria-labelledby={`${platform}-title`}>
              <h2 id={`${platform}-title`} className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
                <Smartphone className="h-4 w-4 text-fg-accent" aria-hidden /> {platform === "ios" ? "iOS" : "Android"}
              </h2>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <Panel>{record ? <AppVersionForm record={record} action={publishAppVersion} /> : <Empty>No parameters for this platform.</Empty>}</Panel>
                <Panel>
                  <h3 className="mb-3 text-xs font-bold text-fg-secondary">History</h3>
                  {history.length === 0 ? (
                    <Empty>No revision.</Empty>
                  ) : (
                    <ol className="divide-y divide-border-subtle" aria-label={`${platform} revisions`}>
                      {history.map((entry) => (
                        <li key={entry.revision} className="flex items-start gap-4 py-3">
                          <span className={cn("w-8 shrink-0 font-mono text-xs", strong)}>#{entry.revision}</span>
                          <div className="min-w-0 flex-1 text-xs text-fg-secondary">
                            <p className="font-mono text-fg">
                              {entry.minSupportedVersion} → {entry.latestVersion}
                              {entry.maintenanceOn ? " · maintenance" : ""}
                            </p>
                            <p>
                              {entry.changedBy} · {when(entry.changedAt)}
                            </p>
                            <p>{entry.reason}</p>
                          </div>
                          {entry.revision !== record?.revision && (
                            <ConfirmDialog
                              action={rollbackAppVersion}
                              fields={{ platform, revision: String(entry.revision) }}
                              trigger={{ label: "Restore" }}
                              tone="primary"
                              title={`Restore revision ${entry.revision}`}
                              description="Publishes these parameters again, as a new revision."
                              confirmLabel="Restore"
                              reason={{ label: "Reason", minLength: 3 }}
                            />
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
