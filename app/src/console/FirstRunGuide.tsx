import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { t, type MessageKey } from "../i18n";
import { kindOf, type PanelKind } from "./layout";
import { usePages, type Page } from "./pages";

// Short tours. "start" is for whoever opens the app first: each step says
// what to do and outlines the real control for it. Each page also has its
// own tour of what its panels and settings do; Edit's and Chords' start the
// first time those pages are opened. Each is shown once per computer; the ?
// in the header brings them back.

export type Tour = "start" | Page;

interface Step {
  title: MessageKey;
  body: MessageKey;
  /** The control to outline (`data-guide` on it), if it's on screen. */
  target?: string;
  /** The panel the step is about: brought to the front, and outlined when there's no target. */
  panel?: PanelKind | "editor";
}

const TOURS: Record<Tour, Step[]> = {
  start: [
    { title: "guide.welcome.title", body: "guide.welcome.body" },
    { title: "guide.display.title", body: "guide.display.body", target: "screens" },
    { title: "guide.songs.title", body: "guide.songs.body", target: "add-songs" },
    { title: "guide.setlist.title", body: "guide.setlist.body", target: "setlist-new" },
    { title: "guide.live.title", body: "guide.live.body", target: "next" },
    { title: "guide.phones.title", body: "guide.phones.body", target: "display-link" },
    { title: "guide.more.title", body: "guide.more.body", target: "guide" },
  ],
  show: [
    { title: "guide.show.intro.title", body: "guide.show.intro.body", target: "layout" },
    { title: "guide.show.setlist.title", body: "guide.show.setlist.body", panel: "setlist" },
    { title: "guide.show.library.title", body: "guide.show.library.body", panel: "library" },
    { title: "guide.show.scripture.title", body: "guide.show.scripture.body", panel: "scripture" },
    { title: "guide.show.slides.title", body: "guide.show.slides.body", panel: "slides" },
    { title: "guide.show.notes.title", body: "guide.show.notes.body", panel: "notes" },
    { title: "guide.show.output.title", body: "guide.show.output.body", panel: "output" },
    { title: "guide.show.media.title", body: "guide.show.media.body", panel: "media" },
    { title: "guide.show.look.title", body: "guide.show.look.body", panel: "screen", target: "screen-look" },
    { title: "guide.show.footer.title", body: "guide.show.footer.body", panel: "screen", target: "screen-footer" },
    { title: "guide.show.transport.title", body: "guide.show.transport.body", target: "transport" },
    { title: "guide.show.header.title", body: "guide.show.header.body", target: "status" },
  ],
  edit: [
    { title: "guide.edit.intro.title", body: "guide.edit.intro.body" },
    { title: "guide.edit.library.title", body: "guide.edit.library.body", panel: "library", target: "add-songs" },
    { title: "guide.edit.search.title", body: "guide.edit.search.body", panel: "search" },
    { title: "guide.edit.details.title", body: "guide.edit.details.body", panel: "editor", target: "editor-details" },
    { title: "guide.edit.text.title", body: "guide.edit.text.body", panel: "editor", target: "editor-text" },
    { title: "guide.edit.preview.title", body: "guide.edit.preview.body", panel: "editor", target: "editor-preview" },
    { title: "guide.edit.split.title", body: "guide.edit.split.body", panel: "editor", target: "editor-split" },
    { title: "guide.edit.backgrounds.title", body: "guide.edit.backgrounds.body", panel: "editor", target: "editor-backgrounds" },
    { title: "guide.edit.save.title", body: "guide.edit.save.body", panel: "editor", target: "editor-save" },
    { title: "guide.edit.media.title", body: "guide.edit.media.body", panel: "media" },
    { title: "guide.edit.backup.title", body: "guide.edit.backup.body", panel: "backup" },
    { title: "guide.edit.bin.title", body: "guide.edit.bin.body", panel: "bin" },
  ],
  chords: [
    { title: "guide.chords.intro.title", body: "guide.chords.intro.body", panel: "chords" },
    { title: "guide.chords.key.title", body: "guide.chords.key.body", panel: "chords", target: "chord-controls" },
    { title: "guide.chords.follow.title", body: "guide.chords.follow.body", panel: "chords" },
    { title: "guide.chords.phones.title", body: "guide.chords.phones.body", target: "display-link" },
  ],
};

// The start tour keeps its original key, so nobody who finished it sees it again.
const doneKey = (tour: Tour) => (tour === "start" ? "cellpresenter.guide.done" : `cellpresenter.guide.done.${tour}`);

const isDone = (tour: Tour) => {
  try {
    return localStorage.getItem(doneKey(tour)) === "1";
  } catch {
    return true; // Storage blocked: don't nag on every start.
  }
};

const GuideContext = createContext<{ open: (tour: Tour) => void } | null>(null);
export const useGuide = () => useContext(GuideContext);

export function GuideProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{ tour: Tour; step: number } | null>(() =>
    isDone("start") ? null : { tour: "start", step: 0 },
  );
  const { page, setPage } = usePages();
  // Tours already shown this run, in case storage won't remember them.
  const shown = useRef(new Set<Tour>());
  const open = useCallback(
    (tour: Tour) => {
      setPage(tour === "start" ? "show" : tour);
      setCurrent({ tour, step: 0 });
    },
    [setPage],
  );
  const close = useCallback(() => {
    if (!current) return;
    shown.current.add(current.tour);
    setCurrent(null);
    try {
      localStorage.setItem(doneKey(current.tour), "1");
    } catch {
      // Not remembered; it shows again next time.
    }
  }, [current]);

  // A page tour belongs to its page: leaving the page ends it. The first
  // visit to Edit or Chords starts theirs (Show's is the start tour's home).
  useEffect(() => {
    if (current && current.tour !== "start" && current.tour !== page) close();
    else if (!current && page !== "show" && isDone("start") && !isDone(page) && !shown.current.has(page)) setCurrent({ tour: page, step: 0 });
  }, [page, current, close]);

  return (
    <GuideContext.Provider value={{ open }}>
      {children}
      {current && (
        <GuideCard steps={TOURS[current.tour]} step={current.step} onStep={(step) => setCurrent({ ...current, step })} onClose={close} />
      )}
    </GuideContext.Provider>
  );
}

/** Bring the step's panel to the front, and find what to outline. */
function useStepRect(step: Step): { rect: DOMRect | null; missing: Step["panel"] | null } {
  const { page, dockOf } = usePages();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const panel = step.panel ? dockOf(page)?.panels.find((p) => kindOf(p.id) === step.panel) : undefined;
  useEffect(() => {
    panel?.api.setActive();
    const measure = () => {
      const target = step.target
        ? [...document.querySelectorAll<HTMLElement>(`[data-guide="${step.target}"]`)].find((e) => e.offsetParent)
        : undefined;
      const el = target ?? panel?.group.element;
      setRect(el?.offsetParent ? el.getBoundingClientRect() : null);
    };
    measure();
    const timer = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [step, panel]);
  return { rect, missing: step.panel && !panel ? step.panel : null };
}

/** The tabs in front of each panel group, put back when the tour ends. */
function useRestoreTabs() {
  const { page, dockOf } = usePages();
  useEffect(() => {
    const dock = dockOf(page);
    const front = dock?.groups.map((g) => g.activePanel?.id).filter((id): id is string => Boolean(id)) ?? [];
    return () => {
      for (const id of front) dock?.getPanel(id)?.api.setActive();
    };
  }, [page, dockOf]);
}

function GuideCard({ steps, step, onStep, onClose }: { steps: Step[]; step: number; onStep: (n: number) => void; onClose: () => void }) {
  const current = steps[step];
  const { rect, missing } = useStepRect(current);
  useRestoreTabs();
  const last = step === steps.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-cp transition-all"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 3px var(--cp-live), 0 0 0 9999px rgb(0 0 0 / 0.35)",
          }}
        />
      )}
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="guide-title"
        className="fixed bottom-20 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3 rounded-cp border-cp bg-cp-chrome p-4 font-ui text-[13px] text-cp-text shadow-2xl"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="guide-title" className="m-0 text-[15px] font-semibold">
            {t(current.title)}
          </h2>
          <span className="shrink-0 text-[11px] text-cp-muted">{t("guide.count", { step: step + 1, total: steps.length })}</span>
        </div>
        <p className="m-0 leading-relaxed text-cp-muted">{t(current.body)}</p>
        {missing && (
          <p className="m-0 text-[12px] text-cp-muted italic">
            {missing === "editor" ? t("guide.openSong") : t("guide.panelClosed", { panel: t(`panel.${missing}`) })}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="text-[12px] text-cp-muted underline hover:text-cp-text">
            {last ? t("guide.close") : t("guide.skip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => onStep(step - 1)} className="cp-btn px-3 py-1.5">
                {t("guide.back")}
              </button>
            )}
            <button type="button" autoFocus onClick={() => (last ? onClose() : onStep(step + 1))} className="cp-btn-live px-4 py-1.5">
              {last ? t("guide.done") : t("guide.next")}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
