import { CheckIcon, CreatorIcon } from "@krizaka/icons";
import Link from "next/link";

import { Avatar, buttonVariants, Card, cn } from "@/components/ui";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import type { ExploreCreator } from "@/lib/explore";
import { t } from "@/lib/i18n";

/** A creator to follow: cover, picture, name, @username, audience and public work — the whole card opens the profile. */
export function CreatorTile({ creator: c, index = 0 }: { creator: ExploreCreator; index?: number }) {
  return (
    <Card.Root asChild interactive tone="glass" reveal={index} className="h-full">
      <Link href={`/@${c.username}`}>
        <Card.Media className="h-20">
          <Card.Image src={c.bannerUrl} fallback={<span className="h-full w-full bg-linear-to-br from-accent/30 via-accent-2/20 to-media" />} />
        </Card.Media>
        <Card.Body className="-mt-9 items-center gap-2 text-center">
          <Avatar src={c.avatarUrl || AVATAR_PLACEHOLDER} alt="" fallback={c.displayName.charAt(0)} className="h-16 w-16 rounded-2xl border-4 border-surface-1 shadow-lg" />
          <div className="min-w-0">
            <Card.Title className="flex items-center justify-center gap-1 truncate text-sm">
              <span className="truncate">{c.displayName}</span>
              {c.isVerified && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-on-accent" title={t("explore.creator.verified")}>
                  <CheckIcon size={10} strokeWidth={3} />
                </span>
              )}
            </Card.Title>
            <p className="truncate font-mono text-[11px] text-fg-muted">@{c.username}</p>
          </div>
          {c.bio && <p className="line-clamp-2 text-xs text-fg-secondary">{c.bio}</p>}
          <p className="flex items-center gap-3 text-[11px] text-fg-secondary">
            <span>{t("explore.creator.followers", { count: c.followers })}</span>
            <span aria-hidden>·</span>
            <span>{t("explore.creator.items", { count: c.publicItems })}</span>
          </p>
          <span className={cn(buttonVariants({ variant: "secondary", size: "sm", shape: "rounded" }), "mt-1 w-full gap-1.5")}>
            <CreatorIcon size={14} />
            {t("explore.creator.open")}
          </span>
        </Card.Body>
      </Link>
    </Card.Root>
  );
}
