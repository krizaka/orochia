"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import * as tus from "tus-js-client";
import { UploadCloud, CheckCircle, Film, DollarSign, ShieldAlert, Sparkles } from "lucide-react";

interface Collection {
  id: string;
  title: string;
}

/**
 * Uploads a video straight to Bunny Stream over Tus (resumable): the API opens the session and
 * records the video, the bytes never cross our servers. Same path in every environment.
 */
export function UploadDropzone({ platformFeePercent }: { platformFeePercent: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "CONTACTS_ONLY" | "APPROVED_FOLLOWERS_ONLY" | "TIPPED_UNLOCKED" | "INVITED_ONLY">("PUBLIC");
  const [minTipAmountDollars, setMinTipAmountDollars] = useState("5.00");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetch("/api/playlists", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { playlists: [] }))
      .then((d: { playlists?: Collection[] }) => setCollections(d.playlists ?? []))
      .catch(() => setCollections([]));
  }, []);

  // Mandatory Legal Attestation states
  const [certifyAdultConsent, setCertifyAdultConsent] = useState(false);
  const [certify2257Records, setCertify2257Records] = useState(false);
  const [certifyCopyrightOwnership, setCertifyCopyrightOwnership] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pick = (selected: File | undefined) => {
    if (!selected) return;
    if (!selected.type.startsWith("video/")) {
      setErrorMessage("Choose a video file (MP4, MOV, MKV…).");
      return;
    }
    setErrorMessage(null);
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^/.]+$/, ""));
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => pick(e.target.files?.[0]);

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    if (!certifyAdultConsent || !certify2257Records || !certifyCopyrightOwnership) {
      setErrorMessage("You must accept all mandatory legal and 2257 compliance declarations prior to publishing.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setProgress(0);

    try {
      // 1. The API checks the creator, records the video and signs a Tus session for Bunny Stream.
      const minTipAmountCents =
        visibility === "TIPPED_UNLOCKED" ? Math.round(parseFloat(minTipAmountDollars || "0") * 100) : 0;

      const sessionRes = await fetch("/api/videos/create-upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          visibility,
          minTipAmountCents,
          tags: tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 12),
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(sessionData.error || "Failed to create upload session");
      }

      const { session, videoId } = sessionData as { session: typeof sessionData.session; videoId: string };
      // Filed in the chosen collection now; it shows there once encoding is finished.
      if (selectedCollection) {
        await fetch(`/api/playlists/${selectedCollection}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        }).catch(() => undefined);
      }

      // 2. Upload file directly to Bunny.net Tus endpoint
      const upload = new tus.Upload(file, {
        endpoint: session.tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          AuthorizationSignature: session.headers.AuthorizationSignature,
          AuthorizationExpire: String(session.headers.AuthorizationExpire),
          VideoId: session.headers.VideoId,
          LibraryId: String(session.headers.LibraryId),
        },
        metadata: {
          filetype: file.type,
          title: title,
        },
        onError: (error) => {
          console.error("Tus upload failure:", error);
          setErrorMessage(error.message);
          setIsUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setProgress(percentage);
        },
        onSuccess: () => {
          setIsUploading(false);
          setUploadComplete(true);
        },
      });

      upload.start();
    } catch (err: any) {
      setErrorMessage(err?.message || "Upload initiation failed");
      setIsUploading(false);
    }
  };

  const parsedTipAmount = parseFloat(minTipAmountDollars || "0");
  const platformFeeDollars = ((parsedTipAmount * platformFeePercent) / 100).toFixed(2);
  const creatorEarningsDollars = (parsedTipAmount - Number(platformFeeDollars)).toFixed(2);

  const canSubmit =
    file &&
    title.trim().length > 0 &&
    !isUploading &&
    certifyAdultConsent &&
    certify2257Records &&
    certifyCopyrightOwnership;

  return (
    <div className="w-full max-w-2xl mx-auto rounded-3xl border border-white/10 bg-zinc-950 p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20">
          <Film className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white font-display">Upload New Video</h2>
          <p className="text-xs text-zinc-400">
            Direct-to-Bunny global edge streaming with automatic 4K HLS transcoding
          </p>
        </div>
      </div>

      {uploadComplete ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/30">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 font-display">Video Uploaded Successfully!</h3>
          <p className="text-sm text-zinc-400 max-w-sm mb-6">
            Bunny.net Stream is transcoding your video into adaptive HLS resolutions (2160p, 1080p, 720p).
            It will appear in your creator gallery automatically once encoding is complete.
          </p>
          <button
            onClick={() => {
              setFile(null);
              setUploadComplete(false);
              setTitle("");
              setDescription("");
              setTags("");
              setSelectedCollection("");
              setCertifyAdultConsent(false);
              setCertify2257Records(false);
              setCertifyCopyrightOwnership(false);
            }}
            className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all"
          >
            Upload Another Video
          </button>
        </div>
      ) : (
        <form onSubmit={handleStartUpload} className="space-y-6">
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
              file || isDragging
                ? "border-violet-500 bg-violet-500/5"
                : "border-white/10 hover:border-violet-500/50 bg-zinc-900/40"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="video/*"
              className="hidden"
            />
            <UploadCloud className="h-10 w-10 text-violet-400 mb-3" />
            {file ? (
              <div className="text-center">
                <span className="text-sm font-semibold text-white">{file.name}</span>
                <span className="block text-xs text-zinc-400">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-sm font-semibold text-zinc-300">
                  Click to select video or drag & drop here
                </span>
                <span className="block text-xs text-zinc-500 mt-1">
                  MP4, MOV, MKV up to 50 GB. Resumable direct upload.
                </span>
              </div>
            )}
          </div>

          {/* Collection (optional): the creator's own collections */}
          {collections.length > 0 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Add to a collection <span className="normal-case tracking-normal text-zinc-500">— optional</span>
              </label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Video Metadata Form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Video Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midnight Private Session"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give your viewers context, performer credits, and highlights..."
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Tags <span className="normal-case tracking-normal text-zinc-500">— comma-separated, up to 12</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                maxLength={500}
                placeholder="e.g. acoustic, live, behind-the-scenes"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  Access & Monetization Model
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="PUBLIC">Public (Free for All)</option>
                  <option value="TIPPED_UNLOCKED">Tipped Paywall (Tip to Unlock)</option>
                  <option value="CONTACTS_ONLY">Contacts Only (Private Mutuals)</option>
                  <option value="APPROVED_FOLLOWERS_ONLY">VIP Approved Followers</option>
                  <option value="INVITED_ONLY">Invited Only (People & Lists)</option>
                </select>
                {visibility === "INVITED_ONLY" && (
                  <p className="mt-1.5 text-[11px] text-zinc-500">Only you can watch it until you choose who: Studio → the video → Who can watch.</p>
                )}
              </div>

              {visibility === "TIPPED_UNLOCKED" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                    Minimum Tip to Unlock ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      type="number"
                      step="0.50"
                      min="1.00"
                      value={minTipAmountDollars}
                      onChange={(e) => setMinTipAmountDollars(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 pl-9 pr-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Monetization Split Calculator Preview */}
            {visibility === "TIPPED_UNLOCKED" && (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4 text-xs">
                <div className="flex items-center justify-between font-semibold text-white mb-2">
                  <span className="flex items-center gap-1.5 text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Your revenue split</span>
                  </span>
                  <span className="text-emerald-400 font-mono">{100 - platformFeePercent}% Payout Rate</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-white/5">
                  <div className="rounded-lg bg-zinc-900/60 p-2">
                    <span className="text-zinc-500 block text-[10px]">Patron Tip</span>
                    <span className="font-mono font-bold text-white">${parsedTipAmount.toFixed(2)}</span>
                  </div>
                  <div className="rounded-lg bg-zinc-900/60 p-2">
                    <span className="text-zinc-500 block text-[10px]">Platform fee ({platformFeePercent}%)</span>
                    <span className="font-mono text-zinc-400">${platformFeeDollars}</span>
                  </div>
                  <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 p-2">
                    <span className="text-emerald-400 block text-[10px] font-bold">You receive ({100 - platformFeePercent}%)</span>
                    <span className="font-mono font-bold text-emerald-400">${creatorEarningsDollars}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Legal & 2257 Declarations */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white mb-1">
              <ShieldAlert className="h-4 w-4 text-fuchsia-400" />
              <span>Mandatory Performer & Legal Attestations</span>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={certifyAdultConsent}
                onChange={(e) => setCertifyAdultConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs text-zinc-300 leading-relaxed group-hover:text-white">
                <strong className="text-white">Age & Consent:</strong> I certify under penalty of perjury that all performers depicted are at least 18 years of age and provided explicit, voluntary written consent.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={certify2257Records}
                onChange={(e) => setCertify2257Records(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs text-zinc-300 leading-relaxed group-hover:text-white">
                <strong className="text-white">18 U.S.C. § 2257 Records:</strong> I maintain complete performer identification and verification records pursuant to 18 U.S.C. § 2257 and 28 C.F.R. Part 75 (
                <Link href="/legal/2257" target="_blank" className="text-violet-400 underline">
                  see requirements
                </Link>
                ).
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={certifyCopyrightOwnership}
                onChange={(e) => setCertifyCopyrightOwnership(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs text-zinc-300 leading-relaxed group-hover:text-white">
                <strong className="text-white">Intellectual Property:</strong> I hold full commercial rights and copyright to all audio, visual, and performance elements included in this upload.
              </span>
            </label>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Streaming directly to Bunny.net Edge...</span>
                <span className="font-mono font-bold text-violet-400">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-fuchsia-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isUploading ? `Uploading (${progress}%)...` : "Certify & Start Direct Resumable Upload"}
          </button>
        </form>
      )}
    </div>
  );
}
