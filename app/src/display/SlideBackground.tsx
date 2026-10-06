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

/** Which background a slide shows: its own, else the default. */
export function backgroundFor(
  slideBackground: string | null | undefined,
  defaultBackground: string | null | undefined,
): string | null {
  return slideBackground ?? defaultBackground ?? null;
}
