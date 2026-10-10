"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "@/components/ui";
import { t } from "@/lib/i18n";
import { findStory, type StoryPosition } from "@/lib/story-player";

import type { StoryItem, StoryRing } from "./types";

/** While one of your stories is processing, the rings are asked for again this often (each ask also checks Bunny). */
const PROCESSING_POLL_MS = 10_000;

/**
 * The rings a page shows (the home rail, or one creator's ring on a profile: `creator`), already filtered and signed
 * for the viewer by /api/stories; your own processing stories included and refreshed until they are playable.
 */
export function useStoryRings(options: { creator?: string; paused?: boolean } = {}) {
  const [rings, setRings] = useState<StoryRing[] | null>(null);
  const query = new URLSearchParams({ pending: "1", ...(options.creator ? { creator: options.creator } : {}) }).toString();

  const load = useCallback(async () => {
    const res = await fetch(`/api/stories?${query}`, { cache: "no-store" }).catch(() => null);
    setRings(res?.ok ? ((await res.json()) as { rings: StoryRing[] }).rings : []);
  }, [query]);
  useEffect(() => void load(), [load]);

  const processing = Boolean(rings?.some((r) => r.isOwn && r.stories.some((s) => s.state === "processing")));
  useEffect(() => {
    if (!processing || options.paused) return;
    const timer = setInterval(() => void load(), PROCESSING_POLL_MS);
    return () => clearInterval(timer);
  }, [processing, options.paused, load]);

  /** Applies a change to one story everywhere it is shown (a like, a new audience). */
  const patchStory = useCallback((storyId: string, change: Partial<StoryItem>) => {
    setRings((rs) => rs?.map((r) => ({ ...r, stories: r.stories.map((s) => (s.id === storyId ? { ...s, ...change } : s)) })) ?? rs);
  }, []);

  return { rings, load, patchStory };
}

/**
 * The open story is the address: `?story=<id>` on the page that shows it, so a story can be shared, reloaded and
 * closed with the browser's Back. Opening pushes an entry (Back closes), moving between stories replaces it, and
 * closing goes back when the viewer was opened here (else it removes the parameter). A story the viewer may not see
 * (any more) closes with a word, never an empty viewer.
 */
export function useStoryAddress(rings: StoryRing[] | null) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const storyId = params.get("story");
  const openedHere = useRef(false);

  const href = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set("story", id);
      else next.delete("story");
      // A payment's return parameters belong to the story they came back to.
      if (!id) next.delete("payment");
      const q = next.toString();
      return q ? `${pathname}?${q}` : pathname;
    },
    [params, pathname],
  );

  const position: StoryPosition | null = rings && storyId ? findStory(rings, storyId) : null;

  const open = useCallback(
    (id: string) => {
      openedHere.current = true;
      router.push(href(id), { scroll: false });
    },
    [router, href],
  );
  const go = useCallback((id: string) => router.replace(href(id), { scroll: false }), [router, href]);
  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else router.replace(href(null), { scroll: false });
  }, [router, href]);

  // An address naming a story this viewer cannot see (expired, removed, not for them): say so and clean the address.
  useEffect(() => {
    if (!rings || !storyId || position) return;
    toast(t("stories.viewer.unavailable"));
    router.replace(href(null), { scroll: false });
  }, [rings, storyId, position, router, href]);

  return { storyId, position, open, go, close };
}
