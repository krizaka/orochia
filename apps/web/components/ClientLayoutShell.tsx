"use client";

import React, { useState } from "react";

import { AgeVerificationModal } from "@/components/AgeVerificationModal";
import { EmailVerificationGate } from "@/components/EmailVerificationGate";
import { FloatingUploadBar } from "@/components/FloatingUploadBar";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui";
import { UploadManagerProvider } from "@/lib/upload-manager";

export function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  return (
    <UploadManagerProvider>
      <AgeVerificationModal />
      <Navbar onOpenSearch={() => setSearchModalOpen(true)} />
      {/* Room for the bottom tab bar on phones. */}
      <main className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
        <EmailVerificationGate>{children}</EmailVerificationGate>
      </main>
      <MobileBottomNav />
      <GlobalSearchBarOrDock />
      <FloatingUploadBar />
      {/* Live notifications (the bell's toasts) and every other toast; above the bottom tab bar on phones. */}
      <Toaster position="bottom-right" mobileOffset={{ bottom: 96 }} />
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </UploadManagerProvider>
  );
}

function GlobalSearchBarOrDock() {
  return null;
}
