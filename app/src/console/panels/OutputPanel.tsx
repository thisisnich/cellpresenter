import { t } from "../../i18n";
import { STAGE_HEIGHT, STAGE_WIDTH } from "../../display/Stage";
import { nextIndex, useLive } from "../LiveContext";
import { SlidePreview } from "../SlidePreview";

// What the screens show right now, and what comes next.
export function OutputPanel() {
  const { state } = useLive();
  if (!state) return null;
  const live = state.slides[state.slide_index];
  const next = nextIndex(state);
  const nextSlide = next === null ? null : state.slides[next];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-cp-panel p-3.5 font-ui text-[13px] text-cp-text">
      <section className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <span className="cp-label text-cp-live">{t("output.live")}</span>
          <span className="font-mono text-[11px] text-cp-muted">
            {STAGE_WIDTH}×{STAGE_HEIGHT}
          </span>
        </div>
        <div className="overflow-hidden rounded-cp-sm border-cp">
          <SlidePreview
            text={live?.text ?? ""}
            textScale={state.text_scale}
            blank={!state.visible}
            blankLabel={t("output.blackedOut")}
          />
        </div>
      </section>

      {nextSlide && (
        <section className="flex flex-col gap-1.5">
          <span className="cp-label text-cp-next">{t("output.next", { section: nextSlide.section })}</span>
          <div className="w-[62%] overflow-hidden rounded-cp-sm border-cp">
            <SlidePreview text={nextSlide.text} textScale={state.text_scale} />
          </div>
        </section>
      )}
    </div>
  );
}
