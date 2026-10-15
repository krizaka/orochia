import bundle from "./docs-bundle.generated.json";
import { absolute, KRIZAKA_URL, SOURCE_URL } from "./seo";

/**
 * llms.txt and llms-full.txt (llmstxt.org): the site as plain text for assistants. Rendered with this deployment's origin
 * (dev today, production later) — never a hard-coded address — and the repository's public docs.
 */

/** The repository's public docs (the bundle lib/docs.ts renders), read here as plain markdown. */
const DOCS = bundle as { slug: string; title: string; markdown: string }[];

const SUMMARY = `> Orochia is an open-source (Apache-2.0), adult-friendly video platform for independent creators,
> made by Krizaka (Montréal). Creators publish 4K videos and decide exactly who watches each one;
> viewers follow, comment, like, share, tip and unlock. Every playback link is signed for five
> minutes, payments are confirmed by the payment gateway and settled exactly once into a
> double-entry ledger, and creators are verified under 18 U.S.C. § 2257 before they upload.
> Adults only (18+).`;

export function llmsText(): string {
  return `# Orochia

${SUMMARY}

## What creators can do

- Choose who watches each video: everyone, approved followers, contacts, people who tipped to unlock it (with a minimum the creator sets), or an invited audience — people invited one by one or reusable audience lists ("Close friends") that stay private.
- Organise videos into collections, each opened to everyone, followers, contacts, invited people or lists, or kept private. A collection never opens a video its own rule keeps closed.
- Earn tips and paid unlocks through adult-friendly gateways (CCBill, Segpay, crypto via NOWPayments); balances are read from an immutable ledger; request payouts.
- See views (counted once per viewer and day), likes, comments and shares; moderate or close comments.

## Key pages

- [Home and feed](${absolute("/")}): the public feed
- [Explore](${absolute("/explore")}): search creators, videos, tags
- [How it works](${absolute("/how-it-works")}): the platform in a few steps
- [Documentation](${absolute("/docs")}): architecture, API contracts, database, deployment
- [Terms](${absolute("/legal/terms")}) · [Privacy](${absolute("/legal/privacy")}) · [2257](${absolute("/legal/2257")}) · [DMCA](${absolute("/legal/dmca")})

## For developers and operators

- [Source code](${SOURCE_URL}): web app and API, Next.js + PostgreSQL (Apache-2.0)
- [Operator console](https://github.com/krizaka/orochia-admin) and [design system](https://github.com/krizaka/orochia-design-system)
- Self-hostable: Docker Compose or DigitalOcean App Platform; Bunny Stream for video delivery.
- Full text of the documentation: ${absolute("/llms-full.txt")}

## Publisher

- [Krizaka](${KRIZAKA_URL}): the company that publishes Orochia, an open-source software studio in Montréal

Sitemap: ${absolute("/sitemap.xml")}
`;
}

export function llmsFullText(): string {
  const docs = DOCS.map((d) => `\n---\n\n# ${d.title}\n\nURL: ${absolute(`/docs/${d.slug}`)}\n\n${d.markdown.trim()}\n`).join("");
  return `${llmsText().replace(/\n## Publisher[\s\S]*$/, "")}\n## Documentation (full text)\n${docs}\n---\n\n## Publisher\n\n- [Krizaka](${KRIZAKA_URL}): the company that publishes Orochia\n\nSitemap: ${absolute("/sitemap.xml")}\n`;
}

export const LLMS_HEADERS = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" };
