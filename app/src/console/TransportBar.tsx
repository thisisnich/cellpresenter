import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { useLive } from "./LiveContext";

// How often a dragged text-size slider may send an update.
const SCALE_SEND_MS = 100;

export function TransportBar() {
  const { state, error, send } = useLive();

  // The slider moves locally at full speed; the server hears about it at most
  // every SCALE_SEND_MS, and always gets the final value.
  const [scale, setScale] = useState(state?.text_scale ?? 1);
  const dragging = useRef(false);
  const pending = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state && !dragging.current) setScale(state.text_scale);
  }, [state]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const changeScale = (value: number) => {
    setScale(value);
    pending.current = value;
    if (timer.current !== undefined) return;
    const flush = () => {
      timer.current = undefined;
      if (pending.current === null) return;
      const v = pending.current;
      pending.current = null;
      void send({ type: "set_text_scale", scale: v });
      timer.current = window.setTimeout(flush, SCALE_SEND_MS);
    };
    flush();
  };

  const disabled = !state;
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t-cp bg-cp-chrome px-4 py-2.5 font-ui text-[13px] text-cp-text">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => send({ type: "toggle_visible" })}
          className={state?.visible === false ? "cp-btn-danger" : "cp-btn"}
          aria-pressed={state?.visible === false}
        >
          {state?.visible === false ? t("transport.show") : t("transport.blackOut")}
        </button>
        <button
          type="button"
          disabled={disabled || state.text_hidden}
          onClick={() => send({ type: "clear_text" })}
          title={t("transport.clearTextHelp")}
          className="cp-btn"
        >
          {t("transport.clearText")}
        </button>
        <button
          type="button"
          disabled={disabled || !state.background}
          onClick={() => send({ type: "clear_background" })}
          title={t("transport.clearBackgroundHelp")}
          className="cp-btn"
        >
          {t("transport.clearBackground")}
        </button>
        {error && (
          <p role="alert" className="m-0 text-cp-danger">
            {t("transport.requestFailed", { message: error })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="text-scale" className="text-cp-muted">
          {t("transport.textSize")}
        </label>
        <input
          id="text-scale"
          type="range"
          min={0.6}
          max={1.6}
          step={0.05}
          value={scale}
          disabled={disabled}
          onPointerDown={() => (dragging.current = true)}
          onPointerUp={() => (dragging.current = false)}
          onChange={(e) => changeScale(Number(e.target.value))}
          className="w-28 accent-[var(--cp-live)]"
        />
        <span className="w-10 font-mono text-[12px] text-cp-muted tabular-nums">{Math.round(scale * 100)}%</span>
        <button type="button" disabled={disabled} onClick={() => send({ type: "prev" })} className="cp-btn px-4 font-semibold">
          {t("transport.prev")}
        </button>
        <button type="button" disabled={disabled} onClick={() => send({ type: "next" })} className="cp-btn-live" data-guide="next">
          {t("transport.next")}
        </button>
      </div>
    </footer>
  );
}
