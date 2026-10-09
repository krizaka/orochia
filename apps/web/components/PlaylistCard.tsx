import { ListVideo } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Badge, Card } from "@/components/ui";

import { CollectionAudienceBadge, type CollectionVisibility } from "./CollectionAudience";

export interface PlaylistCardProps {
  id: string;
  title: string;
  description: string | null;
  visibility: CollectionVisibility;
  itemsCount: number;
  coverUrl: string | null;
}

/** A collection tile: its first video as cover, title, size and who opens it. */
export function PlaylistCard({ id, title, description, visibility, itemsCount, coverUrl }: PlaylistCardProps) {
  return (
    <Card.Root asChild interactive tone="glass">
      <Link href={`/playlists/${id}`}>
        <Card.Media>
          <Card.Image src={coverUrl} className="opacity-80" fallback={<ListVideo className="h-10 w-10" />} />
          <Card.Overlay corner="bottom-right">
            <Badge tone="scrim" className="rounded-lg font-mono font-medium normal-case tracking-normal">
              <ListVideo className="h-3 w-3" aria-hidden /> {itemsCount}
            </Badge>
          </Card.Overlay>
        </Card.Media>
        <Card.Body className="gap-1">
          <Card.Title className="truncate font-bold">{title}</Card.Title>
          {visibility !== "PUBLIC" && <CollectionAudienceBadge visibility={visibility} className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted" />}
          {description && <Card.Description>{description}</Card.Description>}
        </Card.Body>
      </Link>
    </Card.Root>
  );
}
