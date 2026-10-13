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

/** A single frame of a video, then no decoder. */
export function VideoStill({ url, label }: { url: string; label?: string }) {
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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else void video.play().catch(() => undefined);
  }, [paused, url]);

  if (!url) return null;
  return (
    <div className={`absolute inset-0 ${paused ? "invisible" : ""}`}>
      {isVideoUrl(url) ? (
        still ? (
          <VideoStill url={url} />
        ) : (
          <video
            ref={videoRef}
            key={url}
            src={url}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            className={frameClass}
          />
        )
      ) : (
        <img src={url} alt="" draggable={false} className={frameClass} />
      )}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}

/**
 * The background a slide would appear with: the first of its own cue, its
 * song's or announcement's cue, and whatever is on the background layer.
 */
export function backgroundFor(...candidates: (string | null | undefined)[]): string | null {
  return candidates.find((c) => c) ?? null;
}
