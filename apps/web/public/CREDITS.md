# Media credits

Every picture and clip shipped in `public/` that was not made for Orochia, with its source and licence. A new file
here adds a line; nothing without a clear licence, nothing explicit, no identifiable face without a model release.

## Stock footage — Mixkit

Licence: [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) — free for commercial use inside a
project, no attribution required, models released by Mixkit; not redistributed as stand-alone files. Authors are those
credited on each clip's Mixkit page (find a clip by its number on [mixkit.co](https://mixkit.co)); the repository does
not record their names.

| Source clip (Mixkit #) | Files | Use |
| :--- | :--- | :--- |
| 474 | `showcase/feed-1.{mp4,jpg}` · `backdrops/hero.{webm,mp4,webp}` | Phone showcase (feed); hero backdrop |
| 46893 | `showcase/feed-2.{mp4,jpg}` · `showcase/auction.{mp4,jpg}` · `backdrops/creators.{webm,mp4,webp}` | Phone showcase (feed, auction); closing call to action backdrop |
| 33896 | `showcase/story-1.{mp4,jpg}` · `backdrops/fans.{webm,mp4,webp}` | Phone showcase (stories); "Why people stay" backdrop |
| 4855 | `showcase/story-2.{mp4,jpg}` | Phone showcase (stories) |
| 44556 | `showcase/story-3.{mp4,jpg}` · `backdrops/paid.{webm,mp4,webp}` | Phone showcase (stories); "Get paid" backdrop |
| 42816 | `showcase/unlock.{mp4,jpg}` | Phone showcase (paid unlock) |
| 50433 | `showcase/challenge.{mp4,jpg}` | Phone showcase (challenge) |

`backdrops/*` are derived from the showcase clips (216×384, 6 s, no audio, VP9 + H.264; 36×64 WebP posters, a few hundred bytes — they are blurred anyway): they are only
ever shown blurred (28 px) and dimmed behind a section, so no face is recognisable. Regenerate them with ffmpeg from
`showcase/*` (see the PR that introduced them, `feat(home)`), never from another source without adding it here.

## Our own

- `icon.svg`, the marks (`@krizaka/ui`), the icons (`@krizaka/icons`) and the isometric illustrations of the home
  (`components/home/*`, drawn in code): Krizaka, Apache-2.0.
- Fonts (`app/fonts`): Outfit and Plus Jakarta Sans, SIL Open Font License 1.1.
