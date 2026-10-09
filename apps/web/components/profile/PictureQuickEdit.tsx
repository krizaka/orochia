"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Palette, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";

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
  onChanged,
  className = "",
}: {
  kind: "avatar" | "banner";
  hasPicture: boolean;
  onChanged: (url: string | null) => void;
  className?: string;
}) {
  const isAvatar = kind === "avatar";
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const save = async (choice: string | null, preview: string | null) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [kind]: choice }) });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error || t("settings.failed"));
    onChanged(preview);
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

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-fg hover:bg-surface-3";

  return (
    <div ref={menu} className={`z-20 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(isAvatar ? "settings.pictures.editAvatar" : "settings.pictures.editBanner")}
        className={`flex items-center gap-1.5 rounded-full bg-scrim text-fg-on-media shadow-lg ring-1 ring-white/20 backdrop-blur-md transition-all hover:bg-black/80 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 ${
          open ? "opacity-100!" : ""
        } ${isAvatar ? "h-9 w-9 justify-center" : "px-3.5 py-2 text-xs font-semibold"}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {!isAvatar && <span>{hasPicture ? t("settings.pictures.editBanner") : t("settings.pictures.add")}</span>}
      </button>

      {open && (
        <div role="menu" className={`kz-pop absolute mt-2 w-56 rounded-2xl border border-border-default bg-surface-2/95 p-1.5 shadow-2xl backdrop-blur-xl ${isAvatar ? "left-0" : "right-0"}`}>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); input.current?.click(); }}>
            <ImagePlus className="h-4 w-4 text-accent" /> {t("settings.pictures.upload")}
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); setChoosing(true); void loadPresets().then((p) => setPresets(isAvatar ? p.avatars : p.banners)); }}>
            <Palette className="h-4 w-4 text-accent" /> {t("settings.pictures.choose")}
          </button>
          {hasPicture && (
            <button role="menuitem" type="button" className={`${item} text-danger`} onClick={() => { setOpen(false); void save(null, null); }}>
              <Trash2 className="h-4 w-4" /> {t("settings.pictures.remove")}
            </button>
          )}
        </div>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      {error && <p role="alert" className="absolute mt-2 w-64 rounded-lg bg-danger px-3 py-2 text-xs text-white shadow-lg">{error}</p>}

      {choosing && (
        <div className="fixed inset-0 z-70 flex items-end justify-center bg-scrim-strong backdrop-blur-xs kz-overlay sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("settings.pictures.presetsTitle")} onClick={() => setChoosing(false)}>
          <div className="w-full max-w-lg rounded-t-3xl border border-border-default bg-surface-1 p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="mb-4 text-sm font-bold text-fg">{t("settings.pictures.presetsTitle")}</h4>
            <div className={`grid max-h-[60vh] gap-3 overflow-y-auto p-1 ${isAvatar ? "grid-cols-4" : "grid-cols-2"}`}>
              {presets.length === 0
                ? Array.from({ length: isAvatar ? 8 : 6 }, (_, i) => <span key={i} className={`animate-pulse rounded-2xl bg-white/5 ${isAvatar ? "aspect-square" : "aspect-3/1"}`} />)
                : presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setChoosing(false); void save(p.id, p.url); }}
                      className="overflow-hidden rounded-2xl ring-2 ring-transparent transition-all hover:scale-[1.03] hover:ring-ring"
                    >
                      <img src={p.url} alt={p.name} className={`w-full object-cover ${isAvatar ? "aspect-square" : "aspect-3/1"}`} />
                    </button>
                  ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setChoosing(false)} className="rounded-xl px-4 py-2 text-xs font-semibold text-fg-secondary hover:bg-surface-2">
                {t("settings.pictures.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
