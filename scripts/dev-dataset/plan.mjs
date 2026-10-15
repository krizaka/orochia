// The pure part of the dev dataset: validation of dataset.json and the diff against what a creator already has.
// No network, no file system — scripts/dev-dataset.test.mjs runs it.

const ORIENTATIONS = ["horizontal", "vertical"];
const VISIBILITIES = ["PUBLIC", "TIPPED_UNLOCKED", "CONTACTS_ONLY", "APPROVED_FOLLOWERS_ONLY"];

/** Everything that must hold for the dataset to look curated: distinct footage, titles that fit it, a mix of shapes. Returns the problems found. */
export function validateDataset(ds) {
  const problems = [];
  const creators = new Map();
  for (const c of ds.creators ?? []) {
    if (creators.has(c.key)) problems.push(`creator ${c.key}: twice`);
    creators.set(c.key, c);
    for (const field of ["credentials", "username", "displayName", "bio", "niche"]) if (!c[field]) problems.push(`creator ${c.key}: ${field} is empty`);
    if (/^qa\b|test|demo/i.test(c.displayName ?? "")) problems.push(`creator ${c.key}: the display name must read as a person, not a test account`);
  }
  const titles = new Set();
  const files = new Set();
  const perCreator = new Map();
  for (const v of ds.videos ?? []) {
    const at = `video "${v.title}"`;
    if (!creators.has(v.creator)) problems.push(`${at}: unknown creator ${v.creator}`);
    if (!ORIENTATIONS.includes(v.orientation)) problems.push(`${at}: orientation must be one of ${ORIENTATIONS}`);
    if (v.visibility && !VISIBILITIES.includes(v.visibility)) problems.push(`${at}: visibility ${v.visibility}`);
    if (v.visibility === "TIPPED_UNLOCKED" && !(v.minTipAmountCents >= 100)) problems.push(`${at}: a paid unlock costs at least 100 cents`);
    if (!v.title || v.title.length < 3 || v.title.length > 255) problems.push(`${at}: title length`);
    if (!v.description || v.description.length < 20) problems.push(`${at}: a description of a sentence`);
    if (!Array.isArray(v.tags) || v.tags.length < 2 || v.tags.some((t) => t !== t.toLowerCase())) problems.push(`${at}: two lower-case tags at least`);
    if (titles.has(v.title.toLowerCase())) problems.push(`${at}: duplicate title`);
    titles.add(v.title.toLowerCase());
    if (files.has(v.file)) problems.push(`${at}: the same footage (${v.file}) is used twice`);
    files.add(v.file);
    if (!/\.mp4$/.test(v.file ?? "")) problems.push(`${at}: file must be an .mp4`);
    perCreator.set(v.creator, [...(perCreator.get(v.creator) ?? []), v]);
  }
  for (const [key, list] of perCreator) {
    if (list.length < 4) problems.push(`creator ${key}: ${list.length} videos, 4 at least`);
    if (!list.some((v) => v.orientation === "vertical")) problems.push(`creator ${key}: at least one vertical clip`);
  }
  const clips = ds.generate?.clips ?? {};
  for (const [file, prompt] of Object.entries(clips)) {
    if (!files.has(file)) problems.push(`generate: ${file} is in no video`);
    if (!/no (people|faces|hands)|faces?/i.test(prompt)) problems.push(`generate: ${file} must say there is no face`);
  }
  for (const v of ds.videos ?? []) if (v.orientation === "vertical" && !clips[v.file]) problems.push(`video "${v.title}": a vertical clip needs its generation prompt`);
  return problems;
}

/** What a creator has now vs what the dataset wants: `have` = [{ id, title }]. The same title twice: the later one is a duplicate. */
export function diffCreator(wanted, have) {
  const want = new Map(wanted.map((v) => [v.title.toLowerCase(), v]));
  const seen = new Set();
  const remove = [];
  for (const h of have) {
    const key = h.title.toLowerCase();
    if (!want.has(key) || seen.has(key)) remove.push(h);
    seen.add(key);
  }
  const upload = wanted.filter((v) => !seen.has(v.title.toLowerCase()));
  return { upload, remove };
}

/** The credit written under every description: which Orazaka run made the clip. */
export function credit(entry) {
  if (!entry?.orazakaRunId) return null;
  return `Made with Orazaka — run ${entry.orazakaRunId}${entry.model ? ` (${entry.model.split(" — ")[0]})` : ""}.`;
}
