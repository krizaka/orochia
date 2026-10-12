import localFont from "next/font/local";

// Variable fonts in the repository (app/fonts, SIL OFL 1.1): no request to Google from the browser, and none from the
// build either — a build that fetched them failed whenever fonts.googleapis.com did not answer the builder.
// Shared by the root layout and global-error (which renders its own document).
export const outfit = localFont({ src: "./fonts/outfit-latin-wght.woff2", weight: "100 900", variable: "--font-outfit", display: "swap" });
export const jakarta = localFont({ src: "./fonts/plus-jakarta-sans-latin-wght.woff2", weight: "200 800", variable: "--font-jakarta", display: "swap" });
