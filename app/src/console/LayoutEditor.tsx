import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { footerLines, titleCard } from "../domain/credits";
import { FOOTER_SPOTS, footerSpot, lyricBox } from "../domain/lyricLayout";
import type { Area } from "../generated/Area";
import type { Credits } from "../generated/Credits";
import type { FooterMode } from "../generated/FooterMode";
import type { FooterPlace } from "../generated/FooterPlace";
import type { TextPosition } from "../generated/TextPosition";
import { STAGE_HEIGHT, STAGE_WIDTH } from "../display/Stage";
import { t } from "../i18n";
import { SlidePreview } from "./SlidePreview";
import { useLookDraft } from "./useLookDraft";

// Where things sit on every screen: drag the words' box and the copyright
// line on a preview, or pick a preset. Also the title slide and the CCLI
// options. Church-wide: every display follows.

const SAMPLE_TEXT = "Amazing grace, how sweet the sound\nThat saved a wretch like me";
const SAMPLE: Credits = {
  title: "Amazing Grace",
  artist: "John Newton",
  copyright: "Public domain",
  ccli_number: "22025",
  translation: null,
};

/** Words presets: the old positions, plus the screen's halves. */
const TEXT_PRESETS: { id: string; position: TextPosition; area?: Area }[] = [
  { id: "top", position: "top" },
  { id: "middle", position: "middle" },
  { id: "bottom", position: "bottom" },
  { id: "left", position: "custom", area: { x: 4, y: 10, w: 44, h: 80 } },
  { id: "right", position: "custom", area: { x: 52, y: 10, w: 44, h: 80 } },
];
const FOOTER_PRESETS = Object.keys(FOOTER_SPOTS) as Exclude<FooterPlace, "custom">[];
const FOOTER_MODES: FooterMode[] = ["first", "all", "off"];

/** Pull to the middle when close, so centring by hand is easy. */
const SNAP = 1.5;
const snapMiddle = (v: number, size = 0) => (Math.abs(v + size / 2 - 50) < SNAP ? 50 - size / 2 : v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Drag =
  | { kind: "move"; start: { x: number; y: number }; area: Area }
  | { kind: "resize"; start: { x: number; y: number }; area: Area }
  | { kind: "footer" };

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-cp-sm border-cp px-2.5 py-1 text-[12px] ${on ? "bg-cp-surface-hi font-semibold text-cp-text" : "text-cp-muted hover:bg-cp-hover hover:text-cp-text"}`}
    >
      {label}
    </button>
  );
}

export function LayoutEditor() {
  const { state, look, change, error } = useLookDraft();
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [showTitle, setShowTitle] = useState(false);
  const [licence, setLicence] = useState(look?.ccli_licence ?? "");
  useEffect(() => setLicence(state?.look.ccli_licence ?? ""), [state?.look.ccli_licence]);

  if (!look || !state) return null;

  const box = lyricBox(look, STAGE_WIDTH, STAGE_HEIGHT);
  const area: Area = {
    x: (box.left / STAGE_WIDTH) * 100,
    y: (box.top / STAGE_HEIGHT) * 100,
    w: (box.width / STAGE_WIDTH) * 100,
    h: (box.height / STAGE_HEIGHT) * 100,
  };
  const spot = footerSpot(look);
  // A song with credits shows the line; "first slide" with a title slide
  // shows it on the title slide only, so preview it on every slide here.
  const footer = footerLines(SAMPLE, { ...look, footer: look.footer === "off" ? "off" : "all", title_slide: false }, 0);
  const card = showTitle ? titleCard(SAMPLE, { ...look, title_slide: true }) : null;

  /** The pointer, in percent of the preview. */
  const at = (e: ReactPointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const begin = (e: ReactPointerEvent, d: Drag) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = d;
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = at(e);
    if (d.kind === "footer") {
      change({ footer_place: "custom", footer_x: snapMiddle(clamp(p.x, 0, 100)), footer_y: clamp(p.y, 0, 100) }, 150);
      return;
    }
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    const a = d.area;
    const next =
      d.kind === "move"
        ? { ...a, x: snapMiddle(clamp(a.x + dx, 0, 100 - a.w), a.w), y: clamp(a.y + dy, 0, 100 - a.h) }
        : { ...a, w: clamp(a.w + dx, 5, 100 - a.x), h: clamp(a.h + dy, 5, 100 - a.y) };
    change({ position: "custom", text_area: next }, 150);
  };
  const end = () => (drag.current = null);

  const saveLicence = () => {
    const value = licence.trim() || null;
    if (value !== (look.ccli_licence ?? null)) change({ ccli_licence: value });
  };

  const textPreset = TEXT_PRESETS.find(
    (p) =>
      p.position === look.position &&
      (!p.area || (p.area.x === look.text_area.x && p.area.y === look.text_area.y && p.area.w === look.text_area.w && p.area.h === look.text_area.h)),
  )?.id;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-2">
        <div
          ref={frame}
          className="relative overflow-hidden rounded-cp border-cp select-none"
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <SlidePreview
            text={state.slides[state.slide_index]?.text || SAMPLE_TEXT}
            background={state.background}
            footer={card ? null : footer}
            title={card}
            look={look}
          />
          {/* The words' box: drag to move, the corner to resize. */}
          <div
            role="slider"
            tabIndex={0}
            aria-label={t("placement.textBox")}
            aria-valuetext={`${Math.round(area.x)}%, ${Math.round(area.y)}%`}
            onPointerDown={(e) => begin(e, { kind: "move", start: at(e), area })}
            className="absolute cursor-move rounded-cp-sm border-2 border-dashed border-cp-hover-line hover:bg-cp-hover-line/10"
            style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.w}%`, height: `${area.h}%` }}
          >
            <span className="absolute top-1 left-1 rounded-cp-sm bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {t("placement.textBox")}
            </span>
            <span
              aria-hidden="true"
              onPointerDown={(e) => begin(e, { kind: "resize", start: at(e), area })}
              className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-sm border-2 border-cp-hover-line bg-cp-panel"
            />
          </div>
          {/* The copyright line's spot. */}
          {look.footer !== "off" && !card && (
            <div
              role="slider"
              tabIndex={0}
              aria-label={t("placement.footer")}
              aria-valuetext={`${Math.round(spot.x)}%, ${Math.round(spot.y)}%`}
              onPointerDown={(e) => begin(e, { kind: "footer" })}
              className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 border-white bg-cp-live text-[10px] font-bold text-cp-on-live shadow-lg"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              title={t("placement.footer")}
            >
              ©
            </div>
          )}
          {/* Centre guide while near it. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-white/15" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-cp-muted">
          <span>{t("placement.dragHelp")}</span>
          <span className="flex gap-1">
            <Chip on={!showTitle} label={t("placement.previewWords")} onClick={() => setShowTitle(false)} />
            <Chip on={showTitle} label={t("placement.previewTitle")} onClick={() => setShowTitle(true)} />
          </span>
        </div>
        {error && (
          <p role="alert" className="m-0 text-cp-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[12px] font-semibold tracking-wide text-cp-muted uppercase">{t("placement.words")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_PRESETS.map((p) => (
              <Chip
                key={p.id}
                on={textPreset === p.id}
                label={t(`placement.text.${p.id}` as "placement.text.top")}
                onClick={() => change(p.area ? { position: p.position, text_area: p.area } : { position: p.position })}
              />
            ))}
            {look.position === "custom" && !textPreset && <Chip on label={t("placement.custom")} onClick={() => {}} />}
          </div>
          {look.position !== "custom" && (
            <label className="flex flex-col gap-1 text-[12px]">
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
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[12px] font-semibold tracking-wide text-cp-muted uppercase">{t("placement.footer")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {FOOTER_MODES.map((mode) => (
              <Chip key={mode} on={look.footer === mode} label={t(`screen.footer.${mode}`)} onClick={() => change({ footer: mode })} />
            ))}
          </div>
          {/* Six spots, laid out where they are on the screen. */}
          <div className="grid w-48 grid-cols-3 gap-1 rounded-cp border-cp bg-cp-bg p-1.5" role="group" aria-label={t("screen.footerPlace")}>
            {(["top_left", "top_centre", "top_right", "bottom_left", "centre", "corner"] as const).map((place) => (
              <button
                key={place}
                type="button"
                onClick={() => change({ footer_place: place })}
                aria-pressed={look.footer_place === place}
                title={t(`screen.footerPlace.${place}`)}
                aria-label={t(`screen.footerPlace.${place}`)}
                className={`h-8 rounded-cp-sm ${look.footer_place === place ? "bg-cp-live" : "bg-cp-surface hover:bg-cp-hover"}`}
              />
            ))}
          </div>
          {!FOOTER_PRESETS.includes(look.footer_place as never) && <p className="m-0 text-[12px] text-cp-muted">{t("placement.footerDragged")}</p>}
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-cp-muted">{t("screen.licence")}</span>
            <input
              value={licence}
              inputMode="numeric"
              onChange={(e) => setLicence(e.target.value)}
              onBlur={saveLicence}
              onKeyDown={(e) => e.key === "Enter" && saveLicence()}
              className="w-40 rounded-cp border-cp bg-cp-bg px-2.5 py-1.5 font-mono text-[13px]"
            />
          </label>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[12px] font-semibold tracking-wide text-cp-muted uppercase">{t("placement.fade")}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={look.fade_ms === 0} label={t("placement.fadeCut")} onClick={() => change({ fade_ms: 0 })} />
            <Chip on={look.fade_ms > 0} label={t("placement.fadeOn")} onClick={() => look.fade_ms === 0 && change({ fade_ms: 600 })} />
          </div>
          {look.fade_ms > 0 && (
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="text-cp-muted">{t("placement.fadeTime", { seconds: (look.fade_ms / 1000).toFixed(1) })}</span>
              <input
                type="range"
                min={100}
                max={3000}
                step={100}
                value={look.fade_ms}
                onChange={(e) => change({ fade_ms: Number(e.target.value) }, 200)}
                className="w-full accent-[var(--cp-live)]"
              />
            </label>
          )}
          <p className="m-0 text-[12px] text-cp-muted">{t("placement.fadeHelp")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[12px] font-semibold tracking-wide text-cp-muted uppercase">{t("screen.titleSlide")}</h3>
          <label className="flex items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={look.title_slide}
              onChange={(e) => {
                change({ title_slide: e.target.checked });
                setShowTitle(e.target.checked);
              }}
              className="mt-0.5 accent-[var(--cp-live)]"
            />
            <span>
              {t("placement.titleSlide")}
              <span className="block text-[12px] text-cp-muted">{t("placement.titleSlideHelp")}</span>
            </span>
          </label>
        </section>
      </div>
    </div>
  );
}
