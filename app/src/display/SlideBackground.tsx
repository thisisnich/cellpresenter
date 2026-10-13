// A background filling its box (the whole screen on a display), cropped to
// fit and darkened slightly so white lyrics stay readable. Pictures and
// videos alike: a video loops, muted. `still` shows a video's first frame
// instead of playing it, for thumbnails (dozens of playing videos would
// bog the console down).

const VIDEO = /\.(mp4|webm|mov)(#.*)?$/i;

/** Whether a background URL is a video. */
export const isVideoUrl = (url: string) => VIDEO.test(url);

export function SlideBackground({ url, still = false }: { url: string | null | undefined; still?: boolean }) {
  if (!url) return null;
  return (
    <>
      {isVideoUrl(url) ? (
        still ? (
          <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <video key={url} src={url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
        )
      ) : (
        <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-black/35" />
    </>
  );
}

/**
 * The background a slide would appear with: the first of its own cue, its
 * song's or announcement's cue, and whatever is on the background layer.
 */
export function backgroundFor(...candidates: (string | null | undefined)[]): string | null {
  return candidates.find((c) => c) ?? null;
}
