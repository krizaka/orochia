import { MessageIcon } from "@krizaka/icons";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants, EmptyState } from "@/components/ui";
import { appUrl } from "@/lib/env";
import { getI18n } from "@/lib/i18n-server";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/** `/unsubscribe?t=<token>`: from an e-mail's link — says which kind of e-mail stops, and one button does it. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t: token = "", done } = await searchParams;
  const { t } = await getI18n();
  const who = verifyUnsubscribe(token);
  const settings = `${appUrl()}/dashboard?tab=settings#settings-notifications`;
  if (!who) return <Frame><EmptyState icon={<MessageIcon size={32} />} title={t("unsubscribe.invalidTitle")} description={t("unsubscribe.invalidBody")} /></Frame>;
  const category = t(`settings.notifications.categories.${who.category}`);
  return (
    <Frame>
      <EmptyState
        icon={<MessageIcon size={32} />}
        title={done ? t("unsubscribe.doneTitle", { category }) : t("unsubscribe.title", { category })}
        description={done ? t("unsubscribe.doneBody") : t("unsubscribe.body")}
      />
      <div className="mt-6 flex flex-col items-center gap-3">
        {!done && (
          <form method="post" action="/api/unsubscribe">
            <input type="hidden" name="t" value={token} />
            <button type="submit" className={buttonVariants({ variant: "primary", shape: "cut" })}>
              {t("unsubscribe.confirm")}
            </button>
          </form>
        )}
        <Link href={settings} className="text-xs text-fg-accent hover:underline">
          {t("unsubscribe.settings")}
        </Link>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-16">{children}</div>;
}
