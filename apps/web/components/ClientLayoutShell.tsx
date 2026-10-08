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
      <Navbar />
      <main className="min-h-[calc(100vh-4rem)]">
        <EmailVerificationGate>{children}</EmailVerificationGate>
      </main>
      <MobileBottomNav onOpenSearch={() => setSearchModalOpen(true)} />
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </>
  );
}
