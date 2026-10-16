import { useEffect, useRef, useState } from "react";

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
}: {
  url: string | null | undefined;
  still?: boolean;
  /** Keep the file loaded but don't play it (a blacked-out screen). */
  paused?: boolean;
}) {
  if (!url) return null;
  return (
    <div className={`absolute inset-0 ${paused ? "invisible" : ""}`}>
      {still ? (
        isVideoUrl(url) ? <VideoStill url={url} /> : <img src={url} alt="" draggable={false} className={frameClass} />
      ) : (
        <Layers url={url} paused={paused} />
      )}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}

export interface Layer {
  id: number;
  url: string;
  ready: boolean;
}

/** Start loading `url` under what's on screen. A background still loading
 *  from an earlier change is dropped in favour of this one. */
export function withNext(layers: Layer[], url: string, id: number): Layer[] {
  const shown = layers.filter((l) => l.ready).slice(-1);
  if (shown[0]?.url === url) return shown;
  return [...shown, { id, url, ready: false }];
}

/** The layer `id` can play: it alone stays. */
export function onceReady(layers: Layer[], id: number): Layer[] {
  const layer = layers.find((l) => l.id === id);
  return layer && !layer.ready ? [{ ...layer, ready: true }] : layers;
}

/** How long a new background may take to load before it's shown anyway. */
const READY_TIMEOUT_MS = 4000;

// A new background loads underneath the one on screen, which stays until
// the new one can play. Swapping straight away shows black (and a stalled
// first frame) while a large video loads.
function Layers({ url, paused }: { url: string; paused: boolean }) {
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, url, ready: true }]);

  useEffect(() => {
    setLayers((ls) => (ls[ls.length - 1]?.url === url ? ls : withNext(ls, url, nextId.current++)));
  }, [url]);

  const ready = (id: number) => setLayers((ls) => onceReady(ls, id));

  return (
    <>
      {/* The one loading sits underneath, so the screen never goes black. */}
      {[...layers].reverse().map((l) => (
        <BackgroundLayer key={l.id} url={l.url} paused={paused} onReady={() => ready(l.id)} />
      ))}
    </>
  );
}

function BackgroundLayer({ url, paused, onReady }: { url: string; paused: boolean; onReady: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const done = useRef(onReady);
  done.current = onReady;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else void video.play().catch(() => undefined);
  }, [paused]);

  // A file that never loads mustn't keep the old background up forever.
  useEffect(() => {
    const timer = window.setTimeout(() => done.current(), READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isVideoUrl(url)) {
    return <img src={url} alt="" draggable={false} className={frameClass} onLoad={() => done.current()} onError={() => done.current()} />;
  }
  return (
    <video
      ref={videoRef}
      src={url}
      autoPlay={!paused}
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      className={frameClass}
      onPlaying={() => done.current()}
      onCanPlay={(e) => paused && e.currentTarget.readyState >= 3 && done.current()}
      onError={() => done.current()}
    />
  );
}

/**
 * The background a slide would appear with: the first of its own cue, its
 * song's or announcement's cue, and whatever is on the background layer.
 */
export function backgroundFor(...candidates: (string | null | undefined)[]): string | null {
  return candidates.find((c) => c) ?? null;
}
