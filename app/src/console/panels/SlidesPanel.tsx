import { t } from "../../i18n";
import { arrangementOf, sectionAbbrev, sectionKind } from "../../domain/sections";
import { nextIndex, useLive } from "../LiveContext";
import { SlidePreview } from "../SlidePreview";

const sectionColor = (name: string) => `var(--cp-section-${sectionKind(name)})`;

// The song on air as a grid of slide thumbnails, colour-coded by section.
// Click a slide to put it on screen.
export function SlidesPanel() {
  const { state, send } = useLive();
  if (!state) return null;
  const next = nextIndex(state);
  const arrangement = arrangementOf(state.slides.map((s) => s.section));

  return (
    <div className="flex h-full flex-col overflow-hidden bg-cp-panel font-ui text-[13px] text-cp-text">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-cp px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="m-0 text-lg font-semibold tracking-tight">{state.title}</h1>
          <span className="text-cp-muted">{t("slides.count", { count: state.slides.length })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-cp-muted">{t("slides.arrangement")}</span>
          {arrangement.map((section, i) => (
            <span
              key={i}
              className="rounded-cp-sm px-1.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ background: sectionColor(section) }}
            >
              {sectionAbbrev(section)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5 overflow-y-auto p-4">
        {state.slides.map((slide, i) => {
          const isLive = i === state.slide_index;
          const isNext = i === next;
          const ring = isLive ? "var(--cp-live)" : isNext ? "var(--cp-next)" : "var(--cp-line)";
          const width = isLive || isNext ? "var(--cp-highlight-width)" : "var(--cp-border-width)";
          return (
            <button
              key={i}
              type="button"
              onClick={() => send({ type: "go_to", index: i })}
              aria-label={t("slides.goTo", { number: i + 1, section: slide.section })}
              aria-current={isLive ? "true" : undefined}
              className="flex flex-col overflow-hidden rounded-cp bg-cp-chrome text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cp-live"
              style={{ border: `${width} solid ${ring}` }}
            >
              <SlidePreview text={slide.text} />
              <span
                className="flex items-center justify-between gap-1.5 px-2 py-1 text-[11px] font-semibold text-white"
                style={{ background: sectionColor(slide.section) }}
              >
                <span>
                  {i + 1} · {slide.section}
                </span>
                <span className="font-mono text-[10px] tracking-wide">
                  {isLive ? t("slides.live") : isNext ? t("slides.next") : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
