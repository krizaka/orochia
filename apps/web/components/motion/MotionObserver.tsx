"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Mounted once in the layout: reveals every [data-reveal] element as it enters the viewport (including ones added
 * later), and feeds the pointer position to .kz-spotlight cards. One observer and one listener for the whole app.
 */
export function MotionObserver() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("kz-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("kz-in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const watch = (root: ParentNode) => root.querySelectorAll("[data-reveal]:not(.kz-in)").forEach((el) => io.observe(el));
    watch(document);
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && (n.matches("[data-reveal]") ? io.observe(n) : watch(n)));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(".kz-spotlight") as HTMLElement | null;
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${e.clientX - box.left}px`);
      card.style.setProperty("--spot-y", `${e.clientY - box.top}px`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);

  return null;
}
