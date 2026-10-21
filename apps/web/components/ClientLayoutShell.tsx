"use client";

import { RailNav } from "@krizaka/ui/rail-nav";
import React, { useEffect, useRef, useState } from "react";

import { AgeVerificationModal } from "@/components/AgeVerificationModal";
import { AppBar } from "@/components/AppBar";
import { AppRail } from "@/components/AppRail";
import { EmailVerificationGate } from "@/components/EmailVerificationGate";
import { FloatingUploadBar } from "@/components/FloatingUploadBar";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { Charts, Toaster } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";
import { UploadManagerProvider } from "@/lib/upload-manager";
import { usePathname } from "@/lib/use-pathname";

export function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  // Pages enter with kz-page on navigation, not on the first load: the first paint is never held back by an
  // animation (largest contentful paint). globals.css stills .kz-page until this flag is set.
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== firstPath.current) document.documentElement.dataset.navigated = "true";
  }, [pathname]);

  return (
    <UploadManagerProvider>
      {/* The first Tab skips the navigation (WCAG 2.4.1) — @krizaka/ui's SkipLink when it ships (krizaka/krizaka-ui#134). */}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[100] focus:rounded-sm focus:bg-surface-1 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-lg focus:outline-2 focus:outline-ring"
      >
        {t("common.skipToContent")}
      </a>
      <AgeVerificationModal />
      {/* @krizaka/ui's rail (a column on a desktop, the bottom tab bar on a phone), then its header and the page. */}
      <RailNav.Shell className="min-h-0">
        <AppRail />
        <RailNav.Body className="min-w-0 flex-1">
          <AppBar onOpenSearch={() => setSearchModalOpen(true)} />
          {/* Room for the bottom tab bar on phones. */}
          <main id="content" tabIndex={-1} className="min-h-[calc(100vh-3.5rem)] pb-20 outline-none md:pb-0">
            {/* Every chart in the app speaks its words and wears the Orochia palette. */}
            <Charts>
              <EmailVerificationGate>{children}</EmailVerificationGate>
            </Charts>
          </main>
        </RailNav.Body>
      </RailNav.Shell>
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
