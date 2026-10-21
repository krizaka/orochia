import localFont from "next/font/local";

// Variable fonts in the repository (app/fonts, SIL OFL 1.1): no request to Google from the browser, and none from the
// build either — a build that fetched them failed whenever fonts.googleapis.com did not answer the builder.
// Shared by the root layout and global-error (which renders its own document).
export const outfit = localFont({ src: "../fonts/outfit-latin-wght.woff2", weight: "100 900", variable: "--font-outfit", display: "swap" });
// The text face is Krizaka's (Cahier, krizaka-ui ADR-004): Atkinson Hyperlegible Next from @krizaka/fonts; Outfit stays
// Orochia's own display face (a product may override the display role only).
export const jakarta = localFont({ src: "../fonts/atkinson-hyperlegible-next-latin-wght.woff2", weight: "400 700", variable: "--font-jakarta", display: "swap" });
