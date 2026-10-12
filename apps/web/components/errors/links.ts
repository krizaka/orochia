/**
 * Where a person who hit an error talks to us: the Krizaka contact form, Orochia pre-selected and the page that sent
 * them named (krizaka.com's `contactHref` convention — `source` is a slug).
 */
export function supportHref(source: "orochia-error" | "orochia-not-found"): string {
  return `https://krizaka.com/contact?topic=orochia&source=${source}`;
}
