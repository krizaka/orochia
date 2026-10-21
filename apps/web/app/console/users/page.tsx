import { AccountsTable } from "@/console/components/tables";
import { button, Empty, filter, PageTitle } from "@/console/components/ui";
import { orochia } from "@/console/lib/orochia";

interface Account {
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

const FILTERS = [
  ["All", ""],
  ["Members", "role=MEMBER"],
  ["Creators", "role=CREATOR"],
  ["Admins", "role=ADMIN"],
  ["Suspended", "suspended=true"],
] as const;

export default async function UsersPage(props: { searchParams: Promise<{ role?: string; suspended?: string; q?: string }> }) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  if (searchParams.role) params.set("role", searchParams.role);
  if (searchParams.suspended) params.set("suspended", searchParams.suspended);
  if (searchParams.q) params.set("q", searchParams.q.slice(0, 100));
  const { users } = await orochia<{ users: Account[] }>(`/api/admin/users?${params}`);
  const current = params.toString().replace(/&?q=[^&]*/, "");

  return (
    <div>
      <PageTitle
        title="Accounts"
        subtitle="Every account. A suspension blocks sign-in and refuses the account's open sessions on their next request; roles take effect immediately."
      />
      <form className="mb-4 flex flex-wrap gap-2 text-xs" action="/users">
        {FILTERS.map(([label, qs]) => (
          <a key={label} href={`/users${qs ? `?${qs}` : ""}`} aria-current={current === qs ? "page" : undefined} className={filter(current === qs)}>
            {label}
          </a>
        ))}
        {searchParams.role && <input type="hidden" name="role" value={searchParams.role} />}
        {searchParams.suspended && <input type="hidden" name="suspended" value={searchParams.suspended} />}
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Username or e-mail" className="ml-auto rounded-lg border border-border-default bg-surface-2 px-3 py-1 text-xs text-fg" />
        <button className={button}>Search</button>
      </form>

      {users.length === 0 ? (
        <Empty>No account matches.</Empty>
      ) : (
        <AccountsTable rows={users} />
      )}
    </div>
  );
}
