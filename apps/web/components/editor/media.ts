"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** How many frames the timeline and the filter swatches show. */
export const FILMSTRIP_FRAMES = 10;

/** m:ss.d — the editor's time display. */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;

/** An object URL for a file, created and revoked in the same effect (safe under React's double effects). */
export function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/** The content size of an element, kept up to date. */
export function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Frames along the video for the timeline and the filter swatches, decoded by the browser itself. */
export function useFilmstrip(src: string | null, duration: number) {
  const [frames, setFrames] = useState<string[]>([]);
  useEffect(() => {
    if (!src || !duration) return;
    let cancelled = false;
    const probe = document.createElement("video");
    probe.src = src;
    probe.muted = true;
    probe.preload = "auto";
    const canvas = document.createElement("canvas");
    const out: string[] = [];
    const grab = (i: number) => {
      if (cancelled || i >= FILMSTRIP_FRAMES) return;
      probe.onseeked = () => {
        if (cancelled) return;
        canvas.width = 160;
        canvas.height = Math.round((160 * probe.videoHeight) / Math.max(1, probe.videoWidth));
        canvas.getContext("2d")?.drawImage(probe, 0, 0, canvas.width, canvas.height);
        out.push(canvas.toDataURL("image/jpeg", 0.6));
        setFrames([...out]);
        grab(i + 1);
      };
      probe.currentTime = Math.min(duration - 0.05, (duration / FILMSTRIP_FRAMES) * (i + 0.5));
    };
    probe.onloadeddata = () => grab(0);
    return () => {
      cancelled = true;
      probe.removeAttribute("src");
      probe.load();
    };
  }, [src, duration]);
  return frames;
}

/**
 * The preview player: owns the <video> and <audio> elements (put `video` / `music` on them) and is the only code that
 * drives them — play / pause, seek, loop back to the start of the kept part (the music restarts with it), speed,
 * volume up to 200 % (through Web Audio, created only when needed: a media element connects once) and the music.
 */
export function usePreviewPlayer(settings: { speed: number; volume: number; musicVolume: number; musicUrl: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const graph = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const [playing, setPlaying] = useState(false);
  const { speed, volume, musicVolume, musicUrl } = settings;

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.playbackRate = speed;
    if (volume > 1 && !graph.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      ctx.createMediaElementSource(v).connect(gain).connect(ctx.destination);
      graph.current = { ctx, gain };
    }
    if (graph.current) {
      graph.current.gain.gain.value = volume;
      v.volume = 1;
    } else v.volume = Math.min(1, volume);
    v.muted = volume === 0;
  }, [speed, volume]);

  useEffect(() => () => void graph.current?.ctx.close(), []);

  useEffect(() => {
    const m = music.current;
    if (!m) return;
    m.volume = musicVolume;
    if (playing) void m.play().catch(() => undefined);
    else m.pause();
  }, [musicVolume, playing, musicUrl]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }, []);
  const pause = useCallback(() => video.current?.pause(), []);
  const seek = useCallback((seconds: number) => {
    if (video.current) video.current.currentTime = seconds;
  }, []);
  /** Keeps playback inside [start, end): past the end it loops to the start, with the music. Returns the time. */
  const keepWithin = useCallback((start: number, end: number) => {
    const v = video.current;
    if (!v) return 0;
    if (v.currentTime < start - 0.05 || v.currentTime >= end) {
      v.currentTime = start;
      if (music.current) music.current.currentTime = 0;
    }
    return v.currentTime;
  }, []);

  return { video, music, playing, setPlaying, toggle, pause, seek, keepWithin };
}
