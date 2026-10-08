export interface PresetAsset {
  id: string;
  name: string;
  url: string;
}

export const DEFAULT_AVATARS: PresetAsset[] = [
  { id: "avatar-01", name: "Velvet Aura", url: "/defaults/avatars/avatar-01.svg" },
  { id: "avatar-02", name: "Solar Bloom", url: "/defaults/avatars/avatar-02.svg" },
  { id: "avatar-03", name: "Deep Lagoon", url: "/defaults/avatars/avatar-03.svg" },
  { id: "avatar-04", name: "Emerald Mist", url: "/defaults/avatars/avatar-04.svg" },
  { id: "avatar-05", name: "Gilded Hour", url: "/defaults/avatars/avatar-05.svg" },
  { id: "avatar-06", name: "Rose Quartz", url: "/defaults/avatars/avatar-06.svg" },
  { id: "avatar-07", name: "Midnight Silver", url: "/defaults/avatars/avatar-07.svg" },
  { id: "avatar-08", name: "Holo Prism", url: "/defaults/avatars/avatar-08.svg" },
];

export const DEFAULT_BANNERS: PresetAsset[] = [
  { id: "banner-01", name: "Velvet Aurora", url: "/defaults/banners/banner-01.svg" },
  { id: "banner-02", name: "Sunset Boulevard", url: "/defaults/banners/banner-02.svg" },
  { id: "banner-03", name: "Ocean Drift", url: "/defaults/banners/banner-03.svg" },
  { id: "banner-04", name: "Northern Lights", url: "/defaults/banners/banner-04.svg" },
  { id: "banner-05", name: "Golden Dust", url: "/defaults/banners/banner-05.svg" },
  { id: "banner-06", name: "Holographic", url: "/defaults/banners/banner-06.svg" },
];

/** The presets, served by the app itself (public/defaults): they ship with every release, in every environment. */
export function getPresetAssets(): { avatars: PresetAsset[]; banners: PresetAsset[] } {
  return { avatars: DEFAULT_AVATARS, banners: DEFAULT_BANNERS };
}
