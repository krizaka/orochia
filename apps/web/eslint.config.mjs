import { krizakaNext } from "@krizaka/config/eslint/next";
import { krizakaUi } from "@krizaka/config/eslint/krizaka-ui";

const config = [
  ...krizakaNext,
  // The four UI rules of the Krizaka platform (no raw palette, no `light:`, no `[var(--…)]`, no className template):
  // errors — the ratchet (lint-ratchet.json, `npm run ratchet`) reached zero. A colour the roles cannot express is a
  // product token in app/globals.css (--orochia-*, exposed through @theme inline), never a palette step.
  ...krizakaUi(),
  // public/ffmpeg: ffmpeg.wasm browser files copied from node_modules (scripts/copy-ffmpeg.mjs).
  { ignores: [".next/**", "next-env.d.ts", "public/ffmpeg/**"] },
  {
    rules: {
      // Media is user-generated and already served optimised by the Bunny CDN (thumbnails, avatars);
      // next/image would re-proxy it through the app server, which AGENTS.md §2.B forbids for media.
      "@next/next/no-img-element": "off",
      // Client panels load their data on mount with `useEffect(() => void load(), [load])`: the state is
      // set after the fetch resolves, which this rule cannot see through the useCallback. Synchronous
      // external reads use useSyncExternalStore instead (see AgeVerificationModal).
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
