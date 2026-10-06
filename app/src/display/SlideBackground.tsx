// A background image filling the stage, darkened slightly so white lyrics
// stay readable on any picture. Lives inside the Stage, so it crops the
// same way on every screen.
export function SlideBackground({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <>
      <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
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
