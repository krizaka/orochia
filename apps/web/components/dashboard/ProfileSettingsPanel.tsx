"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, Flame, Link2, Lock, User, UserX, Wallet, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar, Button, buttonVariants, Input, SocialIcon, Spinner, Switch, Textarea } from "@/components/ui";
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
  challengeRequestsOff: boolean;
  challengeMinCents: number;
}

const EVENTS = [
  "newFollower",
  "contactRequest",
  "newComment",
  "commentReply",
  "newMessage",
  "tipReceived",
  "videoUnlocked",
  "videoReady",
  "creatorPublished",
  "auctionAnnounced",
  "auctionOutbid",
  "auctionWon",
  "auctionDeclined",
  "auctionNewBid",
  "auctionDecision",
  "auctionSold",
  "auctionUnsold",
  "challengeAnnounced",
  "challengeRequested",
  "challengePledged",
  "challengeFunded",
  "challengeAccepted",
  "challengeApplied",
  "challengeChosen",
  "challengeDelivered",
  "challengeReleased",
  "challengeClosed",
] as const;
const CREATOR_EVENTS = new Set([
  "tipReceived",
  "videoUnlocked",
  "videoReady",
  "newFollower",
  "auctionNewBid",
  "auctionDecision",
  "auctionSold",
  "auctionUnsold",
  "challengeRequested",
  "challengeFunded",
  "challengeChosen",
  "challengeClosed",
]);

const label = "mb-1.5 block text-xs font-semibold text-fg-secondary";
const hint = "mt-1 block text-[11px] leading-relaxed text-fg-muted";
const field =
  "w-full rounded-xl border border-border-default bg-surface-2 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-hidden";
const ghost = buttonVariants({ variant: "outline", size: "sm", shape: "rounded", className: "rounded-xl" });

async function put(body: object): Promise<string | null> {
  const res = await fetch("/api/me/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || t("settings.failed");
}

function Section({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section id={`settings-${id}`} aria-labelledby={`settings-${id}-title`} className="glass-panel scroll-mt-24 rounded-3xl p-5 sm:p-7">
      <h3 id={`settings-${id}-title`} className="mb-5 flex items-center gap-2 text-sm font-bold text-fg">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">{icon}</span>
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
      <Button variant="sensual" size="sm" shape="rounded" onClick={onSave} loading={state === "saving"} className="rounded-xl px-5 font-bold">
        {state === "saving" ? t("settings.saving") : t("settings.save")}
      </Button>
      {state === "saved" && (
        <span role="status" className="flex items-center gap-1 text-xs font-semibold text-success">
          <Check className="h-3.5 w-3.5" /> {t("settings.saved")}
        </span>
      )}
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
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
  const [challengeMin, setChallengeMin] = useState("10");
  const identity = useSaver();
  const birth = useSaver();
  const linkSaver = useSaver();
  const prefs = useSaver();
  const dares = useSaver();

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
      setChallengeMin(String((prof.challengeMinCents ?? 1000) / 100));
    }
    if (b) setBlocked(b.blocked ?? []);
    if (i) setIdentities(i.identities ?? []);
  }, []);
  useEffect(() => void load(), [load]);

  if (!profile) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
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

  const sections = (["profile", "links", "privacy", "challenges", "notifications", "payouts", "accounts", "blocked"] as const).filter((s) => isCreator || (s !== "payouts" && s !== "challenges"));

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      {/* Each section has its own address (/dashboard?tab=settings#settings-links): shareable, reloadable. */}
      <nav aria-label={t("settings.title")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
        <ul className="flex gap-1 lg:sticky lg:top-24 lg:flex-col">
          {sections.map((id) => (
            <li key={id}>
              <a
                href={`#settings-${id}`}
                aria-current={hash === `#settings-${id}` ? "location" : undefined}
                className={`block whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  hash === `#settings-${id}`
                    ? "bg-accent/15 text-accent"
                    : "text-fg-secondary hover:bg-surface-2 hover:text-fg"
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
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} required className="rounded-xl px-3.5" />
              <span className={hint}>{t("settings.identity.displayNameHint")}</span>
            </label>
            <div>
              <span className={label}>{t("settings.identity.username")}</span>
              <div className={`${field} flex items-center justify-between gap-2 font-mono text-fg-secondary`}>
                @{profile.username}
                <Link href={`/@${profile.username}`} className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-accent hover:underline">
                  {t("settings.identity.viewProfile")} <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <span className={hint}>{t("settings.identity.usernameHint", { username: profile.username })}</span>
            </div>
          </div>
          <label className="mt-4 block">
            <span className={label}>{t("settings.identity.bio")}</span>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={1000} placeholder={t("settings.identity.bioPlaceholder")} className="resize-y rounded-xl px-3.5" />
          </label>
          <SaveRow state={identity.state} error={identity.error} onSave={() => void identity.run(async () => {
            const failure = await put({ displayName, bio });
            if (!failure) void refresh();
            return failure;
          })} />

          <div className="mt-6 grid gap-4 border-t border-border-subtle pt-5 sm:grid-cols-2">
            <div>
              <span className={`${label} flex items-center gap-1.5`}><Lock className="h-3 w-3" /> {t("settings.identity.email")}</span>
              <div className={`${field} truncate text-fg-secondary`}>{profile.email}</div>
              <span className={hint}>{t("settings.identity.emailHint")}</span>
            </div>
            <div>
              <span className={`${label} flex items-center gap-1.5`}><Lock className="h-3 w-3" /> {t("settings.identity.birthDate")}</span>
              {profile.dateOfBirth ? (
                <div className={`${field} text-fg-secondary`}>
                  {new Date(`${profile.dateOfBirth}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input type="date" value={birthDate} max={latestAdultBirthDate()} min="1900-01-01" onChange={(e) => setBirthDate(e.target.value)} aria-label={t("settings.identity.birthDateAdd")} className="rounded-xl px-3.5" />
                  <Button
                    variant="sensual"
                    shape="rounded"
                    disabled={!birthDate}
                    loading={birth.state === "saving"}
                    onClick={() => void birth.run(async () => {
                      const res = await fetch("/api/me/birth-date", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dateOfBirth: birthDate }) });
                      if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error || t("settings.failed");
                      setProfile({ ...profile, dateOfBirth: birthDate });
                      return null;
                    })}
                    className="h-11 rounded-xl px-4 text-xs font-bold"
                  >
                    {t("settings.save")}
                  </Button>
                </div>
              )}
              <span className={hint}>{t("settings.identity.birthDateHint")}</span>
              {birth.error && <span role="alert" className="mt-1 block text-xs text-danger">{birth.error}</span>}
            </div>
          </div>
        </Section>

        <Section id="links" icon={<Link2 className="h-4 w-4" />} title={t("settings.sections.links")}>
          <p className="-mt-2 mb-4 text-xs text-fg-secondary">{t("settings.links.intro")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.networks.map((network) => (
              <label key={network} className="block">
                <span className={`${label} flex items-center gap-1.5`}>
                  <SocialIcon network={network} className="h-3.5 w-3.5" /> {t(`profile.networks.${network}` as MessageKey)}
                </span>
                <Input
                  value={links[network] ?? ""}
                  onChange={(e) => setLinks({ ...links, [network]: e.target.value })}
                  maxLength={200}
                  placeholder={t("settings.links.handlePlaceholder")}
                  autoCapitalize="none"
                  spellCheck={false}
                  className="rounded-xl px-3.5"
                />
              </label>
            ))}
            <label className="block sm:col-span-2">
              <span className={`${label} flex items-center gap-1.5`}>
                <SocialIcon network="website" className="h-3.5 w-3.5" /> {t("settings.links.website")}
              </span>
              <Input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} placeholder={t("settings.links.websitePlaceholder")} className="rounded-xl px-3.5" />
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
                  profile.directMessagePrivacy === value ? "border-accent bg-accent/10" : "border-border-default hover:border-border-strong"
                }`}
              >
                <span className="block text-sm font-semibold text-fg">{t(value === "EVERYONE" ? "settings.privacy.everyone" : "settings.privacy.contacts")}</span>
                <span className="mt-0.5 block text-[11px] text-fg-secondary">{t(value === "EVERYONE" ? "settings.privacy.everyoneHint" : "settings.privacy.contactsHint")}</span>
              </button>
            ))}
          </div>
        </Section>

        {isCreator && (
          <Section id="challenges" icon={<Flame className="h-4 w-4" />} title={t("settings.sections.challenges")}>
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-border-default p-4">
              <span>
                <span className="block text-sm font-semibold text-fg">{t("settings.challenges.accept")}</span>
                <span className="mt-0.5 block text-[11px] text-fg-secondary">{t("settings.challenges.acceptHint")}</span>
              </span>
              <Switch
                checked={!profile.challengeRequestsOff}
                label={t("settings.challenges.accept")}
                onChange={(on) => {
                  setProfile({ ...profile, challengeRequestsOff: !on });
                  void dares.run(() => put({ challengeRequestsOff: !on }));
                }}
              />
            </div>
            <label className="mt-4 block">
              <span className={label}>{t("settings.challenges.minimum")}</span>
              <span className="relative block max-w-48">
                <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-sm font-semibold text-fg-muted">$</span>
                <Input value={challengeMin} onChange={(e) => setChallengeMin(e.target.value)} type="number" min={1} max={10000} inputMode="decimal" className="rounded-xl pl-6 font-mono" />
              </span>
              <span className="mt-1 block text-[11px] text-fg-muted">{t("settings.challenges.minimumHint")}</span>
            </label>
            <SaveRow state={dares.state} error={dares.error} onSave={() => void dares.run(() => put({ challengeMinCents: Math.round(Number(challengeMin) * 100) }))} />
          </Section>
        )}

        <Section id="notifications" icon={<Bell className="h-4 w-4" />} title={t("settings.sections.notifications")}>
          <p className="-mt-2 mb-4 text-xs text-fg-secondary">{t("settings.notifications.intro")}</p>
          <div className="overflow-hidden rounded-2xl border border-border-default">
            <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-border-default bg-surface-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-fg-secondary sm:grid-cols-[minmax(0,1fr)_96px_96px]">
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
                  className={`grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_96px_96px] ${all ? "border-b border-border-default font-semibold" : "border-b border-border-subtle last:border-0"}`}
                >
                  <span className="text-sm text-fg">{row.label}</span>
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
          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border-default p-1" role="radiogroup" aria-label={t("settings.notifications.frequency")}>
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
                  frequency === f ? "bg-accent text-white shadow-sm" : "text-fg-secondary hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {t(`settings.notifications.frequencies.${f}`)}
              </button>
            ))}
          </div>
          <span className={hint}>{t("settings.notifications.frequencyHint")}</span>
          {(prefs.state === "saved" || prefs.error) && (
            <p role="status" className={`mt-2 text-xs ${prefs.error ? "text-danger" : "text-success"}`}>
              {prefs.error ?? t("settings.saved")}
            </p>
          )}
        </Section>

        {isCreator && (
          <Section id="payouts" icon={<Wallet className="h-4 w-4" />} title={t("settings.sections.payouts")}>
            <p className="-mt-2 mb-4 text-xs text-fg-secondary">{t("settings.payouts.hint")}</p>
            <Link href="/earnings#payouts" className={ghost}>
              <Wallet className="h-3.5 w-3.5" /> {t("settings.payouts.request")}
            </Link>
          </Section>
        )}

        <Section id="accounts" icon={<KeyRound className="h-4 w-4" />} title={t("settings.sections.accounts")}>
          <p className="-mt-2 mb-3 text-xs text-fg-secondary">{t("settings.accounts.intro")}</p>
          {identities.length === 0 ? (
            <p className="text-xs text-fg-muted">{t("settings.accounts.none")}</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {identities.map((id) => (
                <li key={id.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="font-semibold capitalize text-fg">{id.provider.toLowerCase()}</span>
                    {id.email && <span className="ml-2 text-xs text-fg-secondary">{id.email}</span>}
                    <span className="block text-[11px] text-fg-muted">{t("settings.accounts.linkedOn", { date: new Date(id.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) })}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    onClick={async () => {
                      const res = await fetch(`/api/me/identities/${id.id}`, { method: "DELETE" });
                      if (res.ok) setIdentities((all) => all.filter((x) => x.id !== id.id));
                    }}
                    className="rounded-xl hover:border-danger/60 hover:text-danger"
                  >
                    {t("settings.accounts.unlink")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="blocked" icon={<UserX className="h-4 w-4" />} title={t("settings.sections.blocked")}>
          <p className="-mt-2 mb-3 text-xs text-fg-secondary">{t("settings.blocked.intro")}</p>
          {blocked.length === 0 ? (
            <p className="text-xs text-fg-muted">{t("settings.blocked.none")}</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {blocked.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    <Avatar size="sm" src={b.avatarUrl} fallback={<User className="h-4 w-4" aria-hidden />} />
                    <span>
                      <span className="font-semibold text-fg">{b.displayName || b.blockedUsername}</span>
                      <span className="ml-1.5 font-mono text-xs text-fg-muted">@{b.blockedUsername}</span>
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    onClick={async () => {
                      const res = await fetch(`/api/users/${b.blockedUsername}/block`, { method: "POST" });
                      if (res.ok) setBlocked((all) => all.filter((x) => x.id !== b.id));
                    }}
                    className="rounded-xl"
                  >
                    {t("settings.blocked.unblock")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
