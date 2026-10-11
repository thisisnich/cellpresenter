import { useEffect, useMemo, useRef, useState } from "react";
import type { SheetSlide } from "../domain/chordSheet";
import { sectionKind } from "../domain/sections";
import { t } from "../i18n";
import { ChordShapes } from "./ChordShapes";

const sectionColor = (name: string) => `var(--cp-section-${sectionKind(name)})`;

// The whole song as a chord sheet: chords above the syllable they start on,
// sections labelled, the live slide highlighted and kept in view. Tap a
// chord to see the ways to play it.
export function ChordSheet({
  slides,
  current,
  fontScale = 1,
  lyricsOnly = false,
}: {
  slides: SheetSlide[];
  /** Index of the live slide, or -1. */
  current: number;
  fontScale?: number;
  lyricsOnly?: boolean;
}) {
  const live = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // The song's chords in the order they first appear, for the shapes strip.
  const songChords = useMemo(
    () => [...new Set(slides.flatMap((s) => s.lines.flatMap((l) => l.chunks.flatMap((c) => (c.chord ? [c.chord] : [])))))],
    [slides],
  );
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    live.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [current, slides]);

  return (
    <div className="flex flex-col gap-1 pb-[40vh]" style={{ fontSize: `${17 * fontScale}px` }}>
      {slides.map((slide, i) => {
        const startsSection = i === 0 || slide.section !== slides[i - 1].section;
        const isLive = i === current;
        const isNext = i === current + 1;
        return (
          <section
            key={i}
            ref={isLive ? (el) => {
              live.current = el;
            } : undefined}
            aria-current={isLive ? "true" : undefined}
            className={`rounded-cp px-3 py-2 ${isLive ? "bg-cp-surface-hi" : ""}`}
            style={isLive ? { boxShadow: "inset 0 0 0 var(--cp-highlight-width) var(--cp-live)" } : undefined}
          >
            {startsSection && (
              <h3 className="m-0 mb-1 flex items-center gap-2 text-[0.75em] font-semibold tracking-wide uppercase" style={{ color: sectionColor(slide.section) }}>
                {slide.section}
              </h3>
            )}
            {(isLive || isNext) && (
              <span className={`float-right font-mono text-[0.65em] font-bold ${isLive ? "text-cp-live" : "text-cp-next"}`}>
                {isLive ? t("slides.live") : t("slides.next")}
              </span>
            )}
            {slide.lines.map((line, j) => (
              <p key={j} className="m-0 flex flex-wrap items-end leading-tight">
                {line.chunks.map((chunk, k) => (
                  <span key={k} className="inline-flex flex-col">
                    {!lyricsOnly && line.hasChords && (
                      <b className="min-h-[1.2em] pr-[0.4em] font-mono text-[0.85em] text-cp-live">
                        {chunk.chord && (
                          <button
                            type="button"
                            onClick={() => setOpen(chunk.chord ?? null)}
                            title={t("chords.showShapes", { chord: chunk.chord })}
                            className="cursor-pointer rounded-cp-sm font-bold underline decoration-dotted underline-offset-2 hover:bg-cp-surface-hi"
                          >
                            {chunk.chord}
                          </button>
                        )}
                      </b>
                    )}
                    <span className="whitespace-pre">{chunk.text || (chunk.chord && !lyricsOnly ? " " : "")}</span>
                  </span>
                ))}
              </p>
            ))}
          </section>
        );
      })}
      {open && <ChordShapes chord={open} songChords={songChords} onPick={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
