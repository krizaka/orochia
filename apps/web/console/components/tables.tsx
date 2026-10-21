"use client";

import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { Download, Trash2 } from "lucide-react";

import {
  cancelAuction,
  deleteBackup,
  endUserSessions,
  manageUser,
  moderateConversation,
  moderateVideo,
  setCreatorVerified,
  setStoragePlan,
  updatePayout,
  updateReport,
} from "@/app/console/actions";
import { ConfirmDialog } from "@/console/components/ConfirmDialog";
import { button, cn, strong } from "@/console/components/ui";
import { isConversationReport } from "@/console/lib/conversation-moderation";
import { runStatus, shortRunId } from "@/console/lib/explorer-view";
import { day, fileSize, minutes, money, size, whenCompact, whenLong, whenShort } from "@/console/lib/format";

const mono = "font-mono";
const link = "text-fg-accent hover:underline";

/** Every console table is the platform's DataTable: cards on a phone, a caption for assistive tech, one look. */
function Table<T extends object>({ caption, rows, columns, id }: { caption: string; rows: T[]; columns: DataTableColumn<T>[]; id: (row: T) => string }) {
  return <DataTable caption={caption} rows={rows} columns={columns} getRowId={id} labels={{ loading: caption, empty: "Nothing to show." }} />;
}

/* ───────────── Creators ───────────── */

export interface CreatorRow {
  id: string;
  username: string;
  email: string;
  displayName: string;
  isVerified: boolean;
  createdAt: string;
  videosCount: number;
  totalTipsEarnedCents?: number;
}

const creatorColumns: DataTableColumn<CreatorRow>[] = [
  {
    id: "creator",
    header: "Creator",
    card: "title",
    cell: (c) => (
      <>
        <span className="font-semibold text-fg">{c.displayName}</span>
        <span className="block font-mono text-fg-secondary">@{c.username} · {c.email}</span>
      </>
    ),
  },
  { id: "registered", header: "Registered", cell: (c) => <span className={mono}>{day(c.createdAt)}</span> },
  { id: "videos", header: "Videos", align: "end", cell: (c) => <span className={mono}>{c.videosCount}</span> },
  { id: "net", header: "Net earned", align: "end", cell: (c) => <span className={mono}>{money(c.totalTipsEarnedCents ?? 0)}</span> },
  { id: "verified", header: "2257", cell: (c) => (c.isVerified ? <span className="text-fg-success">verified</span> : <span className="text-fg-warning">pending</span>) },
  {
    id: "action",
    header: "Action",
    cell: (c) =>
      c.isVerified ? (
        <ConfirmDialog
          action={setCreatorVerified}
          fields={{ id: c.id, isVerified: "false" }}
          trigger={{ label: "Suspend uploads", tone: "danger" }}
          title={`Suspend the uploads of @${c.username}`}
          description={<>Their 2257 verification is withdrawn: they can no longer open upload sessions until an operator approves their records again. Published videos stay online.</>}
          confirmLabel="Suspend uploads"
        />
      ) : (
        <ConfirmDialog
          action={setCreatorVerified}
          fields={{ id: c.id, isVerified: "true" }}
          trigger={{ label: "Approve", tone: "primary" }}
          tone="primary"
          title={`Approve @${c.username}`}
          description={<>Confirm that their 18 U.S.C. § 2257 records were checked: they can upload videos and stories from now on.</>}
          confirmLabel="Records checked — approve"
        />
      ),
  },
];

export function CreatorsTable({ rows }: { rows: CreatorRow[] }) {
  return <Table caption="Creator registry" rows={rows} columns={creatorColumns} id={(c) => c.id} />;
}

const complianceColumns: DataTableColumn<CreatorRow>[] = [
  { id: "registered", header: "Registered", cell: (c) => <span className={mono}>{day(c.createdAt)}</span> },
  {
    id: "creator",
    header: "Creator",
    card: "title",
    cell: (c) => (
      <>
        <span className="font-semibold text-fg">{c.displayName}</span> <span className="text-fg-secondary">@{c.username}</span>
      </>
    ),
  },
  { id: "email", header: "E-mail", cell: (c) => <span className={mono}>{c.email}</span> },
  {
    id: "action",
    header: "Action",
    cell: (c) => (
      <ConfirmDialog
        action={setCreatorVerified}
        fields={{ id: c.id, isVerified: "true" }}
        trigger={{ label: "Records verified — approve", tone: "primary" }}
        tone="primary"
        title={`Approve @${c.username}`}
        description={<>Confirm that the identity document, the age and the consent records match (18 U.S.C. § 2257). The creator can upload from now on; the decision is logged.</>}
        confirmLabel="Approve the creator"
      />
    ),
  },
];

export function ComplianceTable({ rows }: { rows: CreatorRow[] }) {
  return <Table caption="Creators waiting for 2257 verification" rows={rows} columns={complianceColumns} id={(c) => c.id} />;
}

/* ───────────── Explorer runs ───────────── */

export interface ExplorerRun {
  id: string;
  kind: string;
  orazakaRunId: string | null;
  model: string | null;
  inputs: number;
  promptTokens: number;
  status: string;
  durationMs: number;
  createdAt: string;
}

const runColumns: DataTableColumn<ExplorerRun>[] = [
  { id: "when", header: "When", sortable: true, value: (r) => r.createdAt, cell: (r) => <span className="whitespace-nowrap">{whenLong(r.createdAt)}</span> },
  { id: "for", header: "For", card: "title", value: (r) => (r.kind === "INDEX" ? "Indexing videos" : "A search") },
  {
    id: "run",
    header: "Orazaka run id",
    value: (r) => r.orazakaRunId ?? "",
    cell: (r) => (
      <span className={cn(mono, strong)} title={r.orazakaRunId ?? undefined}>
        {shortRunId(r.orazakaRunId)}
      </span>
    ),
  },
  { id: "model", header: "Model", cell: (r) => <span className={mono}>{r.model ?? "—"}</span> },
  { id: "texts", header: "Texts", align: "end", cell: (r) => <span className={mono}>{r.inputs}</span> },
  { id: "tokens", header: "Tokens", align: "end", cell: (r) => <span className={mono}>{r.promptTokens || "—"}</span> },
  { id: "time", header: "Time", align: "end", cell: (r) => <span className={cn("whitespace-nowrap", mono)}>{r.durationMs} ms</span> },
  {
    id: "outcome",
    header: "Outcome",
    value: (r) => runStatus(r.status).label,
    cell: (r) => {
      const outcome = runStatus(r.status);
      return <span className={cn("font-semibold", outcome.tone === "success" ? "text-fg-success" : outcome.tone === "warning" ? "text-fg-warning" : "text-fg-danger")}>{outcome.label}</span>;
    },
  },
];

export function ExplorerRunsTable({ rows }: { rows: ExplorerRun[] }) {
  return <Table caption="Calls to Orazaka" rows={rows} columns={runColumns} id={(r) => r.id} />;
}

/* ───────────── Platform: backups ───────────── */

export interface BackupRow {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

const backupColumns: DataTableColumn<BackupRow>[] = [
  { id: "taken", header: "Taken", value: (b) => b.createdAt, cell: (b) => <span className={cn("whitespace-nowrap text-[11px]", mono)}>{whenShort(b.createdAt)}</span> },
  { id: "file", header: "File", card: "title", cell: (b) => <span className={cn("block max-w-[13rem] truncate text-[11px]", mono)} title={b.name}>{b.name}</span> },
  { id: "size", header: "Size", align: "end", value: (b) => b.sizeBytes, cell: (b) => <span className={cn("whitespace-nowrap", mono)}>{fileSize(b.sizeBytes)}</span> },
  {
    id: "actions",
    header: "Actions",
    cell: (b) => (
      <div className="flex gap-1.5">
        <a href={`/api/backups/${encodeURIComponent(b.name)}`} className={button}>
          <Download className="h-3.5 w-3.5" aria-hidden /> <span className="sr-only">Download </span>.gz
        </a>
        <ConfirmDialog
          action={deleteBackup}
          fields={{ name: b.name }}
          trigger={{ label: "", tone: "danger", icon: <Trash2 className="h-3.5 w-3.5" aria-label="Delete" /> }}
          title="Delete the backup"
          description={<>The file <span className="font-mono">{b.name}</span> is removed from storage for good. Download it first if you may need it.</>}
          confirmLabel="Delete"
        />
      </div>
    ),
  },
];

export function BackupsTable({ rows }: { rows: BackupRow[] }) {
  return <Table caption="Backups" rows={rows} columns={backupColumns} id={(b) => b.name} />;
}

/* ───────────── Storage: largest accounts ───────────── */

export interface StorageAccountRow {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  plan: string;
  usedBytes: number;
  usedSeconds: number;
  limitBytes: number | null;
  percent: number | null;
  held: number;
}

export function StorageAccountsTable({ rows, planChoices }: { rows: StorageAccountRow[]; planChoices: { value: string; label: string }[] }) {
  const columns: DataTableColumn<StorageAccountRow>[] = [
    {
      id: "account",
      header: "Account",
      card: "title",
      value: (c) => c.displayName ?? c.username,
      cell: (c) => (
        <>
          <span className={strong}>{c.displayName ?? c.username}</span>
          <span className="block font-mono text-[11px] text-fg-secondary">@{c.username} · {c.role.toLowerCase()}</span>
        </>
      ),
    },
    { id: "plan", header: "Plan", cell: (c) => <span className={mono}>{c.plan}</span> },
    {
      id: "used",
      header: "Used",
      sortable: true,
      value: (c) => c.usedBytes,
      cell: (c) => (
        <span className={cn("whitespace-nowrap", mono)}>
          {size(c.usedBytes)}
          <span className={cn("block text-[11px]", c.percent !== null && c.percent >= 95 ? "text-fg-danger" : c.percent !== null && c.percent >= 80 ? "text-fg-warning" : "text-fg-secondary")}>
            {c.limitBytes === null ? "no limit" : `of ${size(c.limitBytes)} · ${c.percent} %`}
          </span>
        </span>
      ),
    },
    { id: "time", header: "Video time", sortable: true, value: (c) => c.usedSeconds, cell: (c) => <span className={cn("whitespace-nowrap", mono)}>{minutes(c.usedSeconds)}</span> },
    { id: "held", header: "Held", value: (c) => c.held, cell: (c) => <span className={c.held ? "font-semibold text-fg-warning" : "text-fg-secondary"}>{c.held || "—"}</span> },
    {
      id: "action",
      header: "Action",
      cell: (c) => (
        <ConfirmDialog
          action={setStoragePlan}
          fields={{ id: c.id }}
          trigger={{ label: "Change", tone: "secondary" }}
          tone="primary"
          title={`Storage plan of @${c.username}`}
          description={<>Sets how much this account may keep at Bunny. <span className="font-mono">default</span> is the role&apos;s plan; <span className="font-mono">unlimited</span> lifts the account&apos;s limit, never the platform&apos;s cap. Uploads held for want of space go online if they fit.</>}
          choice={{ name: "plan", label: "Plan", options: [{ value: "default", label: "default — the role's plan" }, ...planChoices.filter((o) => o.value !== "default")], defaultValue: c.plan }}
          confirmLabel="Set the plan"
        />
      ),
    },
  ];
  return <Table caption="Largest accounts" rows={rows} columns={columns} id={(c) => c.id} />;
}

/* ───────────── Accounts ───────────── */

export interface AccountRow {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "CREATOR" | "MEMBER";
  displayName: string;
  isVerified: boolean;
  isAgeVerified: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
}

const accountColumns: DataTableColumn<AccountRow>[] = [
  {
    id: "account",
    header: "Account",
    card: "title",
    value: (u) => u.displayName,
    cell: (u) => (
      <>
        <p className="font-semibold text-fg">{u.displayName}</p>
        <p className="font-mono text-[10px] text-fg-secondary">@{u.username} · {u.email}</p>
      </>
    ),
  },
  {
    id: "role",
    header: "Role",
    value: (u) => u.role,
    cell: (u) => (
      <>
        <span className="mr-2 font-semibold text-fg">{u.role.toLowerCase()}</span>
        <ConfirmDialog
          action={manageUser}
          fields={{ id: u.id, action: "set-role" }}
          trigger={{ label: "Change" }}
          tone="primary"
          title={`Change the role of @${u.username}`}
          description={<>An administrator reaches this console and every operator action; a creator can publish once 2257-verified. The change applies on their next request.</>}
          choice={{ name: "role", label: "New role", defaultValue: u.role, options: [{ value: "MEMBER", label: "Member" }, { value: "CREATOR", label: "Creator" }, { value: "ADMIN", label: "Administrator" }] }}
          confirmLabel="Change the role"
        />
      </>
    ),
  },
  {
    id: "checks",
    header: "Checks",
    cell: (u) => (
      <span className="text-[11px]">
        <span className={u.isAgeVerified ? "text-fg-success" : "text-fg-secondary"}>18+</span>
        {u.role === "CREATOR" && <span className={cn("ml-2", u.isVerified ? "text-fg-success" : "text-fg-warning")}>2257 {u.isVerified ? "✓" : "pending"}</span>}
      </span>
    ),
  },
  { id: "joined", header: "Joined", sortable: true, value: (u) => u.createdAt, cell: (u) => <span className={cn("whitespace-nowrap", mono)}>{day(u.createdAt)}</span> },
  {
    id: "state",
    header: "State",
    value: (u) => (u.suspendedAt ? "suspended" : "active"),
    cell: (u) => (u.suspendedAt ? <span className="text-fg-danger">suspended — {u.suspensionReason}</span> : <span className="text-fg-success">active</span>),
  },
  {
    id: "actions",
    header: "Actions",
    cell: (u) => (
      <div className="flex flex-wrap items-start gap-2">
        <ConfirmDialog
          action={endUserSessions}
          fields={{ id: u.id }}
          trigger={{ label: "End sessions" }}
          tone="primary"
          title={`End every session of @${u.username}`}
          description={<>Every open session, on the web and in the app, stops working on its next request. The account stays active: they sign in again. Use it for a lost phone or a doubt.</>}
          confirmLabel="End every session"
        />
        <a className={button} href={`/api/users/${u.id}/export`} download>
          Export (Law 25)
        </a>
        {u.suspendedAt ? (
          <ConfirmDialog
            action={manageUser}
            fields={{ id: u.id, action: "reinstate" }}
            trigger={{ label: "Reinstate", tone: "primary" }}
            tone="primary"
            title={`Reinstate @${u.username}`}
            description={<>The account can sign in again and its listed videos come back. Auctions cancelled by the suspension stay cancelled.</>}
            confirmLabel="Reinstate"
          />
        ) : (
          <ConfirmDialog
            action={manageUser}
            fields={{ id: u.id, action: "suspend" }}
            trigger={{ label: "Suspend", tone: "danger" }}
            title={`Suspend @${u.username}`}
            description={<>They are signed out on their next request and can no longer sign in; their videos are no longer listed and their open auctions are cancelled, with every leading bid released.</>}
            reason={{ label: "Reason (recorded and shown to the account)", placeholder: "Terms violation: …" }}
            confirmLabel="Suspend the account"
          />
        )}
      </div>
    ),
  },
];

export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  return <Table caption="Accounts" rows={rows} columns={accountColumns} id={(u) => u.id} />;
}

/* ───────────── Treasury ───────────── */

export interface PayoutRow {
  id: string;
  amountCents: number;
  status: string;
  payoutMethod: string;
  payoutDestination: string;
  txHashOrReference: string | null;
  failureReason: string | null;
  createdAt: string;
  creatorUsername: string;
}

const openPayoutColumns: DataTableColumn<PayoutRow>[] = [
  { id: "requested", header: "Requested", sortable: true, value: (p) => p.createdAt, cell: (p) => <span className={mono}>{day(p.createdAt)}</span> },
  { id: "creator", header: "Creator", card: "title", value: (p) => p.creatorUsername, cell: (p) => <>@{p.creatorUsername}</> },
  { id: "amount", header: "Amount", align: "end", sortable: true, value: (p) => p.amountCents, cell: (p) => <span className={cn(mono, "font-bold text-fg")}>{money(p.amountCents)}</span> },
  { id: "destination", header: "Method · destination", value: (p) => `${p.payoutMethod} · ${p.payoutDestination}`, cell: (p) => <span className={cn(mono, "break-all")}>{p.payoutMethod} · {p.payoutDestination}</span> },
  { id: "status", header: "Status", value: (p) => p.status, cell: (p) => <>{p.status.replace(/_/g, " ").toLowerCase()}</> },
  {
    id: "action",
    header: "Action",
    cell: (p) => (
      <div className="flex flex-wrap gap-1.5">
        {p.status === "REQUESTED" && <ConfirmDialog direct action={updatePayout} fields={{ id: p.id, status: "UNDER_REVIEW" }} trigger={{ label: "Review" }} />}
        <ConfirmDialog
          action={updatePayout}
          fields={{ id: p.id, status: "SETTLED" }}
          trigger={{ label: "Mark settled", tone: "primary" }}
          tone="primary"
          title={`Settle ${money(p.amountCents)} to @${p.creatorUsername}`}
          description={<>Confirm that the transfer was sent to {p.payoutMethod} · <span className="font-mono">{p.payoutDestination}</span>. This closes the payout for good.</>}
          reason={{ label: "Transfer reference", placeholder: "Bank reference, transaction hash…" }}
          confirmLabel="Mark settled"
        />
        <ConfirmDialog
          action={updatePayout}
          fields={{ id: p.id, status: "FAILED" }}
          trigger={{ label: "Fail (refund)", tone: "danger" }}
          title={`Fail the payout of @${p.creatorUsername}`}
          description={<>{money(p.amountCents)} goes back to the creator&apos;s available balance; they can request it again. The reason is shown to them.</>}
          reason={{ label: "Reason", placeholder: "Account details rejected by the bank…" }}
          confirmLabel="Fail the payout"
        />
      </div>
    ),
  },
];

export function OpenPayoutsTable({ rows }: { rows: PayoutRow[] }) {
  return <Table caption="Payouts to process" rows={rows} columns={openPayoutColumns} id={(p) => p.id} />;
}

const closedPayoutColumns: DataTableColumn<PayoutRow>[] = [
  { id: "requested", header: "Requested", sortable: true, value: (p) => p.createdAt, cell: (p) => <span className={mono}>{day(p.createdAt)}</span> },
  { id: "creator", header: "Creator", card: "title", value: (p) => p.creatorUsername, cell: (p) => <>@{p.creatorUsername}</> },
  { id: "amount", header: "Amount", align: "end", sortable: true, value: (p) => p.amountCents, cell: (p) => <span className={mono}>{money(p.amountCents)}</span> },
  { id: "status", header: "Status", value: (p) => p.status, cell: (p) => <>{p.status.toLowerCase()}</> },
  { id: "reference", header: "Reference", value: (p) => p.txHashOrReference ?? p.failureReason ?? "", cell: (p) => <span className={cn(mono, "break-all")}>{p.txHashOrReference ?? p.failureReason ?? ""}</span> },
];

export function ClosedPayoutsTable({ rows }: { rows: PayoutRow[] }) {
  return <Table caption="Payout history" rows={rows} columns={closedPayoutColumns} id={(p) => p.id} />;
}

/* ───────────── Catalogue ───────────── */

export interface CatalogueVideoRow {
  id: string;
  title: string;
  status: string;
  visibility: string;
  creatorUsername: string;
  viewsCount: number;
  createdAt: string;
  removedAt: string | null;
  removalReason: string | null;
  openReports: number;
}

export function CatalogueTable({ rows, appUrl }: { rows: CatalogueVideoRow[]; appUrl: string }) {
  const columns: DataTableColumn<CatalogueVideoRow>[] = [
    {
      id: "video",
      header: "Video",
      card: "title",
      value: (v) => v.title,
      cell: (v) => (
        <>
          <a className={link} href={`${appUrl}/watch/${v.id}`} target="_blank" rel="noreferrer">{v.title}</a>
          <p className="font-mono text-[10px] text-fg-secondary">{day(v.createdAt)} · {v.visibility.replace(/_/g, " ").toLowerCase()}</p>
        </>
      ),
    },
    { id: "creator", header: "Creator", value: (v) => v.creatorUsername, cell: (v) => <span className={mono}>@{v.creatorUsername}</span> },
    {
      id: "state",
      header: "State",
      value: (v) => (v.removedAt ? "taken down" : v.status),
      cell: (v) =>
        v.removedAt ? (
          <span className="text-fg-danger">taken down — {v.removalReason}</span>
        ) : (
          <span className={v.status === "READY" ? "text-fg-success" : "text-fg-secondary"}>{v.status.replace(/_/g, " ").toLowerCase()}</span>
        ),
    },
    { id: "reports", header: "Reports", align: "end", sortable: true, value: (v) => v.openReports, cell: (v) => <span className={cn(mono, v.openReports > 0 ? "font-bold text-fg-danger" : "")}>{v.openReports}</span> },
    { id: "views", header: "Views", align: "end", sortable: true, value: (v) => v.viewsCount, cell: (v) => <span className={mono}>{v.viewsCount.toLocaleString("en-US")}</span> },
    {
      id: "action",
      header: "Action",
      cell: (v) =>
        v.removedAt ? (
          <ConfirmDialog
            action={moderateVideo}
            fields={{ id: v.id, action: "restore" }}
            trigger={{ label: "Restore", tone: "primary" }}
            tone="primary"
            title="Restore the video"
            description={<>“{v.title}” is listed and playable again under its own audience rules. The takedown reason is cleared.</>}
            confirmLabel="Restore"
          />
        ) : (
          <ConfirmDialog
            action={moderateVideo}
            fields={{ id: v.id, action: "remove" }}
            trigger={{ label: "Take down", tone: "danger" }}
            title="Take the video down"
            description={<>“{v.title}” by @{v.creatorUsername} disappears everywhere and its playback is refused, for its author too. An open auction on it is cancelled and its bid released. Reversible from this screen.</>}
            reason={{ label: "Reason (recorded)", placeholder: "DMCA notice #…, terms violation, confirmed report…" }}
            confirmLabel="Take down"
          />
        ),
    },
  ];
  return <Table caption="Catalogue" rows={rows} columns={columns} id={(v) => v.id} />;
}

/* ───────────── Auctions ───────────── */

export interface AuctionRow {
  id: string;
  status: "OPEN" | "AWAITING_DECISION" | "SOLD" | "DECLINED" | "UNSOLD" | "CANCELLED";
  rights: "WATCH" | "DOWNLOAD";
  settlement: "CREATOR_DECIDES" | "HIGHEST_BID";
  startingPriceCents: number;
  highestBidCents: number;
  bidsCount: number;
  startsAt: string;
  endsAt: string;
  decisionDeadline: string | null;
  cancelReason: string | null;
  videoId: string;
  videoTitle: string;
  creatorUsername: string;
  leaderUsername: string | null;
}

const AUCTION_LABEL: Record<string, string> = { OPEN: "Open", AWAITING_DECISION: "Awaiting decision", SOLD: "Sold", DECLINED: "Declined", UNSOLD: "No bids", CANCELLED: "Cancelled" };
const AUCTION_TONE: Record<string, string> = {
  OPEN: "text-fg-danger",
  AWAITING_DECISION: "text-fg-warning",
  SOLD: "text-fg-success",
  DECLINED: "text-fg-secondary",
  UNSOLD: "text-fg-secondary",
  CANCELLED: "text-fg-secondary",
};

export function AuctionsTable({ rows, appUrl }: { rows: AuctionRow[]; appUrl: string }) {
  const columns: DataTableColumn<AuctionRow>[] = [
    {
      id: "video",
      header: "Video",
      card: "title",
      value: (a) => a.videoTitle,
      cell: (a) => (
        <>
          <a className={link} href={`${appUrl}/watch/${a.videoId}#auction`} target="_blank" rel="noreferrer">{a.videoTitle}</a>
          {a.cancelReason && <p className="mt-0.5 text-[10px] text-fg-secondary">cancelled — {a.cancelReason}</p>}
        </>
      ),
    },
    { id: "creator", header: "Creator", value: (a) => a.creatorUsername, cell: (a) => <span className={mono}>@{a.creatorUsername}</span> },
    {
      id: "status",
      header: "Status",
      value: (a) => a.status,
      cell: (a) => (
        <span className={cn("font-semibold", AUCTION_TONE[a.status])}>
          {AUCTION_LABEL[a.status]}
          {a.decisionDeadline && <p className="font-mono text-[10px] font-normal text-fg-secondary">by {whenCompact(a.decisionDeadline)}</p>}
        </span>
      ),
    },
    {
      id: "price",
      header: "Price",
      align: "end",
      sortable: true,
      value: (a) => (a.bidsCount > 0 ? a.highestBidCents : a.startingPriceCents),
      cell: (a) => (
        <span className={mono}>
          <span className="font-bold text-fg">{money(a.bidsCount > 0 ? a.highestBidCents : a.startingPriceCents)}</span>
          <p className="text-[10px] text-fg-secondary">from {money(a.startingPriceCents)}</p>
        </span>
      ),
    },
    {
      id: "bids",
      header: "Bids · leader",
      value: (a) => a.bidsCount,
      cell: (a) => (
        <span className={mono}>
          {a.bidsCount}
          {a.leaderUsername && <span className="text-fg-secondary"> · @{a.leaderUsername}</span>}
        </span>
      ),
    },
    {
      id: "window",
      header: "Window",
      sortable: true,
      value: (a) => a.startsAt,
      cell: (a) => (
        <span className={cn("whitespace-nowrap text-[11px]", mono)}>
          {whenCompact(a.startsAt)}
          <p className="text-fg-secondary">→ {whenCompact(a.endsAt)}</p>
        </span>
      ),
    },
    {
      id: "terms",
      header: "Terms",
      cell: (a) => (
        <span className="text-[11px]">
          {a.rights === "DOWNLOAD" ? "watch + download" : "watch"}
          <p className="text-fg-secondary">{a.settlement === "HIGHEST_BID" ? "sells automatically" : "creator decides"}</p>
        </span>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: (a) => (
        <>
          {(a.status === "OPEN" || a.status === "AWAITING_DECISION") && (
            <ConfirmDialog
              action={cancelAuction}
              fields={{ id: a.id }}
              trigger={{ label: "Cancel", tone: "danger" }}
              title="Cancel the auction"
              description={
                <>
                  “{a.videoTitle}” by @{a.creatorUsername} stops now.{" "}
                  {a.bidsCount > 0 ? <>The leading bid ({money(a.highestBidCents)}{a.leaderUsername ? ` by @${a.leaderUsername}` : ""}) is released to its bidder, who is notified.</> : <>Nobody has bid yet.</>}{" "}
                  The video gets its previous audience back. This cannot be undone.
                </>
              }
              reason={{ label: "Reason (recorded)", placeholder: "Reported content under review…" }}
              confirmLabel="Cancel the auction"
            />
          )}
          {a.status !== "OPEN" && a.status !== "AWAITING_DECISION" && <span className="text-[11px] text-fg-secondary">{day(a.endsAt)}</span>}
        </>
      ),
    },
  ];
  return <Table caption="Auctions" rows={rows} columns={columns} id={(a) => a.id} />;
}

/* ───────────── Moderation ───────────── */

export interface ReportRow {
  id: string;
  videoId: string | null;
  messageId: string | null;
  videoTitle: string;
  reason: string;
  details: string;
  reporterEmail: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  createdAt: string;
}

const REASON: Record<string, string> = {
  UNDERAGE: "Suspected minor",
  NON_CONSENSUAL: "Non-consensual",
  DMCA_COPYRIGHT: "Copyright (DMCA)",
  TERMS_VIOLATION: "Terms violation",
  FRAUD_SCAM: "Fraud / scam",
};

export function ReportsTable({ rows, appUrl }: { rows: ReportRow[]; appUrl: string }) {
  const columns: DataTableColumn<ReportRow>[] = [
    { id: "received", header: "Received", sortable: true, value: (r) => r.createdAt, cell: (r) => <span className={cn(mono, "whitespace-nowrap")}>{day(r.createdAt)}</span> },
    {
      id: "reason",
      header: "Reason",
      card: "title",
      value: (r) => REASON[r.reason] ?? r.reason,
      cell: (r) => <span className={r.reason === "UNDERAGE" || r.reason === "NON_CONSENSUAL" ? "font-bold text-fg-danger" : ""}>{REASON[r.reason] ?? r.reason}</span>,
    },
    {
      id: "video",
      header: "Video",
      value: (r) => r.videoTitle,
      cell: (r) =>
        r.videoId ? (
          <a className={link} href={`${appUrl}/watch/${r.videoId}`} target="_blank" rel="noreferrer">{r.videoTitle}</a>
        ) : (
          <>{r.videoTitle}</>
        ),
    },
    { id: "details", header: "Details", value: (r) => r.details, cell: (r) => <span className="block max-w-sm whitespace-pre-line">{r.details}</span> },
    { id: "reporter", header: "Reporter", value: (r) => r.reporterEmail, cell: (r) => <span className={mono}>{r.reporterEmail}</span> },
    {
      id: "action",
      header: "Action",
      cell: (r) => (
        <>
          <div className="flex flex-wrap gap-1.5">
            {r.status !== "IN_REVIEW" && r.status !== "RESOLVED" && <ConfirmDialog direct action={updateReport} fields={{ id: r.id, status: "IN_REVIEW" }} trigger={{ label: "Start review" }} />}
            {r.status !== "RESOLVED" && (
              <ConfirmDialog
                action={updateReport}
                fields={{ id: r.id, status: "RESOLVED" }}
                trigger={{ label: "Resolve", tone: "primary" }}
                tone="primary"
                title="Resolve the report"
                description={<>The report leaves the queue. Take the video down first if the report is founded — resolving does not touch the video.</>}
                confirmLabel="Resolve"
              />
            )}
            {r.status === "RESOLVED" && <ConfirmDialog direct action={updateReport} fields={{ id: r.id, status: "OPEN" }} trigger={{ label: "Reopen" }} />}
          </div>
          {isConversationReport(r) && (
            <div className="mt-1.5">
              <a className={link} href={`/moderation/conversation/${r.id}`}>Read the conversation</a>
            </div>
          )}
          {r.videoId && r.status !== "RESOLVED" && (
            <div className="mt-1.5">
              <ConfirmDialog
                action={moderateVideo}
                fields={{ id: r.videoId, action: "remove" }}
                trigger={{ label: "Take the video down", tone: "danger" }}
                title="Take the video down"
                description={<>“{r.videoTitle}” disappears everywhere — feed, search, profile, collections — and its playback is refused, for its author too. Its open auction is cancelled and the bid released. It can be restored from the catalogue.</>}
                reason={{ label: "Reason (recorded)", placeholder: `Report: ${REASON[r.reason] ?? r.reason}` }}
                confirmLabel="Take down"
              />
            </div>
          )}
        </>
      ),
    },
  ];
  return <Table caption="Content reports" rows={rows} columns={columns} id={(r) => r.id} />;
}

export interface ConversationMessageRow {
  id: string;
  senderId: string;
  sender: string;
  content: string;
}

export function ConversationMessagesTable({ rows, conversationId, group, reportedMessageId, reason }: { rows: ConversationMessageRow[]; conversationId: string; group: boolean; reportedMessageId: string; reason: string }) {
  const columns: DataTableColumn<ConversationMessageRow>[] = [
    { id: "sender", header: "Sender", card: "title", cell: (m) => <span className={cn("whitespace-nowrap", mono)}>@{m.sender}</span> },
    { id: "content", header: "Message", cell: (m) => <span className={cn("block max-w-xl whitespace-pre-line", m.id === reportedMessageId && "font-semibold text-fg-danger")}>{m.content}</span> },
    {
      id: "action",
      header: "Action",
      cell: (m) => (
        <div className="flex flex-wrap gap-1.5">
          <ConfirmDialog
            action={moderateConversation}
            fields={{ conversationId, action: "remove_message", target: m.id }}
            trigger={{ label: "Remove", tone: "danger" }}
            title="Remove the message"
            description={<>The message disappears for everyone. The report keeps its copy of the text.</>}
            reason={{ label: "Reason (recorded)", placeholder: reason }}
            confirmLabel="Remove"
          />
          {group && m.id === reportedMessageId && (
            <ConfirmDialog
              action={moderateConversation}
              fields={{ conversationId, action: "remove_member", target: m.senderId }}
              trigger={{ label: `Remove @${m.sender} from the group`, tone: "danger" }}
              title="Remove the member"
              description={<>@{m.sender} leaves the group and stops receiving it.</>}
              reason={{ label: "Reason (recorded)", placeholder: reason }}
              confirmLabel="Remove from the group"
            />
          )}
        </div>
      ),
    },
  ];
  return <Table caption="The reported message and its context" rows={rows} columns={columns} id={(m) => m.id} />;
}
