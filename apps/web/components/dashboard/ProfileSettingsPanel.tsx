"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  User,
  Shield,
  Sparkles,
  Globe,
  AtSign,
  Lock,
  UserX,
  Check,
  Loader2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

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
  createdAt: string;
}

interface ConnectedIdentity {
  id: string;
  provider: string;
  email: string | null;
  createdAt: string;
}

export function ProfileSettingsPanel({ isCreator }: { isCreator: boolean }) {
  const { user, refresh } = useAuth();

  // Basic profile state
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [directMessagePrivacy, setDirectMessagePrivacy] = useState<"EVERYONE" | "CONTACTS_ONLY">("EVERYONE");
  const [payoutAddress, setPayoutAddress] = useState(user?.payoutAddressCrypto || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [bannerUrl, setBannerUrl] = useState("");

  // Presets state
  const [presets, setPresets] = useState<{ avatars: PresetItem[]; banners: PresetItem[] }>({
    avatars: [],
    banners: [],
  });
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);

  // Blocked users & identities
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [identities, setIdentities] = useState<ConnectedIdentity[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load detailed profile & presets
  const loadProfileData = useCallback(async () => {
    try {
      setLoadingExtras(true);
      // 1. Load presets
      const presRes = await fetch("/api/reference/presets");
      if (presRes.ok) {
        const presData = await presRes.json();
        setPresets({ avatars: presData.avatars || [], banners: presData.banners || [] });
      }

      // 2. Load profile
      const profRes = await fetch("/api/me/profile");
      if (profRes.ok) {
        const profData = await profRes.json();
        const p = profData.profile || {};
        if (p.websiteUrl) setWebsiteUrl(p.websiteUrl);
        if (p.twitterHandle) setTwitterHandle(p.twitterHandle);
        if (p.directMessagePrivacy) setDirectMessagePrivacy(p.directMessagePrivacy);
        if (p.bannerUrl) setBannerUrl(p.bannerUrl);
        if (p.avatarUrl) setAvatarUrl(p.avatarUrl);
      }

      // 3. Load blocked users
      const blockRes = await fetch("/api/me/blocks");
      if (blockRes.ok) {
        const blockData = await blockRes.json();
        setBlockedUsers(blockData.blocked || []);
      }

      // 4. Load identities
      const idRes = await fetch("/api/me/identities");
      if (idRes.ok) {
        const idData = await idRes.json();
        setIdentities(idData.identities || []);
      }
    } catch (e) {
      console.error("Failed to load settings data", e);
    } finally {
      setLoadingExtras(false);
    }
  }, []);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          bio,
          avatarUrl,
          bannerUrl,
          websiteUrl,
          twitterHandle,
          directMessagePrivacy,
          payoutAddressCrypto: payoutAddress,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update profile");
      }

      setSaveSuccess(true);
      await refresh();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (username: string) => {
    try {
      const res = await fetch(`/api/users/${username}/block`, { method: "POST" });
      if (res.ok) {
        setBlockedUsers((prev) => prev.filter((b) => b.blockedUsername !== username));
      }
    } catch (e) {
      console.error("Failed to unblock", e);
    }
  };

  const handleUnlinkIdentity = async (identityId: string) => {
    try {
      const res = await fetch(`/api/me/identities/${identityId}`, { method: "DELETE" });
      if (res.ok) {
        setIdentities((prev) => prev.filter((i) => i.id !== identityId));
      }
    } catch (e) {
      console.error("Failed to unlink identity", e);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <form onSubmit={handleSaveProfile} className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
        <h3 className="text-base font-bold text-white font-display light:text-slate-900">
          Profile & Account Information
        </h3>

        {/* Visual Presets Selector Section */}
        <div className="space-y-4 pt-2 border-t border-white/5 light:border-black/5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block light:text-slate-500">
            Avatar & Banner Presets
          </label>

          <div className="flex flex-wrap items-center gap-6">
            {/* Avatar Preview & Action */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl overflow-hidden border border-white/10 bg-zinc-800 shadow-md">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-zinc-500">
                    <User className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 hover:border-violet-500/50 text-xs font-semibold text-white transition-colors"
                >
                  Choose Avatar Preset
                </button>
                <p className="text-[11px] text-zinc-500 mt-1">Select from styled vector personas</p>
              </div>
            </div>

            {/* Banner Preview & Action */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-28 rounded-xl overflow-hidden border border-white/10 bg-zinc-800 shadow-md">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-zinc-500 text-[10px]">
                    No banner
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowBannerModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 hover:border-violet-500/50 text-xs font-semibold text-white transition-colors"
                >
                  Choose Banner Preset
                </button>
                <p className="text-[11px] text-zinc-500 mt-1">Velvet Noir gradient backdrops</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Avatar Presets Grid */}
        {showAvatarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl light:bg-white light:border-black/10">
              <h4 className="text-sm font-bold text-white mb-3 light:text-slate-900">Choose Preset Avatar</h4>
              <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                {presets.avatars.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(a.url);
                      setShowAvatarModal(false);
                    }}
                    className={`flex flex-col items-center p-2 rounded-2xl border transition-all ${
                      avatarUrl === a.url
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-white/5 hover:border-violet-500/40 bg-zinc-900/40"
                    }`}
                  >
                    <img src={a.url} alt={a.name} className="h-12 w-12 rounded-full mb-1" />
                    <span className="text-[10px] text-zinc-300 truncate w-full text-center">{a.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Banner Presets Grid */}
        {showBannerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl light:bg-white light:border-black/10">
              <h4 className="text-sm font-bold text-white mb-3 light:text-slate-900">Choose Preset Banner</h4>
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
                {presets.banners.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBannerUrl(b.url);
                      setShowBannerModal(false);
                    }}
                    className={`flex flex-col items-center p-2 rounded-2xl border transition-all ${
                      bannerUrl === b.url
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-white/5 hover:border-violet-500/40 bg-zinc-900/40"
                    }`}
                  >
                    <img src={b.url} alt={b.name} className="h-16 w-full rounded-lg object-cover mb-1" />
                    <span className="text-[10px] text-zinc-300 truncate w-full text-center">{b.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowBannerModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Text Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
              Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
              Website URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourpage.com"
                maxLength={200}
                className="w-full rounded-xl border border-white/10 bg-zinc-900 pl-9 pr-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
            Twitter / X Handle
          </label>
          <div className="relative">
            <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value)}
              placeholder="@username"
              maxLength={50}
              className="w-full rounded-xl border border-white/10 bg-zinc-900 pl-9 pr-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
          />
        </div>

        {/* Direct Messaging Privacy Settings */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 space-y-2 light:bg-slate-50 light:border-black/10">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block light:text-slate-500">
            Direct Messaging Privacy
          </label>
          <p className="text-[11px] text-zinc-400 light:text-slate-500 mb-2">
            Configure who is permitted to send you direct messages.
          </p>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="dmPrivacy"
                value="EVERYONE"
                checked={directMessagePrivacy === "EVERYONE"}
                onChange={() => setDirectMessagePrivacy("EVERYONE")}
                className="text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs text-white light:text-slate-900">
                <strong>Everyone:</strong> Any registered Orochia member can initiate a chat.
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="dmPrivacy"
                value="CONTACTS_ONLY"
                checked={directMessagePrivacy === "CONTACTS_ONLY"}
                onChange={() => setDirectMessagePrivacy("CONTACTS_ONLY")}
                className="text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs text-white light:text-slate-900">
                <strong>Contacts Only:</strong> Only mutual contacts can message you.
              </span>
            </label>
          </div>
        </div>

        {isCreator && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
              Crypto Payout Address
            </label>
            <input
              value={payoutAddress}
              onChange={(e) => setPayoutAddress(e.target.value)}
              maxLength={200}
              placeholder="USDT-TRC20 / BTC address"
              className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-xs font-mono text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
            />
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/20 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <Check className="h-3.5 w-3.5" /> Saved successfully.
            </span>
          )}
          {saveError && <span className="text-xs text-rose-400">{saveError}</span>}
        </div>
      </form>

      {/* Connected OAuth Providers Panel */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 light:text-slate-500 mb-2">
          Connected OAuth Providers
        </h3>
        <p className="text-xs text-zinc-400 light:text-slate-500 mb-4">
          Your profile automatically links multiple authentication providers matching your email address.
        </p>

        {identities.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3">No external OAuth identities linked.</p>
        ) : (
          <ul className="divide-y divide-white/5 light:divide-black/5">
            {identities.map((id) => (
              <li key={id.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white capitalize light:text-slate-900">
                    {id.provider}
                  </span>
                  {id.email && <span className="ml-2 text-zinc-400 font-mono">({id.email})</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleUnlinkIdentity(id.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Unlink identity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Blocked Users Management */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-2">
          <UserX className="h-4 w-4 text-rose-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 light:text-slate-500">
            Blocked Users ({blockedUsers.length})
          </h3>
        </div>
        <p className="text-xs text-zinc-400 light:text-slate-500 mb-4">
          Blocked members cannot view your contact videos, request connections, or send direct messages.
        </p>

        {blockedUsers.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3">No blocked users.</p>
        ) : (
          <ul className="divide-y divide-white/5 light:divide-black/5">
            {blockedUsers.map((b) => (
              <li key={b.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white light:text-slate-900">
                      {b.displayName || b.blockedUsername}
                    </span>
                    <span className="ml-1 text-zinc-500 font-mono">@{b.blockedUsername}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnblock(b.blockedUsername)}
                  className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-violet-500/50 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
