"use client";

import { EyeIcon, HeartIcon, TipIcon } from "@krizaka/icons";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { Avatar, Button, Chip, Dialog, EmptyState, Select, Sheet, Skeleton, Tabs, toast } from "@/components/ui";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";

import { STORY_AUDIENCE_CHOICES, type StoryAudienceId, type StoryItem } from "./types";

interface Person {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Insights {
  viewsCount: number;
  likesCount: number;
  tipsCount: number;
  tipsTotalCents: number;
  guestViews: number;
  viewers: (Person & { viewedAt: string; liked: boolean })[];
  tips: (Person & { amountCents: number; at: string })[];
}

function PersonRow({ person, children }: { person: Person; children?: React.ReactNode }) {
  const inner = (
    <>
      <Avatar src={person.avatarUrl || AVATAR_PLACEHOLDER} alt="" fallback={(person.displayName || "?").charAt(0)} className="h-9 w-9 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{person.displayName || t("stories.insights.formerAccount")}</span>
        {person.username && <span className="block truncate font-mono text-[11px] text-fg-muted">@{person.username}</span>}
      </span>
      {children}
    </>
  );
  return person.username ? (
    <Link href={`/@${person.username}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-2 py-2">{inner}</div>
  );
}

/**
 * What a story did, for its author: views (the accounts that watched it, visitors only counted), likes, tips with
 * who sent them and how much — and who sees it, changed in place (a story delivered for a challenge keeps its
 * backers). Read from /api/stories/[id]/insights, which answers its author only.
 */
export function StoryInsights({
  open,
  onClose,
  story,
  onAudienceChanged,
}: {
  open: boolean;
  onClose: () => void;
  story: StoryItem;
  onAudienceChanged: (audience: StoryAudienceId, listName: string | null) => void;
}) {
  const [data, setData] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("viewers");
  const [lists, setLists] = useState<{ id: string; name: string; membersCount: number }[] | null>(null);
  const [audience, setAudience] = useState<StoryAudienceId>(story.audience);
  const [listId, setListId] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = story.audience === "CHALLENGE";

  useEffect(() => {
    if (!open) return;
    setData(null);
    setFailed(false);
    setAudience(story.audience);
    fetch(`/api/stories/${story.id}/insights`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { insights: Insights }) => setData(d.insights))
      .catch(() => setFailed(true));
    fetch("/api/me/lists", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { lists: [] }))
      .then((d: { lists?: { id: string; name: string; membersCount: number }[] }) => setLists(d.lists ?? []))
      .catch(() => setLists([]));
  }, [open, story.id, story.audience]);

  const changed = audience !== story.audience || (audience === "INVITED_ONLY" && listId !== "");
  const saveAudience = async () => {
    setSaving(true);
    const res = await fetch(`/api/stories/${story.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, audienceListId: audience === "INVITED_ONLY" ? listId || null : null }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      toast.error(t("stories.insights.audienceFailed"));
      return;
    }
    onAudienceChanged(audience, audience === "INVITED_ONLY" ? (lists?.find((l) => l.id === listId)?.name ?? null) : null);
    setListId("");
    toast.success(t("stories.insights.audienceSaved"));
  };

  const figures = [
    { id: "views", icon: EyeIcon, value: String(data?.viewsCount ?? story.viewsCount) },
    { id: "likes", icon: HeartIcon, value: String(data?.likesCount ?? story.likesCount) },
    { id: "tips", icon: TipIcon, value: data ? money(data.tipsTotalCents) : String(story.tipsCount) },
  ] as const;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Sheet size="md">
        <Dialog.Header>
          <Dialog.Title>{t("stories.insights.title")}</Dialog.Title>
          <Dialog.Description>{t("stories.insights.subtitle")}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className="space-y-5 pt-2">
          <dl className="grid grid-cols-3 gap-2">
            {figures.map(({ id, icon: Icon, value }) => (
              <div key={id} className="rounded-2xl border border-border-default bg-surface-2/60 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-secondary">
                  <Icon size={14} className="text-accent" />
                  {t(`stories.insights.figures.${id}`)}
                </dt>
                <dd className="mt-1 font-mono text-lg font-black text-fg">{value}</dd>
              </div>
            ))}
          </dl>

          <Tabs.Root value={tab} onValueChange={setTab} variant="segmented">
            <Tabs.List aria-label={t("stories.insights.title")}>
              <Tabs.Trigger value="viewers">{t("stories.insights.viewers")}</Tabs.Trigger>
              <Tabs.Trigger value="tips">{t("stories.insights.tips")}</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="viewers" className="pt-3">
              {failed ? (
                <p role="alert" className="text-xs text-danger">{t("stories.insights.failed")}</p>
              ) : !data ? (
                <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
              ) : data.viewers.length === 0 ? (
                <EmptyState title={t("stories.insights.noViewers")} description={data.guestViews > 0 ? t("stories.insights.guests", { count: data.guestViews }) : undefined} />
              ) : (
                <>
                  <ul className="max-h-72 overflow-y-auto">
                    {data.viewers.map((v) => (
                      <li key={v.username}>
                        <PersonRow person={v}>{v.liked && <HeartIcon size={16} className="shrink-0 fill-current text-danger" aria-label={t("stories.insights.liked")} />}</PersonRow>
                      </li>
                    ))}
                  </ul>
                  {data.guestViews > 0 && <p className="mt-2 text-[11px] text-fg-muted">{t("stories.insights.guests", { count: data.guestViews })}</p>}
                </>
              )}
            </Tabs.Content>
            <Tabs.Content value="tips" className="pt-3">
              {failed ? (
                <p role="alert" className="text-xs text-danger">{t("stories.insights.failed")}</p>
              ) : !data ? (
                <Skeleton className="h-12 w-full rounded-xl" />
              ) : data.tips.length === 0 ? (
                <EmptyState title={t("stories.insights.noTips")} description={t("stories.insights.noTipsHint")} />
              ) : (
                <ul className="max-h-72 overflow-y-auto">
                  {data.tips.map((tip, i) => (
                    <li key={`${tip.username}-${tip.at}-${i}`}>
                      <PersonRow person={tip}>
                        <span className="shrink-0 font-mono text-sm font-bold text-success">{money(tip.amountCents)}</span>
                      </PersonRow>
                    </li>
                  ))}
                </ul>
              )}
            </Tabs.Content>
          </Tabs.Root>

          <section className="rounded-2xl border border-border-default bg-surface-2/50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-secondary">{t("stories.create.audience")}</h3>
            {locked ? (
              <p className="text-xs text-fg-secondary">{t("stories.insights.audienceLocked")}</p>
            ) : (
              <>
                <Chip.Group
                  type="single"
                  required
                  label={t("stories.create.audience")}
                  value={audience}
                  onValueChange={(v) => setAudience(v as StoryAudienceId)}
                  className="grid grid-cols-2 gap-2"
                >
                  {STORY_AUDIENCE_CHOICES.map((a) => (
                    <Chip key={a} value={a} className="h-auto rounded-xl py-2">
                      {t(`stories.create.audiences.${a}`)}
                    </Chip>
                  ))}
                </Chip.Group>
                {audience === "INVITED_ONLY" &&
                  (lists && lists.length === 0 ? (
                    <p className="mt-2 text-xs text-fg-muted">{t("stories.create.noList")}</p>
                  ) : (
                    <Select value={listId} onChange={(e) => setListId(e.target.value)} aria-label={t("stories.create.list")} className="mt-2 rounded-xl px-3 py-2.5">
                      <option value="">{story.audienceListName ?? `${t("stories.create.list")}…`}</option>
                      {(lists ?? []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.membersCount})
                        </option>
                      ))}
                    </Select>
                  ))}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-fg-muted">{t("stories.insights.audienceHint")}</p>
                  <Button size="sm" onClick={() => void saveAudience()} loading={saving} disabled={!changed || (audience === "INVITED_ONLY" && !listId)}>
                    {t("stories.insights.saveAudience")}
                  </Button>
                </div>
              </>
            )}
          </section>
        </Dialog.Body>
      </Sheet>
    </Dialog.Root>
  );
}
