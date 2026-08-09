// A single slide's lyrics, rendered inside the fixed 1920x1080 stage canvas.
// Font size is in *canvas* pixels: the Stage scales everything uniformly, so
// LYRIC_BASE_FONT_PX renders proportionally identical on every screen.
// `textScale` is the operator's proportional size control (part of live state).
export const LYRIC_BASE_FONT_PX = 90;

export function LyricSlide({
  text,
  textScale,
}: {
  text: string;
  textScale: number;
}) {
  return (
    <p
      className="max-w-[80%] whitespace-pre-wrap text-center font-bold leading-snug text-white"
      style={{ fontSize: LYRIC_BASE_FONT_PX * textScale }}
    >
      {text}
    </p>
  );
}
