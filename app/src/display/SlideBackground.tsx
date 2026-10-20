import { useEffect, useRef, useState } from "react";
import type { LiveState } from "../lib/ws";

// A background filling its box (the whole screen on a display), cropped to
// fit and darkened slightly so white lyrics stay readable. Pictures and
// videos alike: a video loops, muted. `still` shows one captured frame
// instead of a live decoder — a slide grid full of `<video>` elements
// steals the decode that the screen needs, and playback stutters.

const VIDEO = /\.(mp4|webm|mov)([?#].*)?$/i;

/** Whether a background URL is a video. */
export const isVideoUrl = (url: string) => VIDEO.test(url);

// One thumbnail decodes at a time, then drops its player. Opening every
// still at once is what makes the video on screen hitch.
let decoders = 0;
const waiting: Array<() => void> = [];

function requestDecoder(run: () => void) {
  if (decoders < 1) {
    decoders += 1;
    run();
  } else {
    waiting.push(run);
  }
}

function releaseDecoder() {
  const next = waiting.shift();
  if (next) next();
  else decoders -= 1;
}

const frameClass = "absolute inset-0 h-full w-full object-cover";

/**
 * The still the server saved for a stored video (`/media/thumbs/<hash>.jpg`,
 * keeping the video's `?v=` so a rescaled file's new still isn't cached
 * over), or null for a URL that isn't one of ours.
 */
export function savedStillUrl(url: string): string | null {
  const m = /^(.*\/media\/)([0-9a-f]{64})\.(?:mp4|webm|mov)(\?[^#]*)?/.exec(url);
  return m ? `${m[1]}thumbs/${m[2]}.jpg${m[3] ?? ""}` : null;
}

/** A single frame of a video, then no decoder. */
export function VideoStill({ url, label }: { url: string; label?: string }) {
  // The server's still when there is one: the webview's own frame grab
  // comes out black for some files.
  const saved = savedStillUrl(url);
  const [missing, setMissing] = useState<string | null>(null);
  if (saved && missing !== saved) {
    return <img src={saved} alt={label ?? ""} draggable={false} className={frameClass} onError={() => setMissing(saved)} />;
  }
  return <GrabbedStill url={url} label={label} />;
}

/** A frame grabbed by decoding the video here, then no decoder. */
function GrabbedStill({ url, label }: { url: string; label?: string }) {
  const [poster, setPoster] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const holding = useRef(false);

  useEffect(() => {
    let alive = true;
    requestDecoder(() => {
      if (!alive) {
        releaseDecoder();
        return;
      }
      holding.current = true;
      setSrc(`${url}#t=0.5`);
    });
    return () => {
      alive = false;
      if (holding.current) {
        holding.current = false;
        releaseDecoder();
      }
    };
  }, [url]);

  // A file that never seeks must not hold the only decoder forever.
  useEffect(() => {
    if (!src) return;
    const timer = window.setTimeout(() => {
      if (!holding.current) return;
      holding.current = false;
      releaseDecoder();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [src]);

  const finish = (video: HTMLVideoElement) => {
    if (!holding.current) return;
    const short = video.duration > 0 && video.duration <= 0.5;
    const atFrame = video.currentTime >= 0.2 || short;
    if (!atFrame || video.videoWidth === 0) return;
    try {
      const max = 480;
      const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPoster(canvas.toDataURL("image/jpeg", 0.72));
      }
    } catch {
      // A tainted canvas keeps the video element as the still.
    }
    holding.current = false;
    video.pause();
    video.removeAttribute("src");
    video.load();
    releaseDecoder();
  };

  if (poster) {
    return <img src={poster} alt={label ?? ""} draggable={false} className={frameClass} />;
  }
  if (!src) return null;
  return (
    <video
      src={src}
      muted
      playsInline
      preload="auto"
      aria-label={label}
      className={frameClass}
      onSeeked={(e) => finish(e.currentTarget)}
      onLoadedData={(e) => finish(e.currentTarget)}
      onError={(e) => {
        const video = e.currentTarget;
        if (!holding.current) return;
        holding.current = false;
        video.removeAttribute("src");
        video.load();
        releaseDecoder();
      }}
    />
  );
}

export function SlideBackground({
  url,
  still = false,
  paused = false,
  fadeMs = 0,
  upcoming = [],
}: {
  url: string | null | undefined;
  still?: boolean;
  /** Keep the file loaded but don't play it (a blacked-out screen). */
  paused?: boolean;
  /** Fade a new background in over this long; 0 cuts straight to it. */
  fadeMs?: number;
  /** Backgrounds near this one (coming up first, then ones just shown),
   *  kept loaded so changing to them is instant. */
  upcoming?: string[];
}) {
  if (!url) return null;
  return (
    // `isolate` keeps the layers' stacking order inside the background, so
    // it never covers the words drawn after it.
    <div className={`absolute inset-0 isolate ${paused ? "invisible" : ""}`}>
      {still ? (
        isVideoUrl(url) ? <VideoStill url={url} /> : <img src={url} alt="" draggable={false} className={frameClass} />
      ) : (
        <Layers url={url} paused={paused} fadeMs={fadeMs} upcoming={upcoming} />
      )}
      <div className="absolute inset-0 z-10 bg-black/35" />
    </div>
  );
}

/** What's on screen, what's loading to replace it, and what's fading out. */
export interface Swap {
  shown: string;
  pending: string | null;
  leaving: string | null;
}

/** A new background was picked: load it under the one on screen. */
export function picked(s: Swap, url: string): Swap {
  return url === s.shown ? { ...s, pending: null } : { ...s, pending: url };
}

/** `url` can play: it goes on screen, and the old one fades out. A
 *  background that's no longer wanted finishing late changes nothing. */
export function loaded(s: Swap, url: string): Swap {
  return url === s.pending ? { shown: url, pending: null, leaving: s.shown } : s;
}

/** The fade is over: the old background can stop. */
export function faded(s: Swap, url: string): Swap {
  return url === s.leaving ? { ...s, leaving: null } : s;
}

/** How many nearby backgrounds are kept loaded (each video holds a
 *  decoder). Enough for most songs' cues, so stepping back and forth in a
 *  song never starts or stops a player: in the Linux app, stopping one
 *  holds up the screen until it's done. */
export const WARM_LIMIT = 4;

/** `wanted` in a stable order: the players already there keep their
 *  places and new ones go last. Moving a <video> in the page makes
 *  WebKitGTK set it up again, which froze the screen for most of a second;
 *  which one shows on top is up to its z-index, not its place. */
export function stableOrder(previous: string[], wanted: string[]): string[] {
  return [...previous.filter((u) => wanted.includes(u)), ...wanted.filter((u) => !previous.includes(u))];
}

/** Every background to keep a player for: on screen, loading, fading out,
 *  and the next few coming up. */
export function playersFor(s: Swap, upcoming: string[]): string[] {
  const now = [s.shown, s.pending, s.leaving].filter((u): u is string => Boolean(u));
  const warm = [...new Set(upcoming)].filter((u) => !now.includes(u)).slice(0, WARM_LIMIT);
  return [...new Set([...now, ...warm])];
}

// Every background has its own player, kept by URL: one coming up is
// loaded early (paused, hidden), so when a slide changes to it the very
// same player is shown at once. A new background loads underneath the one
// on screen, which stays until the new one can play, then fades in on top.
function Layers({ url, paused, fadeMs, upcoming }: { url: string; paused: boolean; fadeMs: number; upcoming: string[] }) {
  const [swap, setSwap] = useState<Swap>(() => ({ shown: url, pending: null, leaving: null }));
  const order = useRef<string[]>([]);
  // `url` too: the swap only learns about it after this render, and a
  // player missing for even one render is thrown away and loaded again.
  order.current = stableOrder(order.current, [...new Set([url, ...playersFor(swap, upcoming)])]);

  useEffect(() => setSwap((s) => picked(s, url)), [url]);

  // After the fade, the old background stops (or goes back to waiting).
  useEffect(() => {
    if (!swap.leaving) return;
    const leaving = swap.leaving;
    const timer = window.setTimeout(() => setSwap((s) => faded(s, leaving)), fadeMs);
    return () => window.clearTimeout(timer);
  }, [swap.leaving, fadeMs]);

  return (
    <>
      {order.current.map((u) => {
        const role = u === swap.shown ? "shown" : u === swap.pending ? "pending" : u === swap.leaving ? "leaving" : "warm";
        return (
          <BackgroundLayer
            key={u}
            url={u}
            role={role}
            paused={paused}
            fadeMs={fadeMs}
            onReady={() => setSwap((s) => loaded(s, u))}
          />
        );
      })}
    </>
  );
}

type Role = "shown" | "pending" | "leaving" | "warm";

function BackgroundLayer({
  url,
  role,
  paused,
  fadeMs,
  onReady,
}: {
  url: string;
  role: Role;
  paused: boolean;
  fadeMs: number;
  onReady: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const done = useRef(onReady);
  done.current = onReady;
  const playing = (role === "shown" || role === "pending" || role === "leaving") && !paused;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      // A warmed cue can go pending->shown while `playing` stays true; retry
      // here so a hidden play() miss still starts once the layer is visible.
      void video.play().catch(() => undefined);
      return;
    }
    // In WebKitGTK, pausing a video that's still downloading freezes the
    // page for up to a second and a half (measured). Until it has loaded,
    // it keeps playing out of sight; then it pauses for free.
    if (video.paused) return;
    if (video.networkState !== HTMLMediaElement.NETWORK_LOADING) {
      video.pause();
      return;
    }
    const settle = () => {
      if (video.networkState === HTMLMediaElement.NETWORK_LOADING) return;
      video.pause();
      stop();
    };
    const timer = window.setInterval(settle, 500);
    video.addEventListener("suspend", settle);
    const stop = () => {
      window.clearInterval(timer);
      video.removeEventListener("suspend", settle);
    };
    return stop;
  }, [playing, role]);

  // Picked: ready now if it was loaded early, otherwise when it plays (or
  // after a while, so a file that never loads can't hold the old one up).
  useEffect(() => {
    if (role !== "pending") return;
    const video = videoRef.current;
    const img = imgRef.current;
    // A loaded player has its first frame: show that at once and let it
    // start playing on screen, rather than wait for playback to begin.
    if ((video && video.readyState >= 2) || (img && img.complete && img.naturalWidth > 0)) {
      done.current();
      return;
    }
    const timer = window.setTimeout(() => done.current(), READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [role]);

  const visible = role === "shown" || role === "leaving";
  const style = {
    // On top while it fades in; the one leaving stays visible beneath it.
    zIndex: role === "shown" ? 2 : role === "leaving" ? 1 : 0,
    opacity: visible ? 1 : 0,
    transition: role === "shown" && fadeMs > 0 ? `opacity ${fadeMs}ms ease` : "none",
  };
  const ready = () => role === "pending" && done.current();

  if (!isVideoUrl(url)) {
    return <img ref={imgRef} src={url} alt="" draggable={false} className={frameClass} style={style} onLoad={ready} onError={ready} />;
  }
  return (
    <video
      ref={videoRef}
      src={url}
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      className={frameClass}
      style={style}
      onLoadedData={ready}
      onPlaying={ready}
      onError={ready}
    />
  );
}

/** How long a new background may take to load before it's shown anyway. */
const READY_TIMEOUT_MS = 4000;

/**
 * The background a slide would appear with: the first of its own cue, its
 * song's or announcement's cue, and whatever is on the background layer.
 */
export function backgroundFor(...candidates: (string | null | undefined)[]): string | null {
  return candidates.find((c) => c) ?? null;
}

/** Backgrounds near the slide on screen, the ones Next would reach first:
 *  this song's later slide cues, the setlist's next item, then the cues
 *  just shown (for Prev). The display keeps them loaded. */
export function nearbyBackgrounds(state: LiveState): string[] {
  const at = state.title_card ? 0 : state.slide_index;
  const cue = (i: number) => state.slides[i]?.background;
  const ahead = state.slides.slice(state.title_card ? 0 : at + 1).map((s) => s.background);
  const behind = state.slides.slice(0, at).map((_, i) => cue(at - 1 - i));
  return [...ahead, state.next_item_background, ...behind].filter((u): u is string => Boolean(u));
}
