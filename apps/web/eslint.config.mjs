import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  { ignores: [".next/**", "next-env.d.ts"] },
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
