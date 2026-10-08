"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, ImagePlus, Link2, Loader2, Lock, Palette, Trash2, User, UserX, Wallet, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SocialIcon } from "@/components/SocialIcon";
import { latestAdultBirthDate } from "@/components/BirthDateField";
import { t, type MessageKey } from "@/lib/i18n";

interface PresetItem {
  id: string;
  name: string;
  url: string;
}
interface BlockedUser {
  id: string;
  blockedUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
}
interface ConnectedIdentity {
  id: string;
  provider: string;
  email: string | null;
  createdAt: string;
}
interface Profile {
  username: string;
  email: string;
  dateOfBirth: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string>;
  networks: string[];
  notificationsOff: string[];
  directMessagePrivacy: "EVERYONE" | "CONTACTS_ONLY";
  payoutAddressCrypto: string | null;
}

const EVENTS = ["newFollower", "contactRequest", "newComment", "commentReply", "newMessage", "tipReceived", "videoUnlocked", "videoReady", "creatorPublished"] as const;
const CREATOR_EVENTS = new Set(["tipReceived", "videoUnlocked", "videoReady", "newFollower"]);

const label = "mb-1.5 block text-xs font-semibold text-zinc-300 light:text-slate-700";
const hint = "mt-1 block text-[11px] leading-relaxed text-zinc-500 light:text-slate-500";
const field =
  "w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none light:border-black/10 light:bg-slate-50 light:text-slate-900 light:placeholder:text-slate-400";
const ghost = "inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-violet-500/60 hover:text-white light:border-black/10 light:text-slate-700 light:hover:text-slate-950";

async function put(body: object): Promise<string | null> {
  const res = await fetch("/api/me/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || t("settings.failed");
}

function Section({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section id={`settings-${id}`} aria-labelledby={`settings-${id}-title`} className="glass-panel scroll-mt-24 rounded-3xl p-5 sm:p-7">
      <h3 id={`settings-${id}-title`} className="mb-5 flex items-center gap-2 text-sm font-bold text-white light:text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/15 text-violet-300 light:text-violet-700">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Save button + its outcome, for a section that saves on demand. */
function SaveRow({ state, error, onSave }: { state: "idle" | "saving" | "saved"; error: string | null; onSave: () => void }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={state === "saving"}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/20 disabled:opacity-50"
      >
        {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {state === "saving" ? t("settings.saving") : t("settings.save")}
      </button>
      {state === "saved" && (
        <span role="status" className="flex items-center gap-1 text-xs font-semibold text-emerald-400 light:text-emerald-600">
          <Check className="h-3.5 w-3.5" /> {t("settings.saved")}
        </span>
      )}
      {error && <span role="alert" className="text-xs text-rose-400 light:text-rose-600">{error}</span>}
    </div>
  );
}

function useSaver() {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<string | null>) => {
    setState("saving");
    setError(null);
    const failure = await action();
    setError(failure);
    setState(failure ? "idle" : "saved");
    if (!failure) setTimeout(() => setState("idle"), 2500);
    return !failure;
  };
  return { state, error, run };
}

function Switch({ checked, onChange, labelText, hintText }: { checked: boolean; onChange: (v: boolean) => void; labelText: string; hintText?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
      <span>
        <span className="block text-sm text-zinc-200 light:text-slate-800">{labelText}</span>
        {hintText && <span className="block text-[11px] text-zinc-500 light:text-slate-500">{hintText}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-zinc-700 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-violet-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400 light:bg-slate-300"
      />
    </label>
  );
}

/** One picture (photo or cover): upload your own, pick a design, or remove it. Saved at once. */
function PictureEditor({
  kind,
  url,
  presets,
  onChanged,
}: {
  kind: "avatar" | "banner";
  url: string | null;
  presets: PresetItem[];
  onChanged: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const isAvatar = kind === "avatar";

  const save = async (choice: string | null, preview: string | null) => {
    setBusy(true);
    setError(null);
    const failure = await put({ [kind]: choice });
    setBusy(false);
    if (failure) return setError(failure);
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

  return (
    <div>
      <span className={label}>{t(isAvatar ? "settings.pictures.avatar" : "settings.pictures.banner")}</span>
      <div className="flex flex-wrap items-center gap-4">
        <div className={`relative shrink-0 overflow-hidden border border-white/10 bg-zinc-800 light:border-black/10 light:bg-slate-100 ${isAvatar ? "h-20 w-20 rounded-2xl" : "h-20 w-36 rounded-xl"}`}>
          {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-zinc-500"><User className="h-6 w-6" /></span>}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className={ghost}>
            <ImagePlus className="h-3.5 w-3.5" /> {t("settings.pictures.upload")}
          </button>
          <button type="button" onClick={() => setChoosing(true)} disabled={busy} className={ghost}>
            <Palette className="h-3.5 w-3.5" /> {t("settings.pictures.choose")}
          </button>
          {url && (
            <button type="button" onClick={() => save(null, null)} disabled={busy} className={`${ghost} hover:border-rose-500/60 hover:text-rose-300`}>
              <Trash2 className="h-3.5 w-3.5" /> {t("settings.pictures.remove")}
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-400 light:text-rose-600">{error}</p>}

      {choosing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("settings.pictures.presetsTitle")}>
          <div className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl light:border-black/10 light:bg-white sm:rounded-3xl">
            <h4 className="mb-4 text-sm font-bold text-white light:text-slate-900">{t("settings.pictures.presetsTitle")}</h4>
            <div className={`grid max-h-[60vh] gap-3 overflow-y-auto p-1 ${isAvatar ? "grid-cols-4" : "grid-cols-2"}`}>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setChoosing(false);
                    void save(p.id, p.url);
                  }}
                  aria-pressed={url === p.url}
                  className={`overflow-hidden rounded-2xl border-2 transition-all ${url === p.url ? "border-violet-500" : "border-transparent hover:border-violet-500/50"}`}
                >
                  <img src={p.url} alt={p.name} className={`w-full object-cover ${isAvatar ? "aspect-square" : "aspect-[3/1]"}`} />
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setChoosing(false)} className={ghost}>
                {t("settings.pictures.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Account settings, in sections that each save on their own: profile (pictures, name, bio, private details),
 * links, privacy, notifications, payouts (creators), sign-in methods and blocked accounts.
 */
export function ProfileSettingsPanel({ isCreator }: { isCreator: boolean }) {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [presets, setPresets] = useState<{ avatars: PresetItem[]; banners: PresetItem[] }>({ avatars: [], banners: [] });
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [identities, setIdentities] = useState<ConnectedIdentity[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [off, setOff] = useState<string[]>([]);
  const identity = useSaver();
  const birth = useSaver();
  const linkSaver = useSaver();
  const payout = useSaver();
  const prefs = useSaver();

  const load = useCallback(async () => {
    const [p, pr, b, i] = await Promise.all([
      fetch("/api/me/profile", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/reference/presets").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/me/blocks", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/me/identities", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null, null, null]);
    if (p?.profile) {
      const prof = p.profile as Profile;
      setProfile(prof);
      setDisplayName(prof.displayName ?? "");
      setBio(prof.bio ?? "");
      setLinks(prof.socialLinks ?? {});
      setWebsite(prof.websiteUrl ?? "");
      setPayoutAddress(prof.payoutAddressCrypto ?? "");
      setOff(prof.notificationsOff ?? []);
    }
    if (pr) setPresets({ avatars: pr.avatars ?? [], banners: pr.banners ?? [] });
    if (b) setBlocked(b.blocked ?? []);
    if (i) setIdentities(i.identities ?? []);
  }, []);
  useEffect(() => void load(), [load]);

  if (!profile) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const events = EVENTS.filter((e) => isCreator || !CREATOR_EVENTS.has(e));
  const setPrefs = (next: string[]) => {
    setOff(next);
    void prefs.run(() => put({ notificationsOff: next }));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Section id="profile" icon={<User className="h-4 w-4" />} title={t("settings.sections.profile")}>
        <div className="grid gap-6 sm:grid-cols-2">
          <PictureEditor
            kind="avatar"
            url={profile.avatarUrl}
            presets={presets.avatars}
            onChanged={(url) => {
              setProfile({ ...profile, avatarUrl: url });
              void refresh();
            }}
          />
          <PictureEditor kind="banner" url={profile.bannerUrl} presets={presets.banners} onChanged={(url) => setProfile({ ...profile, bannerUrl: url })} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t("settings.identity.displayName")}</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} required className={field} />
            <span className={hint}>{t("settings.identity.displayNameHint")}</span>
          </label>
          <div>
            <span className={label}>{t("settings.identity.username")}</span>
            <div className={`${field} flex items-center justify-between gap-2 font-mono text-zinc-400 light:text-slate-500`}>
              @{profile.username}
              <Link href={`/creators/${profile.username}`} className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-violet-300 hover:underline light:text-violet-700">
                {t("settings.identity.viewProfile")} <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <span className={hint}>{t("settings.identity.usernameHint", { username: profile.username })}</span>
          </div>
        </div>
        <label className="mt-4 block">
          <span className={label}>{t("settings.identity.bio")}</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={1000} placeholder={t("settings.identity.bioPlaceholder")} className={`${field} resize-y`} />
        </label>
        <SaveRow state={identity.state} error={identity.error} onSave={() => void identity.run(async () => {
          const failure = await put({ displayName, bio });
          if (!failure) void refresh();
          return failure;
        })} />

        <div className="mt-6 grid gap-4 border-t border-white/5 pt-5 light:border-black/5 sm:grid-cols-2">
          <div>
            <span className={`${label} flex items-center gap-1.5`}><Lock className="h-3 w-3" /> {t("settings.identity.email")}</span>
            <div className={`${field} truncate text-zinc-400 light:text-slate-500`}>{profile.email}</div>
            <span className={hint}>{t("settings.identity.emailHint")}</span>
          </div>
          <div>
            <span className={`${label} flex items-center gap-1.5`}><Lock className="h-3 w-3" /> {t("settings.identity.birthDate")}</span>
            {profile.dateOfBirth ? (
              <div className={`${field} text-zinc-400 light:text-slate-500`}>
                {new Date(`${profile.dateOfBirth}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="date" value={birthDate} max={latestAdultBirthDate()} min="1900-01-01" onChange={(e) => setBirthDate(e.target.value)} aria-label={t("settings.identity.birthDateAdd")} className={`${field} [color-scheme:dark] light:[color-scheme:light]`} />
                <button
                  type="button"
                  disabled={!birthDate || birth.state === "saving"}
                  onClick={() => void birth.run(async () => {
                    const res = await fetch("/api/me/birth-date", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dateOfBirth: birthDate }) });
                    if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error || t("settings.failed");
                    setProfile({ ...profile, dateOfBirth: birthDate });
                    return null;
                  })}
                  className="shrink-0 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white disabled:opacity-40"
                >
                  {t("settings.save")}
                </button>
              </div>
            )}
            <span className={hint}>{t("settings.identity.birthDateHint")}</span>
            {birth.error && <span role="alert" className="mt-1 block text-xs text-rose-400 light:text-rose-600">{birth.error}</span>}
          </div>
        </div>
      </Section>

      <Section id="links" icon={<Link2 className="h-4 w-4" />} title={t("settings.sections.links")}>
        <p className="-mt-2 mb-4 text-xs text-zinc-400 light:text-slate-500">{t("settings.links.intro")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {profile.networks.map((network) => (
            <label key={network} className="block">
              <span className={`${label} flex items-center gap-1.5`}>
                <SocialIcon network={network} className="h-3.5 w-3.5" /> {t(`profile.networks.${network}` as MessageKey)}
              </span>
              <input
                value={links[network] ?? ""}
                onChange={(e) => setLinks({ ...links, [network]: e.target.value })}
                maxLength={200}
                placeholder={t("settings.links.handlePlaceholder")}
                autoCapitalize="none"
                spellCheck={false}
                className={field}
              />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className={`${label} flex items-center gap-1.5`}>
              <SocialIcon network="website" className="h-3.5 w-3.5" /> {t("settings.links.website")}
            </span>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} placeholder={t("settings.links.websitePlaceholder")} className={field} />
          </label>
        </div>
        <SaveRow state={linkSaver.state} error={linkSaver.error} onSave={() => void linkSaver.run(() => put({ socialLinks: links, websiteUrl: website }))} />
      </Section>

      <Section id="privacy" icon={<Lock className="h-4 w-4" />} title={t("settings.sections.privacy")}>
        <span className={label}>{t("settings.privacy.messages")}</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["EVERYONE", "CONTACTS_ONLY"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={profile.directMessagePrivacy === value}
              onClick={() => {
                setProfile({ ...profile, directMessagePrivacy: value });
                void prefs.run(() => put({ directMessagePrivacy: value }));
              }}
              className={`rounded-2xl border p-3.5 text-left transition-colors ${
                profile.directMessagePrivacy === value ? "border-violet-500 bg-violet-600/10" : "border-white/10 hover:border-white/25 light:border-black/10 light:hover:border-black/25"
              }`}
            >
              <span className="block text-sm font-semibold text-white light:text-slate-900">{t(value === "EVERYONE" ? "settings.privacy.everyone" : "settings.privacy.contacts")}</span>
              <span className="mt-0.5 block text-[11px] text-zinc-400 light:text-slate-500">{t(value === "EVERYONE" ? "settings.privacy.everyoneHint" : "settings.privacy.contactsHint")}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section id="notifications" icon={<Bell className="h-4 w-4" />} title={t("settings.sections.notifications")}>
        <p className="-mt-2 mb-3 text-xs text-zinc-400 light:text-slate-500">{t("settings.notifications.intro")}</p>
        <div className="rounded-2xl border border-white/10 px-4 light:border-black/10">
          <Switch
            checked={events.every((e) => !off.includes(e))}
            onChange={(on) => setPrefs(on ? [] : [...EVENTS])}
            labelText={t("settings.notifications.all")}
            hintText={t("settings.notifications.allHint")}
          />
        </div>
        <div className="mt-2 divide-y divide-white/5 px-4 light:divide-black/5">
          {events.map((e) => (
            <Switch
              key={e}
              checked={!off.includes(e)}
              onChange={(on) => setPrefs(on ? off.filter((x) => x !== e) : [...off, e])}
              labelText={t(`settings.notifications.events.${e}`)}
            />
          ))}
        </div>
        {(prefs.state === "saved" || prefs.error) && (
          <p role="status" className={`mt-2 text-xs ${prefs.error ? "text-rose-400" : "text-emerald-400 light:text-emerald-600"}`}>
            {prefs.error ?? t("settings.saved")}
          </p>
        )}
      </Section>

      {isCreator && (
        <Section id="payouts" icon={<Wallet className="h-4 w-4" />} title={t("settings.sections.payouts")}>
          <label className="block">
            <span className={label}>{t("settings.payouts.address")}</span>
            <input value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)} maxLength={200} placeholder={t("settings.payouts.addressPlaceholder")} className={`${field} font-mono`} />
            <span className={hint}>{t("settings.payouts.hint")}</span>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <SaveRow state={payout.state} error={payout.error} onSave={() => void payout.run(() => put({ payoutAddressCrypto: payoutAddress }))} />
            <Link href="/creator/payouts" className={`${ghost} mt-5`}>
              <Wallet className="h-3.5 w-3.5" /> {t("settings.payouts.request")}
            </Link>
          </div>
        </Section>
      )}

      <Section id="accounts" icon={<KeyRound className="h-4 w-4" />} title={t("settings.sections.accounts")}>
        <p className="-mt-2 mb-3 text-xs text-zinc-400 light:text-slate-500">{t("settings.accounts.intro")}</p>
        {identities.length === 0 ? (
          <p className="text-xs text-zinc-500">{t("settings.accounts.none")}</p>
        ) : (
          <ul className="divide-y divide-white/5 light:divide-black/5">
            {identities.map((id) => (
              <li key={id.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-semibold capitalize text-white light:text-slate-900">{id.provider.toLowerCase()}</span>
                  {id.email && <span className="ml-2 text-xs text-zinc-400">{id.email}</span>}
                  <span className="block text-[11px] text-zinc-500">{t("settings.accounts.linkedOn", { date: new Date(id.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) })}</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`/api/me/identities/${id.id}`, { method: "DELETE" });
                    if (res.ok) setIdentities((all) => all.filter((x) => x.id !== id.id));
                  }}
                  className={`${ghost} hover:border-rose-500/60 hover:text-rose-300`}
                >
                  {t("settings.accounts.unlink")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="blocked" icon={<UserX className="h-4 w-4" />} title={t("settings.sections.blocked")}>
        <p className="-mt-2 mb-3 text-xs text-zinc-400 light:text-slate-500">{t("settings.blocked.intro")}</p>
        {blocked.length === 0 ? (
          <p className="text-xs text-zinc-500">{t("settings.blocked.none")}</p>
        ) : (
          <ul className="divide-y divide-white/5 light:divide-black/5">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="flex items-center gap-3">
                  {b.avatarUrl ? <img src={b.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400"><User className="h-4 w-4" /></span>}
                  <span>
                    <span className="font-semibold text-white light:text-slate-900">{b.displayName || b.blockedUsername}</span>
                    <span className="ml-1.5 font-mono text-xs text-zinc-500">@{b.blockedUsername}</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`/api/users/${b.blockedUsername}/block`, { method: "POST" });
                    if (res.ok) setBlocked((all) => all.filter((x) => x.id !== b.id));
                  }}
                  className={ghost}
                >
                  {t("settings.blocked.unblock")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
