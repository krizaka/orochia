"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, Link2, Loader2, Lock, User, UserX, Wallet, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Switch } from "@/components/ui";
import { SocialIcon } from "@/components/SocialIcon";
import { latestAdultBirthDate } from "@/components/BirthDateField";
import { t, type MessageKey } from "@/lib/i18n";

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
  emailsOff: string[];
  inAppOff: string[];
  emailFrequency: "INSTANT" | "HOURLY" | "NONE";
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


/**
 * Account settings, in sections that each save on their own: profile (pictures, name, bio, private details),
 * links, privacy, notifications, payouts (creators), sign-in methods and blocked accounts.
 */
export function ProfileSettingsPanel({ isCreator }: { isCreator: boolean }) {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [identities, setIdentities] = useState<ConnectedIdentity[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState("");
  const [emailsOff, setEmailsOff] = useState<string[]>([]);
  const [inAppOff, setInAppOff] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<Profile["emailFrequency"]>("INSTANT");
  const identity = useSaver();
  const birth = useSaver();
  const linkSaver = useSaver();
  const prefs = useSaver();

  // The open section follows the address (#settings-…), and an address with a section opens there.
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (profile && window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" });
  }, [profile]);

  const load = useCallback(async () => {
    const [p, b, i] = await Promise.all([
      fetch("/api/me/profile", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/me/blocks", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/me/identities", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null, null]);
    if (p?.profile) {
      const prof = p.profile as Profile;
      setProfile(prof);
      setDisplayName(prof.displayName ?? "");
      setBio(prof.bio ?? "");
      setLinks(prof.socialLinks ?? {});
      setWebsite(prof.websiteUrl ?? "");
      setEmailsOff(prof.emailsOff ?? []);
      setInAppOff(prof.inAppOff ?? []);
      setFrequency(prof.emailFrequency ?? "INSTANT");
    }
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
  const setChannel = (channel: "inApp" | "email", next: string[]) => {
    if (channel === "inApp") setInAppOff(next);
    else setEmailsOff(next);
    void prefs.run(() => put(channel === "inApp" ? { inAppOff: next } : { emailsOff: next }));
  };
  const toggle = (list: string[], e: string, on: boolean) => (on ? list.filter((x) => x !== e) : [...list, e]);

  const sections = (["profile", "links", "privacy", "notifications", "payouts", "accounts", "blocked"] as const).filter((s) => isCreator || s !== "payouts");

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      {/* Each section has its own address (/dashboard?tab=settings#settings-links): shareable, reloadable. */}
      <nav aria-label={t("settings.title")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-1 lg:sticky lg:top-24 lg:flex-col">
          {sections.map((id) => (
            <li key={id}>
              <a
                href={`#settings-${id}`}
                aria-current={hash === `#settings-${id}` ? "location" : undefined}
                className={`block whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  hash === `#settings-${id}`
                    ? "bg-violet-600/15 text-violet-200 light:text-violet-700"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white light:text-slate-500 light:hover:bg-black/5 light:hover:text-slate-950"
                }`}
              >
                {t(`settings.sections.${id}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    <div className="min-w-0 max-w-3xl space-y-6">
      <Section id="profile" icon={<User className="h-4 w-4" />} title={t("settings.sections.profile")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t("settings.identity.displayName")}</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} required className={field} />
            <span className={hint}>{t("settings.identity.displayNameHint")}</span>
          </label>
          <div>
            <span className={label}>{t("settings.identity.username")}</span>
            <div className={`${field} flex items-center justify-between gap-2 font-mono text-zinc-400 light:text-slate-500`}>
              @{profile.username}
              <Link href={`/@${profile.username}`} className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-violet-300 hover:underline light:text-violet-700">
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
        <p className="-mt-2 mb-4 text-xs text-zinc-400 light:text-slate-500">{t("settings.notifications.intro")}</p>
        <div className="overflow-hidden rounded-2xl border border-white/10 light:border-black/10">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 light:border-black/10 light:bg-black/[0.02] light:text-slate-500 sm:grid-cols-[minmax(0,1fr)_96px_96px]">
            <span />
            <span className="text-center">{t("settings.notifications.inApp")}</span>
            <span className="text-center">{t("settings.notifications.byEmail")}</span>
          </div>
          {[{ id: "all", label: t("settings.notifications.all") }, ...events.map((e) => ({ id: e, label: t(`settings.notifications.events.${e}`) }))].map((row) => {
            const all = row.id === "all";
            const inOn = all ? events.every((e) => !inAppOff.includes(e)) : !inAppOff.includes(row.id);
            const mailOn = all ? events.every((e) => !emailsOff.includes(e)) : !emailsOff.includes(row.id);
            return (
              <div
                key={row.id}
                className={`grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_96px_96px] ${all ? "border-b border-white/10 font-semibold light:border-black/10" : "border-b border-white/5 last:border-0 light:border-black/5"}`}
              >
                <span className="text-sm text-zinc-200 light:text-slate-800">{row.label}</span>
                <span className="flex justify-center">
                  <Switch checked={inOn} label={`${row.label} — ${t("settings.notifications.inApp")}`} onChange={(on) => setChannel("inApp", all ? (on ? [] : [...EVENTS]) : toggle(inAppOff, row.id, on))} />
                </span>
                <span className="flex justify-center">
                  <Switch checked={mailOn} disabled={frequency === "NONE"} label={`${row.label} — ${t("settings.notifications.byEmail")}`} onChange={(on) => setChannel("email", all ? (on ? [] : [...EVENTS]) : toggle(emailsOff, row.id, on))} />
                </span>
              </div>
            );
          })}
        </div>

        <span className={`${label} mt-5`}>{t("settings.notifications.frequency")}</span>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 p-1 light:border-black/10" role="radiogroup" aria-label={t("settings.notifications.frequency")}>
          {(["INSTANT", "HOURLY", "NONE"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={frequency === f}
              onClick={() => {
                setFrequency(f);
                void prefs.run(() => put({ emailFrequency: f }));
              }}
              className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                frequency === f ? "bg-violet-600 text-white shadow" : "text-zinc-400 hover:bg-white/5 hover:text-white light:text-slate-600 light:hover:bg-black/5 light:hover:text-slate-950"
              }`}
            >
              {t(`settings.notifications.frequencies.${f}`)}
            </button>
          ))}
        </div>
        <span className={hint}>{t("settings.notifications.frequencyHint")}</span>
        {(prefs.state === "saved" || prefs.error) && (
          <p role="status" className={`mt-2 text-xs ${prefs.error ? "text-rose-400" : "text-emerald-400 light:text-emerald-600"}`}>
            {prefs.error ?? t("settings.saved")}
          </p>
        )}
      </Section>

      {isCreator && (
        <Section id="payouts" icon={<Wallet className="h-4 w-4" />} title={t("settings.sections.payouts")}>
          <p className="-mt-2 mb-4 text-xs text-zinc-400 light:text-slate-500">{t("settings.payouts.hint")}</p>
          <Link href="/earnings#payouts" className={ghost}>
            <Wallet className="h-3.5 w-3.5" /> {t("settings.payouts.request")}
          </Link>
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
    </div>
  );
}
