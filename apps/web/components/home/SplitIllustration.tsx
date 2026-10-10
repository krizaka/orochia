import React from "react";

type Point = readonly [number, number];

/** The six corners of a flattened (isometric) hexagon around (cx, cy) — the Krizaka hexagon, lying on the floor. */
function hexagon(cx: number, cy: number, r: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a) * 0.55] as const;
  });
}

const path = (points: Point[]) => `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;

/** A hexagonal prism: its three visible sides (right, front, left) and its top, each a path. */
function prism(cx: number, cy: number, r: number, h: number) {
  const base = hexagon(cx, cy, r);
  const top = base.map(([x, y]) => [x, y - h] as const);
  const side = (i: number) => path([base[i], base[i + 1], top[i + 1], top[i]]);
  return { right: side(0), front: side(1), left: side(2), top: path(top), topCenter: [cx, cy - h] as const };
}

/**
 * The 90 / 10 split as an object: two hexagonal prisms extruded from the floor of the section, the creator's share
 * tall and lit from inside in the brand colours, the platform's fee a low step beside it — the heights are the real
 * percentages (`share`, from PLATFORM_FEE_PERCENTAGE). Drawn in code from the marks' vocabulary (hexagon, node), colours
 * from the roles, so both themes follow. Decorative: the figures are written next to it. The core breathes slowly;
 * still under prefers-reduced-motion.
 */
export function SplitIllustration({ share, className }: { share: number; className?: string }) {
  const unit = 1.9;
  const you = prism(150, 262, 64, Math.max(8, share * unit));
  const fee = prism(282, 292, 44, Math.max(8, (100 - share) * unit));
  const floor = hexagon(205, 286, 190);
  return (
    <svg viewBox="0 40 420 300" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="split-you-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--kz-accent)" />
          <stop offset="1" stopColor="var(--kz-accent-2)" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="split-you-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--kz-accent-hover)" />
          <stop offset="1" stopColor="var(--kz-accent-2)" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id="split-glow">
          <stop offset="0" stopColor="var(--kz-accent)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--kz-accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="split-floor">
          <stop offset="0" stopColor="var(--kz-text-primary)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--kz-text-primary)" stopOpacity="0" />
        </radialGradient>
        <mask id="split-floor-mask">
          <path d={path(floor)} fill="url(#split-floor)" />
        </mask>
      </defs>

      {/* The floor: an isometric lattice that fades into the page. */}
      <g mask="url(#split-floor-mask)" stroke="var(--kz-border-strong)" strokeWidth="1" opacity="0.7">
        {Array.from({ length: 13 }, (_, i) => {
          const o = (i - 6) * 32;
          return (
            <g key={i}>
              <line x1={5 + o} y1={176} x2={405 + o} y2={396} />
              <line x1={405 + o} y1={176} x2={5 + o} y2={396} />
            </g>
          );
        })}
      </g>

      {/* The light under the creator's share. */}
      <ellipse cx="150" cy="268" rx="140" ry="62" fill="url(#split-glow)" className="split-breathe" />

      {/* The platform's fee: a low, quiet step. */}
      <g>
        <path d={fee.right} fill="var(--kz-surface-3)" />
        <path d={fee.front} fill="var(--kz-surface-2)" />
        <path d={fee.left} fill="var(--kz-surface-1)" />
        <path d={fee.top} fill="var(--kz-surface-3)" stroke="var(--kz-border-strong)" strokeWidth="1.25" />
      </g>

      {/* The creator's share: tall, lit from inside. */}
      <g>
        <path d={you.right} fill="url(#split-you-side)" />
        <path d={you.front} fill="url(#split-you-front)" />
        <path d={you.left} fill="url(#split-you-side)" opacity="0.8" />
        <path d={you.top} fill="var(--kz-accent)" stroke="var(--kz-accent-text)" strokeWidth="1.5" />
        <path d={path(hexagon(you.topCenter[0], you.topCenter[1], 40))} fill="none" stroke="var(--kz-accent-text)" strokeOpacity="0.55" strokeWidth="1.25" />
        <circle cx={you.topCenter[0]} cy={you.topCenter[1]} r="16" fill="url(#split-glow)" className="split-breathe" />
        <circle cx={you.topCenter[0]} cy={you.topCenter[1]} r="6.5" fill="var(--kz-on-accent)" />
      </g>
      <style>{STYLES}</style>
    </svg>
  );
}

const STYLES = `
        .split-breathe { transform-box: fill-box; transform-origin: center; animation: split-breathe 6s ease-in-out infinite; }
        @keyframes split-breathe { 50% { opacity: .55; transform: scale(.92); } }
        @media (prefers-reduced-motion: reduce) { .split-breathe { animation: none; } }
      `;
