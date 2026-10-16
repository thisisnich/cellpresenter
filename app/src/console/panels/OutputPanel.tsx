import { footerLines, titleCard } from "../../domain/credits";
import { t } from "../../i18n";
import { backgroundFor, nearbyBackgrounds } from "../../display/SlideBackground";
import { useConsole, useContent, type Selection } from "../ConsoleContext";
import { nextIndex, useLive } from "../LiveContext";
import { ScreenPicker } from "../ScreenPicker";
import { SlidePreview } from "../SlidePreview";

// What the screens show right now, and what comes next.
export function OutputPanel() {
  const { state } = useLive();
  const { setlist } = useConsole();

  // On an item's last slide, Next moves to the following setlist item.
  let upcoming: Selection | null = null;
  if (state && nextIndex(state) === null && setlist && state.setlist_id === setlist.id) {
    const at = setlist.items.findIndex((i) => i.id === state.item_id);
    const following = at >= 0 ? setlist.items[at + 1] : undefined;
    if (following) upcoming = { kind: "item", setlistId: setlist.id, itemId: following.id };
  }
  const { content: upcomingContent } = useContent(upcoming);

  if (!state) return null;
  const live = state.slides[state.slide_index];
  const next = nextIndex(state);
  const nextSlide =
    next !== null
      ? { label: state.slides[next].section, text: state.slides[next].text, background: state.slides[next].background }
      : upcomingContent?.slides[0]
        ? { label: upcomingContent.title, text: upcomingContent.slides[0].text, background: upcomingContent.slides[0].background }
        : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-cp-panel p-3.5 font-ui text-[13px] text-cp-text">
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="cp-label whitespace-nowrap text-cp-live">{t("output.live")}</span>
          <ScreenPicker />
        </div>
        <div className="overflow-hidden rounded-cp-sm border-cp">
          <SlidePreview
            text={live?.text ?? ""}
            textScale={state.text_scale}
            blank={!state.visible}
            blankLabel={t("output.blackedOut")}
            background={state.background}
            hideText={state.text_hidden}
            footer={footerLines(state.credits, state.look, state.slide_index)}
            title={state.title_card ? titleCard(state.credits, state.look) : null}
            fadeMs={state.look.fade_ms}
            upcoming={nearbyBackgrounds(state)}
            playVideo
          />
        </div>
      </section>

      {nextSlide && (
        <section className="flex flex-col gap-1.5">
          <span className="cp-label text-cp-next">{t("output.next", { section: nextSlide.label })}</span>
          <div className="w-[62%] overflow-hidden rounded-cp-sm border-cp">
            <SlidePreview
              text={nextSlide.text}
              textScale={state.text_scale}
              background={backgroundFor(nextSlide.background, state.background)}
            />
          </div>
        </section>
      )}
    </div>
  );
}
