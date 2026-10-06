import { LyricSlide } from "../display/LyricSlide";
import { SlideBackground } from "../display/SlideBackground";
import { Stage } from "../display/Stage";

// A 16:9 miniature of exactly what the displays render: the same Stage and
// LyricSlide, scaled down. Thumbnails, Live and Next all use it.
export function SlidePreview({
  text,
  textScale = 1,
  blank = false,
  blankLabel,
  background = null,
  hideText = false,
}: {
  text: string;
  textScale?: number;
  blank?: boolean;
  blankLabel?: string;
  /** Background image URL, already resolved (slide's own or the default). */
  background?: string | null;
  hideText?: boolean;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      <Stage>
        {blank ? (
          blankLabel && <p className="text-5xl text-white/40">{blankLabel}</p>
        ) : (
          <>
            <SlideBackground url={background} />
            {!hideText && <LyricSlide text={text} textScale={textScale} />}
          </>
        )}
      </Stage>
    </div>
  );
}
