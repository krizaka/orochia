import React from "react";
import Link from "next/link";
import { FileCheck, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "18 U.S.C. § 2257 Record-Keeping Notice — Orochia",
  description: "Mandatory compliance statement regarding record-keeping pursuant to 18 U.S.C. § 2257.",
};

export default function RecordKeeping2257Page() {
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
          <FileCheck className="h-3.5 w-3.5 text-violet-400" />
          <span>Statutory Compliance Notice</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-display">
          18 U.S.C. § 2257 Record-Keeping Statement
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Compliance Statement Pursuant to Title 18, United States Code, Section 2257 and 28 C.F.R. Part 75.
        </p>
      </div>

      <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">1. Performer Age Verification</h2>
          <p>
            All models, actors, creators, and individuals appearing in any visual depictions of actual or simulated sexually explicit conduct found on Orochia were at least eighteen (18) years of age at the time of creation of such depictions.
          </p>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">2. Primary Custodian of Records</h2>
          <p>
            Orochia operates as an open-source technical platform and hosting service provider for user-generated and creator-submitted material. With respect to user-generated and creator-uploaded media, the original records required pursuant to 18 U.S.C. § 2257 and 28 C.F.R. Part 75 are maintained by the respective independent creator or content producer.
          </p>
          <p className="mt-3">
            Prior to publishing any media, every creator must submit an affirmative statutory declaration identifying the records custodian address, confirming age verification, and acknowledging ongoing custody obligations.
          </p>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">3. Exemption Statement</h2>
          <p>
            Certain visual depictions displayed on this website may be exempt from the record-keeping requirements of 18 U.S.C. § 2257 and 28 C.F.R. Part 75 because they do not portray actual sexually explicit conduct, or were created prior to the effective date of the statute.
          </p>
        </section>
      </div>
    </div>
  );
}
