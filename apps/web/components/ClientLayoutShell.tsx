"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { AgeVerificationModal } from "@/components/AgeVerificationModal";
import { EmailVerificationGate } from "@/components/EmailVerificationGate";

export function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  return (
    <>
      <AgeVerificationModal />
      <Navbar onOpenSearch={() => setSearchModalOpen(true)} />
      {/* Room for the bottom tab bar on phones. */}
      <main className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
        <EmailVerificationGate>{children}</EmailVerificationGate>
      </main>
      <MobileBottomNav />
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </>
  );
}
