"use client";

import { usePathname as useNextPathname } from "next/navigation";

import { stripLocalePrefix } from "./locales";

/**
 * The page's path without its language: `/fr/explore` and `/explore` are both `/explore`, so a tab is current in either.
 * (next/navigation's `usePathname` gives the address as the browser shows it, language included.)
 */
export function usePathname(): string {
  return stripLocalePrefix(useNextPathname() ?? "/").path;
}
