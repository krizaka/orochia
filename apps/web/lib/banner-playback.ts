/** The playback policy of a moving cover — pure, so the client component can import it without the server code. */
export interface PlaybackContext {
  reducedMotion: boolean;
  saveData: boolean;
  /** `navigator.connection.effectiveType` when the browser reports one. */
  effectiveType?: string;
  /** The banner is in the viewport. */
  visible: boolean;
  tabVisible: boolean;
  /** Only the profile page plays; lists and cards always show the poster. */
  surface: "profile" | "card" | "list";
}

/** `play` only when everything allows motion; otherwise the poster. */
export function bannerPlayback(c: PlaybackContext): "play" | "poster" {
  if (c.surface !== "profile") return "poster";
  if (c.reducedMotion || c.saveData) return "poster";
  if (c.effectiveType && ["slow-2g", "2g", "3g"].includes(c.effectiveType)) return "poster";
  if (!c.visible || !c.tabVisible) return "poster";
  return "play";
}
