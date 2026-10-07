"use client";

import { useId } from "react";

/* Orochia mark — the serpent (Orochi) coiled into an "O" around the flame. Shared by the Orochia
   apps and krizaka.com (docs/assets/orochia-logo.svg is the same mark as a file). The orbit turns,
   scales slide along the body and the flame breathes; all motion stops under
   prefers-reduced-motion or with animated={false}. */
const CSS = `
.oro-spin { transform-origin: 180px 180px; animation: oro-spin 30s linear infinite; }
.oro-slither { animation: oro-slither 2.4s linear infinite; }
.oro-pulse { transform-box: view-box; animation: oro-pulse 3.2s ease-in-out infinite; }
@keyframes oro-spin { to { transform: rotate(360deg); } }
@keyframes oro-slither { to { stroke-dashoffset: -64; } }
@keyframes oro-pulse { 0%, 100% { opacity: .82; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .oro-spin, .oro-slither, .oro-pulse { animation: none; } }
`;

export function OrochiaLogo({ size = 36, animated = true, className }: { size?: number; animated?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const ids = { body: `oro-body-${uid}`, flame: `oro-flame-${uid}`, glow: `oro-glow-${uid}` };
  // Small sizes crop to the serpent and its flame: the orbits would only add hairlines.
  return (
    <svg width={size} height={size} viewBox={size < 48 ? "86 82 228 228" : "0 0 400 400"} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Orochia" className={className}>
      <style>{CSS}</style>
      <defs>
        <linearGradient id={ids.body} gradientUnits="userSpaceOnUse" x1="70" y1="290" x2="290" y2="70">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="55%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id={ids.flame} x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </linearGradient>
        <radialGradient id={ids.glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d946ef" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#d946ef" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(20 20)">
    <circle cx="180" cy="180" r="170" fill={`url(#${ids.glow})`}/>
    <circle className={animated ? "oro-spin" : undefined} cx="180" cy="180" r="160" stroke="#71717a" strokeWidth="1.5" strokeDasharray="8 8" opacity=".6"/>
    <circle cx="180" cy="180" r="134" stroke="#71717a" strokeWidth="1" opacity=".35"/>
    <path d="M259.8,142.8 A88,88 0 1 1 142.8,100.2" stroke={`url(#${ids.body})`} strokeWidth="22" strokeLinecap="round"/>
    <path className={animated ? "oro-slither" : undefined} d="M259.8,142.8 A88,88 0 1 1 142.8,100.2" stroke="#fdf4ff" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 14"/>
    <path d="M142.8,100.2 A88,88 0 0 1 187.7,92.3" stroke={`url(#${ids.body})`} strokeWidth="14" strokeLinecap="round"/>
    <path d="M187.7,92.3 A88,88 0 0 1 221.3,102.3" stroke={`url(#${ids.body})`} strokeWidth="6" strokeLinecap="round"/>
    <ellipse cx="253.9" cy="130.1" rx="13" ry="20" transform="rotate(-25 253.9 130.1)" fill={`url(#${ids.body})`}/>
    <path d="M245.4,112.0 L242.0,104.8 L235.0,101.5 M242.0,104.8 L244.0,97.3" stroke="#f472b6" strokeWidth="3" strokeLinecap="round"/>
    <circle className={animated ? "oro-pulse" : undefined} cx="256.3" cy="123.5" r="4.5" fill="#fdf4ff"/>
    <path className={animated ? "oro-pulse" : undefined} transform="translate(127 120) scale(4.4)" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill={`url(#${ids.flame})`}/>
  </g>
    </svg>
  );
}
