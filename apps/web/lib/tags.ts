/**
 * Tags — one spelling per idea, so `/explore?tag=` finds everything filed under it.
 *
 * A tag is a slug: lower case, no accent, words joined by "-", letters and digits only (`behind-the-scenes`, `4k`).
 * Simple synonyms fold onto one tag (`bts` → `behind-the-scenes`), duplicates disappear, a video keeps at most
 * {@link MAX_TAGS}. Pure and shared: the publish form normalises as the creator types, the API normalises what it
 * stores (never trusting the client), and the explore page normalises the address.
 */

export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 32;
const MIN_TAG_LENGTH = 2;

/** Spellings that mean the same thing → the tag they are filed under. Keys are already slugs. */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  bts: "behind-the-scenes",
  behindthescenes: "behind-the-scenes",
  "behind-scenes": "behind-the-scenes",
  "making-of": "behind-the-scenes",
  coulisses: "behind-the-scenes",
  uhd: "4k",
  "2160p": "4k",
  "ultra-hd": "4k",
  acoustics: "acoustic",
  unplugged: "acoustic",
  concerts: "concert",
  gig: "concert",
  "live-music": "concert",
  cinema: "cinematic",
  film: "cinematic",
  films: "cinematic",
  tutorials: "tutorial",
  tuto: "tutorial",
  "how-to": "tutorial",
  howto: "tutorial",
  vlogs: "vlog",
  dances: "dance",
  dancing: "dance",
  danse: "dance",
  musique: "music",
  photos: "photography",
  photo: "photography",
  fitness: "workout",
  gym: "workout",
  voyage: "travel",
  travels: "travel",
  cosplays: "cosplay",
  asmrs: "asmr",
  "q-and-a": "qa",
  "q-a": "qa",
  faq: "qa",
};

/**
 * The curated tags offered to every creator at upload, in display order — broad, safe, useful for discovery.
 * Product vocabulary (slugs), not interface text.
 */
export const CURATED_TAGS: readonly string[] = [
  "behind-the-scenes",
  "exclusive",
  "cinematic",
  "music",
  "acoustic",
  "concert",
  "dance",
  "vlog",
  "tutorial",
  "qa",
  "cosplay",
  "photography",
  "workout",
  "travel",
  "asmr",
  "comedy",
  "art",
  "fashion",
  "4k",
  "studio",
];

/** One tag, normalised; `null` when nothing usable is left (too short, only punctuation). */
export function normalizeTag(raw: string): string | null {
  const slug = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[\s_./]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-$/, "");
  if (slug.length < MIN_TAG_LENGTH) return null;
  return TAG_SYNONYMS[slug] ?? slug;
}

/**
 * A list of tags, normalised: synonyms folded, duplicates removed (first one wins, order kept), at most
 * {@link MAX_TAGS}. Accepts one comma-separated string too (the studio's edit field).
 */
export function normalizeTags(input: readonly string[] | string | null | undefined, max = MAX_TAGS): string[] {
  const raw = typeof input === "string" ? input.split(",") : (input ?? []);
  const out: string[] = [];
  for (const entry of raw) {
    for (const piece of String(entry).split(",")) {
      const tag = normalizeTag(piece);
      if (tag && !out.includes(tag)) out.push(tag);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** The words of a text, as tag candidates (`"Tokyo Neon — Episode 01"` → `tokyo`, `neon`, `episode`, `01`). */
function words(text: string): Set<string> {
  const found = new Set<string>();
  for (const w of text.split(/[^\p{L}\p{N}#-]+/u)) {
    const tag = normalizeTag(w);
    if (tag) found.add(tag);
  }
  return found;
}

export interface TagSuggestionInput {
  /** The creator's tags on their previous videos, with how often they used each (most used first is best). */
  previous: readonly { tag: string; count: number }[];
  /** What the creator typed so far: a curated tag named in the title or the description comes first. */
  title?: string;
  description?: string;
  /** Already chosen: never suggested again. */
  chosen?: readonly string[];
  limit?: number;
}

/**
 * Tags to offer at upload, best first: curated tags the title or description mention, then the creator's own habits
 * (most used first), then hashtags they typed, then the rest of the curated list. Never a chosen tag, never twice.
 */
export function suggestTags({ previous, title = "", description = "", chosen = [], limit = 10 }: TagSuggestionInput): string[] {
  const taken = new Set(normalizeTags(chosen, Number.MAX_SAFE_INTEGER));
  const text = `${title} ${description}`;
  const mentioned = words(text);
  const hashtags = normalizeTags((text.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map(String), Number.MAX_SAFE_INTEGER);
  const habits = [...previous]
    .map((p) => ({ tag: normalizeTag(p.tag), count: p.count }))
    .filter((p): p is { tag: string; count: number } => Boolean(p.tag))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .map((p) => p.tag);
  const ordered = [
    ...CURATED_TAGS.filter((tag) => mentioned.has(tag)),
    ...habits,
    ...hashtags,
    ...CURATED_TAGS,
  ];
  const out: string[] = [];
  for (const tag of ordered) {
    if (taken.has(tag) || out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= limit) break;
  }
  return out;
}

/** The hashtags of a caption, as tags (`"New strings #Acoustic #unplugged"` → `acoustic`). */
export function hashtagsOf(text: string | null | undefined): string[] {
  return normalizeTags((text ?? "").match(/#[\p{L}\p{N}_-]+/gu) ?? [], Number.MAX_SAFE_INTEGER);
}
