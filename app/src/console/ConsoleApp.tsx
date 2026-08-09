import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { useLiveState } from "../lib/useLiveState";
import type { LiveState } from "../lib/ws";
import { LyricSlide } from "../display/LyricSlide";
import { Stage } from "../display/Stage";
import { ASPECT_OPTIONS, PreviewFrame, type Aspect } from "./PreviewFrame";

export default function ConsoleApp() {
  const { state, patch, status } = useLiveState();
  const [error, setError] = useState<string | null>(null);
  const [previewAspect, setPreviewAspect] = useState<Aspect>(ASPECT_OPTIONS[0]);

  const run = useCallback(
    async (fn: () => Promise<LiveState>) => {
      setError(null);
      try {
        patch(await fn());
      } catch (err) {
        setError(err instanceof Error ? err.message : "request failed");
      }
    },
    [patch],
  );

  const connected = status === "open";
  const active = state?.slides[state.slide_index] ?? "";
  const textScale = state?.text_scale ?? 1;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">CellPresenter Console</h1>
          <p className="text-xs text-slate-500">M1 spike — live state over /ws</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Preview</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-800">
              {ASPECT_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setPreviewAspect(opt)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    previewAspect.label === opt.label
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <span
            className={
              connected
                ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400"
                : "rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400"
            }
          >
            {connected ? "connected" : status}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-800 p-3">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Slides
          </p>
          <ul className="space-y-1">
            {state?.slides.map((slide, i) => (
              <li key={i}>
                <button
                  onClick={() => run(() => api.liveGoTo(i))}
                  className={`w-full truncate rounded px-2 py-1.5 text-left text-sm transition-colors ${
                    i === state.slide_index
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="mr-2 text-xs opacity-60">{i + 1}</span>
                  {slide}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* WYSIWYG preview: locked to the selected aspect, same Stage as displays. */}
        <main className="relative min-w-0 flex-1">
          {state && (
            <PreviewFrame aspect={previewAspect}>
              <Stage>
                {state.visible ? (
                  <LyricSlide text={active} textScale={textScale} />
                ) : (
                  <p className="text-sm text-slate-500">display blacked out</p>
                )}
              </Stage>
            </PreviewFrame>
          )}
        </main>
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-slate-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => run(api.livePrev)} className="btn">
            ← Prev
          </button>
          <button onClick={() => run(api.liveNext)} className="btn-primary">
            Next →
          </button>
          <button onClick={() => run(api.liveToggleVisible)} className="btn">
            {state?.visible ? "Black out" : "Show"}
          </button>
        </div>

        <label className="flex items-center gap-3 text-sm text-slate-400">
          Text size
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={textScale}
            onChange={(e) => run(() => api.liveTextScale(Number(e.target.value)))}
            className="w-40 accent-indigo-600"
          />
          <span className="w-12 tabular-nums">{Math.round(textScale * 100)}%</span>
        </label>

        {error && <p className="truncate text-sm text-rose-400">{error}</p>}
        <p className="hidden shrink-0 text-xs text-slate-500 lg:block">
          display: http://{location.host}/?view=display
        </p>
      </footer>
    </div>
  );
}
