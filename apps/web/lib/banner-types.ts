/** What a profile page hands to its moving cover (built on the server by lib/banner-media.ts, plain data for the client). */
export interface BannerVideoView {
  /** The signed light MP4 with its `#t=start,end` fragment. */
  src: string;
  startSeconds: number;
  endSeconds: number;
}
