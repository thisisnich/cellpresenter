import { useEffect, useState } from "react";
import { footerLines } from "../../domain/credits";
import { DEFAULT_LOOK, FONT_FAMILY, FONT_NAME } from "../../display/look";
import type { FooterMode } from "../../generated/FooterMode";
import type { FooterPlace } from "../../generated/FooterPlace";
import type { LyricFont } from "../../generated/LyricFont";
import type { TextPosition } from "../../generated/TextPosition";
import { t } from "../../i18n";
import { openSettings } from "../SettingsPage";
import { SlidePreview } from "../SlidePreview";
import { useLookDraft } from "../useLookDraft";

const FOOTER_MODES: FooterMode[] = ["first", "all", "off"];
const FOOTER_PLACES: FooterPlace[] = ["centre", "corner", "bottom_left", "top_left", "top_centre", "top_right"];
const FONTS: LyricFont[] = ["inter", "montserrat", "open_sans", "oswald", "lora"];
const POSITIONS: TextPosition[] = ["top", "middle", "bottom"];
const SAMPLE = "Amazing grace, how sweet the sound\nThat saved a wretch like me";

function Segmented<T extends string>({
  label,
  options,
  value,
  name,
  onPick,
}: {
  label: string;
  options: T[];
  value: T;
  name: (option: T) => string;
  onPick: (option: T) => void;
}) {
  return (
    <div className="flex self-start rounded-cp border-cp bg-cp-bg p-0.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          aria-pressed={value === option}
          className={`rounded-cp-sm px-2.5 py-1 ${value === option ? "bg-cp-surface-hi font-semibold" : "text-cp-muted hover:bg-cp-hover hover:text-cp-text"}`}
        >
          {name(option)}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`rounded-cp border-cp px-2.5 py-1 ${on ? "bg-cp-surface-hi font-semibold text-cp-text" : "text-cp-muted hover:bg-cp-hover hover:text-cp-text"}`}
    >
      {label}
    </button>
  );
}

// How every screen looks, set once for the church: the words (font, colour,
// position…) and the copyright line under songs (CCLI). Changes reach every
// display straight away.
export function ScreenPanel() {
  const { state, look, change, error } = useLookDraft();
  const saved = state?.look;
  const [licence, setLicence] = useState(saved?.ccli_licence ?? "");

  // Follow changes made elsewhere (another console, a restart).
  useEffect(() => setLicence(saved?.ccli_licence ?? ""), [saved?.ccli_licence]);

  if (!look || !state) return null;

  const saveLicence = () => {
    const value = licence.trim() || null;
    if (value !== (look.ccli_licence ?? null)) change({ ccli_licence: value });
  };

  const slide = state.slides[state.slide_index];
  const footer = footerLines(state.credits, look, state.slide_index);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-cp-panel p-3.5 font-ui text-[13px] text-cp-text">
      <div className="shrink-0 overflow-hidden rounded-cp-sm border-cp">
        <SlidePreview text={slide?.text || SAMPLE} textScale={state.text_scale} background={state.background} footer={footer} look={look} />
      </div>

      <section className="flex flex-col gap-2.5" aria-labelledby="screen-text" data-guide="screen-look">
        <div className="flex items-center justify-between gap-2">
          <h3 id="screen-text" className="cp-label m-0">
            {t("screen.text")}
          </h3>
          <button
            type="button"
            onClick={() => change({ ...DEFAULT_LOOK, footer: look.footer, ccli_licence: look.ccli_licence })}
            className="text-[12px] text-cp-muted underline hover:text-cp-text"
          >
            {t("screen.reset")}
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-cp-muted">{t("screen.font")}</span>
          <select
            value={look.font}
            onChange={(e) => change({ font: e.target.value as LyricFont })}
            className="rounded-cp border-cp bg-cp-bg px-2 py-1.5 text-cp-text"
            style={{ fontFamily: FONT_FAMILY[look.font] }}
          >
            {FONTS.map((font) => (
              <option key={font} value={font} style={{ fontFamily: FONT_FAMILY[font] }}>
                {FONT_NAME[font]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <Toggle on={look.bold} label={t("screen.bold")} onChange={(bold) => change({ bold })} />
          <Toggle on={look.uppercase} label={t("screen.uppercase")} onChange={(uppercase) => change({ uppercase })} />
          <Toggle on={look.shadow} label={t("screen.shadow")} onChange={(shadow) => change({ shadow })} />
          <label className="ml-1 flex items-center gap-1.5 text-cp-muted">
            {t("screen.color")}
            <input
              type="color"
              value={look.color}
              onChange={(e) => change({ color: e.target.value }, 200)}
              className="h-7 w-10 cursor-pointer rounded-cp border-cp bg-cp-bg p-0.5"
            />
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-cp-muted">{t("screen.position")}</span>
          <Segmented
            label={t("screen.position")}
            options={POSITIONS}
            value={look.position}
            name={(p) => t(`screen.position.${p}`)}
            onPick={(position) => change({ position })}
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-cp-muted">{t("screen.margin", { percent: look.margin })}</span>
          <input
            type="range"
            min={0}
            max={20}
            value={look.margin}
            onChange={(e) => change({ margin: Number(e.target.value) }, 200)}
            className="w-full accent-[var(--cp-live)]"
          />
        </label>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="screen-footer" data-guide="screen-footer">
        <h3 id="screen-footer" className="cp-label m-0">
          {t("screen.footer")}
        </h3>
        <Segmented
          label={t("screen.footer")}
          options={FOOTER_MODES}
          value={look.footer}
          name={(mode) => t(`screen.footer.${mode}`)}
          onPick={(footer) => change({ footer })}
        />
        <label className="flex flex-col gap-1">
          <span className="text-cp-muted">{t("screen.footerPlace")}</span>
          <select
            value={look.footer_place}
            onChange={(e) => change({ footer_place: e.target.value as FooterPlace })}
            className="self-start rounded-cp border-cp bg-cp-bg px-2 py-1.5 text-cp-text"
          >
            {[...FOOTER_PLACES, ...(look.footer_place === "custom" ? (["custom"] as const) : [])].map((place) => (
              <option key={place} value={place}>
                {t(`screen.footerPlace.${place}`)}
              </option>
            ))}
          </select>
        </label>
        <Toggle on={look.title_slide} label={t("screen.titleSlide")} onChange={(title_slide) => change({ title_slide })} />
        <label className="flex flex-col gap-1">
          <span className="text-cp-muted">{t("screen.licence")}</span>
          <input
            value={licence}
            inputMode="numeric"
            onChange={(e) => setLicence(e.target.value)}
            onBlur={saveLicence}
            onKeyDown={(e) => e.key === "Enter" && saveLicence()}
            className="w-40 rounded-cp border-cp bg-cp-bg px-2.5 py-1.5 font-mono"
          />
        </label>
        <p className="m-0 text-[12px] text-cp-muted">{t("screen.footerHint")}</p>
        <button type="button" onClick={() => openSettings("screen")} className="cp-btn self-start px-3 py-1">
          {t("screen.openLayout")}
        </button>
      </section>

      {error && (
        <p role="alert" className="m-0 text-cp-danger">
          {error}
        </p>
      )}
      <p className="m-0 text-[12px] text-cp-muted">{t("screen.fullscreenTip")}</p>
    </div>
  );
}
