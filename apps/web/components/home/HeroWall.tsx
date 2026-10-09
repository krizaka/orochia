import React from "react";

/**
 * The moving backdrop of the home hero: real thumbnails of listed videos, in slow vertical columns — dimmed and
 * softened on wide screens so the product showcase in front reads first
 * (horizontal rows on phones). An empty platform shows soft gradients instead — never stock pictures.
 * Decorative (aria-hidden); still under prefers-reduced-motion.
 */
const DEFAULT_WALL = [
  "/showcase/stream-elena.jpg",
  "/showcase/live-tips-mia.jpg",
  "/showcase/auction-velvet.jpg",
  "/showcase/unlock-premiere.jpg",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80",
];

export function HeroWall({ images }: { images: string[] }) {
  const activeImages = images.length >= 3 ? images : DEFAULT_WALL;
  const columns = [0, 1, 2].map((c) => activeImages.filter((_, i) => i % 3 === c));
  const tile = (src: string, key: string) => (
    <div key={key} className="aspect-3/4 w-full shrink-0 overflow-hidden rounded-2xl bg-zinc-900 border border-white/5">
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-y-0 right-0 hidden w-[55%] grid-cols-3 gap-3 p-3 opacity-[0.22] blur-[3px] saturate-150 md:grid light:opacity-[0.28] mask-[linear-gradient(to_left,black_55%,transparent)]">
        {columns.map((col, c) => (
          <div key={c} className="hero-col flex flex-col gap-3" style={{ animationDuration: `${38 + c * 9}s`, animationDirection: c === 1 ? "reverse" : "normal" }}>
            {[...col, ...col].map((src, i) => tile(src, `${c}-${i}`))}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 flex h-full gap-3 opacity-40 md:hidden">
        <div className="hero-row flex w-max gap-3 p-3">
          {[...images, ...images].map((src, i) => (
            <div key={i} className="aspect-3/4 h-40 shrink-0 overflow-hidden rounded-2xl">
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .hero-col { animation: hero-up linear infinite; }
  @keyframes hero-up { to { transform: translateY(-50%); } }
  .hero-row { animation: hero-left 60s linear infinite; }
  @keyframes hero-left { to { transform: translateX(-50%); } }
  .hero-blob { animation: hero-float 18s ease-in-out infinite; }
  @keyframes hero-float { 50% { transform: translate(40px, 30px) scale(1.1); } }
  .hero-fade { animation: hero-fade 0.8s cubic-bezier(.16,1,.3,1) both; }
  @keyframes hero-fade { from { opacity: 0; transform: translateY(16px); } }
  @media (prefers-reduced-motion: reduce) { .hero-col, .hero-row, .hero-blob, .hero-fade { animation: none; } }
`;
