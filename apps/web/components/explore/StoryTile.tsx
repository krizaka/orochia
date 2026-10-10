import { StoryIcon } from "@krizaka/icons";
import { Play } from "lucide-react";
import Link from "next/link";

import { Avatar, Badge, Card, cn } from "@/components/ui";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import type { ExploreStory } from "@/lib/explore";
import { t } from "@/lib/i18n";

/**
 * A live public story in Explore: its still (veiled when it is sensitive), the creator, the caption and the time left.
 * It opens the story viewer on the creator's profile (`/@user?story=<id>`), which signs the media for the viewer.
 */
export function StoryTile({ story, index = 0 }: { story: ExploreStory; index?: number }) {
  return (
    <Card.Root asChild interactive tone="glass" reveal={index} className="h-full">
      <Link href={`/@${story.creatorUsername}?story=${story.id}`} aria-label={t("explore.story.open", { name: story.creatorName })}>
        <Card.Media aspect="portrait" className="theme-dark">
          <Card.Image src={story.posterUrl} fallback={<StoryIcon size={36} />} className={cn(story.isBlurred && "scale-110 blur-xl")} />
          <div className="absolute inset-0 bg-linear-to-t from-scrim-strong via-transparent to-scrim/40" aria-hidden />
          <Card.Overlay corner="top-left" className="flex items-center gap-2">
            <span className="rounded-full bg-linear-to-tr from-accent to-accent-2 p-0.5">
              <Avatar src={story.creatorAvatar || AVATAR_PLACEHOLDER} alt="" fallback={story.creatorName.charAt(0)} className="h-8 w-8 rounded-full border-2 border-media" />
            </span>
          </Card.Overlay>
          <Card.Overlay corner="top-right">
            <Badge tone="scrim" size="sm" className="normal-case tracking-normal">
              {story.type === "video" && <Play className="h-2.5 w-2.5 fill-current" aria-hidden />}
              {t("explore.story.left", { hours: story.hoursLeft })}
            </Badge>
          </Card.Overlay>
          {story.isBlurred && (
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-bold uppercase tracking-wider text-fg-on-media">
              {t("card.sensitive")}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-3 text-fg-on-media">
            <p className="truncate text-xs font-bold">{story.creatorName}</p>
            {story.caption && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug opacity-85">{story.caption}</p>}
          </div>
        </Card.Media>
      </Link>
    </Card.Root>
  );
}
