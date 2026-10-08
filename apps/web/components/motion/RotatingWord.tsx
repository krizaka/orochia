"use client";

import React, { useEffect, useState } from "react";

/**
 * A word that rolls through alternatives (the Krizaka signature, as on krizaka.com). Server render and first client
 * render show the first word; under reduced motion it stays put. Decorative: the heading keeps a stable label.
 */
export function RotatingWord({ words, interval = 2600, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setI((k) => (k + 1) % words.length), interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);
  return (
    <span aria-hidden className="inline-grid overflow-hidden pb-[0.08em] align-bottom">
      <span key={i} className={`kz-word whitespace-nowrap [grid-area:1/1] ${className ?? ""}`}>
        {words[i]}
      </span>
    </span>
  );
}
