"use client";

import { PlusIcon, Story24hIcon } from "@krizaka/icons";
import React, { createContext, Suspense, useContext, useState } from "react";

import { CreateStoryModal } from "@/components/CreateStoryModal";
import { cn } from "@/components/ui";
import { t } from "@/lib/i18n";
import { startOf } from "@/lib/story-player";

import { StoryViewer } from "./StoryViewer";
import type { StoryRing } from "./types";
import { useStoryAddress, useStoryRings } from "./useStories";

interface ProfileStoriesValue {
  ring: StoryRing | null;
  canAdd: boolean;
  open: () => void;
  openStory: (id: string) => void;
  add: () => void;
}

const ProfileStoriesContext = createContext<ProfileStoriesValue | null>(null);

/** The profile's stories, for the pieces of the profile that show them (the avatar's ring, the row). Null elsewhere. */
export function useProfileStories() {
  return useContext(ProfileStoriesContext);
}

function ProfileStoriesInner({ username, canAdd, children }: { username: string; canAdd: boolean; children: React.ReactNode }) {
  const { rings, load, patchStory } = useStoryRings({ creator: username });
  const { position, open, go, close } = useStoryAddress(rings);
  const [creating, setCreating] = useState(false);
  const ring = rings?.[0] ?? null;

  const value: ProfileStoriesValue = {
    ring,
    canAdd,
    open: () => ring && ring.stories.length > 0 && open(ring.stories[startOf(ring.stories)].id),
    openStory: open,
    add: () => setCreating(true),
  };

  return (
    <ProfileStoriesContext.Provider value={value}>
      {children}
      {canAdd && <CreateStoryModal isOpen={creating} onClose={() => setCreating(false)} onSuccess={load} />}
      {rings && (
        <StoryViewer
          rings={rings}
          position={position}
          onNavigate={go}
          onClose={() => {
            close();
            void load();
          }}
          onStoryChange={patchStory}
          onRemoved={() => {
            close();
            void load();
          }}
        />
      )}
    </ProfileStoriesContext.Provider>
  );
}

/**
 * A profile's stories, Instagram-style: the avatar carries a ring when the visitor may see a live story (bright while
 * one is unseen, quiet once all are seen), a tap opens the viewer on them (`?story=<id>`: shareable, Back closes),
 * and a row of the current stories sits under the header. On your own profile your processing stories show with a
 * badge and "Add story" is there. Everything comes from /api/stories?creator=, filtered and signed for the visitor.
 */
export function ProfileStories(props: { username: string; canAdd: boolean; children: React.ReactNode }) {
  return (
    <Suspense fallback={props.children}>
      <ProfileStoriesInner {...props} />
    </Suspense>
  );
}

/** The ring around a profile picture (the brand gradient while a story is unseen, a quiet line once seen). */
export function StoryAvatarRing({ children, className }: { children: React.ReactNode; className?: string }) {
  const stories = useProfileStories();
  const live = stories?.ring?.stories.filter((s) => s.state === "ready") ?? [];
  if (!stories || live.length === 0) return <>{children}</>;
  const unseen = !stories.ring?.isOwn && live.some((s) => !s.seen);
  return (
    <button
      type="button"
      onClick={stories.open}
      aria-label={t("stories.profile.open", { count: live.length })}
      className={cn("group/ring relative block rounded-[2.35rem] p-[3px] outline-none transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0", className)}
    >
      <span aria-hidden className={cn("absolute inset-0 rounded-[2.35rem]", unseen ? "bg-linear-to-tr from-accent via-accent-2 to-accent-2" : "bg-border-strong")} />
      <span className="relative block rounded-4xl bg-surface-1 p-[3px]">{children}</span>
    </button>
  );
}

/** The current stories in a row under the profile's header (and "Add story" on your own profile). */
export function ProfileStoriesRow() {
  const stories = useProfileStories();
  if (!stories) return null;
  const items = stories.ring?.stories ?? [];
  if (items.length === 0 && !stories.canAdd) return null;
  return (
    <section aria-label={t("stories.profile.title")} className="mt-5">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">
        <Story24hIcon size={14} className="text-accent" />
        {t("stories.profile.title")}
      </h2>
      <ul className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {stories.canAdd && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={stories.add}
              className="flex h-28 w-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/5 text-accent outline-none transition-colors hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent"
            >
              <PlusIcon size={20} />
              <span className="px-1 text-center text-[10px] font-semibold leading-tight">{t("stories.add")}</span>
            </button>
          </li>
        )}
        {items.map((s) => (
          <li key={s.id} className="shrink-0">
            <button
              type="button"
              onClick={() => stories.openStory(s.id)}
              aria-label={s.caption || t("stories.profile.story")}
              className={cn(
                "relative block h-28 w-[4.5rem] overflow-hidden rounded-2xl border bg-surface-2 outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent",
                s.seen || stories.ring?.isOwn ? "border-border-default" : "border-accent",
              )}
            >
              <span aria-hidden className="absolute inset-0 flex items-center justify-center text-fg-muted">
                <Story24hIcon size={22} />
              </span>
              {s.thumbnailUrl && (
                <img
                  src={s.thumbnailUrl}
                  alt=""
                  // A thumbnail the CDN refuses leaves the story mark, never a broken image.
                  onError={(e) => e.currentTarget.remove()}
                  className={cn("relative h-full w-full object-cover", s.isBlurred && !stories.ring?.isOwn && "scale-110 blur-md")}
                />
              )}
              {s.state !== "ready" && (
                <span className="absolute inset-x-1 bottom-1 rounded-full bg-scrim px-1 py-0.5 text-center text-[9px] font-semibold text-fg-on-media">
                  {t(s.state === "processing" ? "stories.processing" : "stories.failed")}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
