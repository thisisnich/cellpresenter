import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { t, type MessageKey } from "../i18n";
import { usePages } from "./pages";

// A short tour for whoever opens the app first: each step says what to do
// and outlines the real control for it. Shown once per computer; the ? in
// the header brings it back.

const DONE_KEY = "cellpresenter.guide.done";

interface Step {
  title: MessageKey;
  body: MessageKey;
  /** The control to outline (`data-guide` on it), if it's on screen. */
  target?: string;
}

const STEPS: Step[] = [
  { title: "guide.welcome.title", body: "guide.welcome.body" },
  { title: "guide.display.title", body: "guide.display.body", target: "screens" },
  { title: "guide.songs.title", body: "guide.songs.body", target: "add-songs" },
  { title: "guide.setlist.title", body: "guide.setlist.body", target: "setlist-new" },
  { title: "guide.live.title", body: "guide.live.body", target: "next" },
  { title: "guide.phones.title", body: "guide.phones.body", target: "display-link" },
];

const isDone = () => {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true; // Storage blocked: don't nag on every start.
  }
};

const GuideContext = createContext<{ open: () => void } | null>(null);
export const useGuide = () => useContext(GuideContext);

export function GuideProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number | null>(() => (isDone() ? null : 0));
  const { setPage } = usePages();
  const open = useCallback(() => {
    setPage("show");
    setStep(0);
  }, [setPage]);
  const close = () => {
    setStep(null);
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      // Not remembered; it shows again next time.
    }
  };
  return (
    <GuideContext.Provider value={{ open }}>
      {children}
      {step !== null && <GuideCard step={step} onStep={setStep} onClose={close} />}
    </GuideContext.Provider>
  );
}

/** Where the step's control is on screen, kept up to date. */
function useTargetRect(target: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target) return setRect(null);
    const measure = () => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-guide="${target}"]`)].find((e) => e.offsetParent);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const timer = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [target]);
  return rect;
}

function GuideCard({ step, onStep, onClose }: { step: number; onStep: (n: number) => void; onClose: () => void }) {
  const current = STEPS[step];
  const rect = useTargetRect(current.target);
  const last = step === STEPS.length - 1;

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
        className="fixed bottom-20 left-1/2 z-50 flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3 rounded-cp border-cp bg-cp-chrome p-4 font-ui text-[13px] text-cp-text shadow-2xl"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="guide-title" className="m-0 text-[15px] font-semibold">
            {t(current.title)}
          </h2>
          <span className="shrink-0 text-[11px] text-cp-muted">{t("guide.count", { step: step + 1, total: STEPS.length })}</span>
        </div>
        <p className="m-0 leading-relaxed text-cp-muted">{t(current.body)}</p>
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
