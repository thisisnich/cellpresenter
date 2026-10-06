import { arrangementOf, sectionAbbrev, sectionKind } from "../../domain/sections";
import { t } from "../../i18n";
import type { LiveState } from "../../lib/ws";
import { useConsole, useContent, type Selection } from "../ConsoleContext";
import { nextIndex, useLive } from "../LiveContext";
import { backgroundFor } from "../../display/SlideBackground";
import { SlidePreview } from "../SlidePreview";

const sectionColor = (name: string) => `var(--cp-section-${sectionKind(name)})`;

/** Whether the selection is what's on air right now. */
function isOnAir(selection: Selection, live: LiveState): boolean {
  return selection.kind === "item"
    ? live.setlist_id === selection.setlistId && live.item_id === selection.itemId
    : live.setlist_id === null && live.song_id === selection.songId;
}

// The slides of whatever is selected (or, with nothing selected, what's on
// air), colour-coded by section. Clicking a slide puts it on screen.
export function SlidesPanel() {
  const { state, send, showSong, showItem } = useLive();
  const { selection, select } = useConsole();
  const previewing = Boolean(state && selection && !isOnAir(selection, state));
  const { content, loading } = useContent(previewing ? selection : null);
  if (!state) return null;

  const title = previewing ? (content?.title ?? "") : state.title;
  const slides = previewing ? (content?.slides ?? []) : state.slides;
  const liveIndex = previewing ? -1 : state.slide_index;
  const next = previewing ? -1 : (nextIndex(state) ?? -1);

  const goLive = async (index: number) => {
    if (!previewing) return send({ type: "go_to", index });
    if (!selection) return;
    if (selection.kind === "item") await showItem(selection.setlistId, selection.itemId, index);
    else await showSong(selection.songId, index);
    select(null); // now on air: follow it
  };

  if (slides.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-cp-panel p-6 font-ui text-[13px] text-cp-muted">
        <p className="m-0">{previewing && loading ? t("connection.connecting") : previewing ? t("slides.missing") : t("slides.empty")}</p>
      </div>
    );
  }
  const arrangement = arrangementOf(slides.map((s) => s.section));

  return (
    <div className="flex h-full flex-col overflow-hidden bg-cp-panel font-ui text-[13px] text-cp-text">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-cp px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-lg font-semibold tracking-tight">{title}</h1>
          <span className="text-cp-muted">{t("slides.count", { count: slides.length })}</span>
          {previewing ? (
            <>
              <span className="rounded-cp-sm border-cp px-1.5 py-0.5 text-[11px] font-semibold text-cp-next">{t("slides.preview")}</span>
              <button type="button" onClick={() => void goLive(0)} className="cp-btn-live px-3 py-1">
                {t("slides.goLive")}
              </button>
              <button type="button" onClick={() => select(null)} className="cp-btn px-3 py-1">
                {t("slides.backToLive")}
              </button>
            </>
          ) : (
            <span className="rounded-cp-sm bg-cp-live px-1.5 py-0.5 text-[11px] font-bold text-cp-on-live">{t("slides.onAir")}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-cp-muted">{t("slides.arrangement")}</span>
          {arrangement.map((section, i) => (
            <span key={i} className="rounded-cp-sm px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: sectionColor(section) }}>
              {sectionAbbrev(section)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5 overflow-y-auto p-4">
        {slides.map((slide, i) => {
          const isLive = i === liveIndex;
          const isNext = i === next;
          const ring = isLive ? "var(--cp-live)" : isNext ? "var(--cp-next)" : "var(--cp-line)";
          const width = isLive || isNext ? "var(--cp-highlight-width)" : "var(--cp-border-width)";
          return (
            <button
              key={i}
              type="button"
              onClick={() => void goLive(i)}
              aria-label={t("slides.goTo", { number: i + 1, section: slide.section })}
              aria-current={isLive ? "true" : undefined}
              className="flex flex-col overflow-hidden rounded-cp bg-cp-chrome text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cp-live"
              style={{ border: `${width} solid ${ring}` }}
            >
              <SlidePreview text={slide.text} background={backgroundFor(slide.background, state.default_background)} />
              <span
                className="flex items-center justify-between gap-1.5 px-2 py-1 text-[11px] font-semibold text-white"
                style={{ background: sectionColor(slide.section) }}
              >
                <span>
                  {i + 1} · {slide.section}
                </span>
                <span className="font-mono text-[10px] tracking-wide">{isLive ? t("slides.live") : isNext ? t("slides.next") : ""}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
