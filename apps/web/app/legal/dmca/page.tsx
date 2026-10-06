import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Mail } from "lucide-react";

export const metadata = {
  title: "DMCA Copyright Notice & Takedown Policy — Orochia",
  description: "Digital Millennium Copyright Act (17 U.S.C. § 512) notification procedures and agent contacts.",
};

export default function DmcaPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Orochia Sanctuary</span>
      </Link>

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 mb-4">
          <AlertCircle className="h-3.5 w-3.5 text-violet-400" />
          <span>Intellectual Property Protection</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-display">
          DMCA Copyright Notice & Takedown Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Procedures for submitting copyright infringement notifications under 17 U.S.C. § 512(c).
        </p>
      </div>

      <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">1. Policy Statement</h2>
          <p>
            Orochia respects the intellectual property rights of creators and copyright holders. In accordance with the Digital Millennium Copyright Act (&quot;DMCA&quot;), Orochia responds expeditiously to valid notices of copyright infringement sent to our Designated Copyright Agent.
          </p>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">2. Submitting an Infringement Notice</h2>
          <p>
            To file a DMCA notice, copyright owners or authorized representatives must provide:
          </p>
          <ul className="mt-3 list-disc list-inside space-y-2 text-zinc-400 pl-2">
            <li>A physical or electronic signature of a person authorized to act on behalf of the owner.</li>
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>Identification of the material to be removed, including specific Orochia URLs or Video IDs.</li>
            <li>Contact information (legal name, address, telephone number, and email address).</li>
            <li>A statement of good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.</li>
            <li>A statement under penalty of perjury that the information in the notification is accurate.</li>
          </ul>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">3. Designated DMCA Agent Contact</h2>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/60 p-4">
            <Mail className="h-5 w-5 text-violet-400" />
            <div>
              <p className="text-xs font-semibold text-white">DMCA Compliance Officer</p>
              <p className="text-xs text-zinc-400">dmca@krizaka.com • legal@orochia.org</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Alternatively, users may flag infringing media directly on any video page using the &quot;Report Content&quot; button for expedited triage.
          </p>
        </section>
      </div>
    </div>
  );
}
