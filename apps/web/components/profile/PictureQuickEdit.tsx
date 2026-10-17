"use client";

import { Camera, Clapperboard, ImagePlus, Palette, Trash2 } from "lucide-react";
import React, { useRef, useState } from "react";

import { cn, Dialog, DropdownMenu, Sheet, Skeleton, Spinner } from "@/components/ui";
import { t } from "@/lib/i18n";

import { BannerMomentDialog, type CoverVideo } from "./BannerMomentDialog";

interface Preset {
  id: string;
  name: string;
  url: string;
}

let presetsCache: Promise<{ avatars: Preset[]; banners: Preset[] }> | null = null;
const loadPresets = () =>
  (presetsCache ??= fetch("/api/reference/presets")
    .then((r) => (r.ok ? r.json() : { avatars: [], banners: [] }))
    .catch(() => ({ avatars: [], banners: [] })));

/**
 * Quick edit of a profile picture, right where it is shown (Facebook-style): a camera button that appears on
 * hover — always visible on touch screens — opens Upload · Choose a design · Remove. Saved at once; the server
 * resolves the picture (preset id or upload reference), the client never sends a URL.
 */
export function PictureQuickEdit({
  kind,
  hasPicture,
  current = null,
  movingCover = false,
  onChanged,
  className = "",
}: {
  kind: "avatar" | "banner";
  hasPicture: boolean;
  /** The picture shown now (a preset is highlighted in the picker). */
  current?: string | null;
  /** APP_VIDEO_BANNER is on: the cover menu offers « Use a moment of my video ». */
  movingCover?: boolean;
  onChanged: (url: string | null) => void;
  className?: string;
}) {
  const isAvatar = kind === "avatar";
  const input = useRef<HTMLInputElement>(null);
  const [choosing, setChoosing] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [momentOpen, setMomentOpen] = useState(false);
  const [coverVideos, setCoverVideos] = useState<CoverVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (choice: string | null, preview: string | null) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [kind]: choice }) });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error || t("settings.failed"));
    onChanged(preview);
  };

  const saveMoment = async (choice: { videoId: string; startSeconds: number; endSeconds: number; poster: string | null }) => {
    setBusy(true);
    setError(null);
    const bannerVideo = { kind: "video_segment", videoId: choice.videoId, startSeconds: choice.startSeconds, endSeconds: choice.endSeconds };
    const res = await fetch("/api/me/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerVideo }) });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error || t("movingCover.failed"));
    onChanged(choice.poster);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("category", isAvatar ? "avatars" : "banners");
    form.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { data?: { ref: string; url: string | null } };
    setBusy(false);
    if (!res.ok || !data.data) return setError(t("settings.pictures.uploadFailed", { size: isAvatar ? "5 MB" : "10 MB" }));
    await save(data.data.ref, data.data.url ?? URL.createObjectURL(file));
  };

  return (
    <div className={className}>
      {/* The menu is the kit's DropdownMenu: rendered in a portal above the page (tabs, cards), keyboard and screen-reader ready. */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={busy}
            aria-label={t(isAvatar ? "settings.pictures.editAvatar" : "settings.pictures.editBanner")}
            className={cn(
              "flex items-center gap-1.5 rounded-full bg-scrim text-fg-on-media shadow-lg ring-1 ring-white/20 backdrop-blur-md transition-all hover:bg-black/80 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 data-[state=open]:opacity-100!",
              isAvatar ? "h-9 w-9 justify-center" : "px-3.5 py-2 text-xs font-semibold",
            )}
          >
            {busy ? <Spinner size="sm" className="text-current" /> : <Camera className="h-4 w-4" />}
            {!isAvatar && <span>{hasPicture ? t("settings.pictures.editBanner") : t("settings.pictures.add")}</span>}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align={isAvatar ? "start" : "end"} className="min-w-56">
          <DropdownMenu.Item
            onSelect={() => {
              setChoosing(true);
              void loadPresets().then((p) => setPresets(isAvatar ? p.avatars : p.banners));
            }}
          >
            <Palette className="h-4 w-4 text-fg-accent" /> {t(isAvatar ? "settings.pictures.chooseAvatar" : "settings.pictures.chooseBanner")}
          </DropdownMenu.Item>
          {movingCover && !isAvatar && (
            <DropdownMenu.Item
              onSelect={() => {
                setMomentOpen(true);
                setLoadingVideos(true);
                void fetch("/api/me/banner-videos")
                  .then((r) => (r.ok ? r.json() : { videos: [] }))
                  .catch(() => ({ videos: [] }))
                  .then((d: { videos: CoverVideo[] }) => {
                    setCoverVideos(d.videos);
                    setLoadingVideos(false);
                  });
              }}
            >
              <Clapperboard className="h-4 w-4 text-fg-accent" /> {t("movingCover.menu")}
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item onSelect={() => input.current?.click()}>
            <ImagePlus className="h-4 w-4 text-fg-accent" /> {t("settings.pictures.upload")}
          </DropdownMenu.Item>
          {hasPicture && (
            <DropdownMenu.Item tone="danger" onSelect={() => void save(null, null)}>
              <Trash2 className="h-4 w-4" /> {t("settings.pictures.remove")}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      {error && <p role="alert" className="absolute mt-2 w-64 rounded-lg bg-danger px-3 py-2 text-xs text-fg-on-media shadow-lg">{error}</p>}

      {movingCover && !isAvatar && <BannerMomentDialog open={momentOpen} onOpenChange={setMomentOpen} videos={coverVideos} loading={loadingVideos} onPick={(c) => void saveMoment(c)} />}

      <Dialog.Root open={choosing} onOpenChange={setChoosing}>
        <Sheet size="lg" aria-describedby={undefined}>
          <Dialog.Header>
            <Dialog.Title>{t("settings.pictures.presetsTitle")}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <div className={cn("grid max-h-[60vh] gap-3 overflow-y-auto p-1", isAvatar ? "grid-cols-4" : "grid-cols-2")}>
              {presets.length === 0
                ? Array.from({ length: isAvatar ? 15 : 9 }, (_, i) => <Skeleton key={i} shape="rect" className={cn("h-auto rounded-2xl", isAvatar ? "aspect-square" : "aspect-3/1")} />)
                : presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setChoosing(false);
                        void save(p.id, p.url);
                      }}
                      aria-pressed={current === p.url}
                      className={cn("overflow-hidden rounded-2xl ring-2 transition-all hover:scale-[1.03] hover:ring-ring focus-visible:outline-hidden focus-visible:ring-ring", current === p.url ? "ring-accent" : "ring-transparent")}
                    >
                      <img src={p.url} alt={p.name} className={cn("w-full object-cover", isAvatar ? "aspect-square" : "aspect-3/1")} />
                    </button>
                  ))}
            </div>
          </Dialog.Body>
        </Sheet>
      </Dialog.Root>
    </div>
  );
}
