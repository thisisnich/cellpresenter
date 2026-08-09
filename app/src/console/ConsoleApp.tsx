import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { useLiveState } from "../lib/useLiveState";
import type { LiveState } from "../lib/ws";

export default function ConsoleApp() {
  const { state, patch, status } = useLiveState();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">CellPresenter Console</h1>
          <p className="text-xs text-slate-500">M1 spike — live state over /ws</p>
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

        <main className="flex min-w-0 flex-1 items-center justify-center p-8">
          <div className="flex aspect-video w-full max-w-3xl items-center justify-center rounded-xl bg-black shadow-2xl">
            {state && state.visible ? (
              <p className="px-12 text-center text-3xl font-bold text-white md:text-4xl">
                {active}
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                {state ? "display blacked out" : "waiting for state…"}
              </p>
            )}
          </div>
        </main>
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-slate-800 px-5 py-3">
        <div className="flex gap-2">
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
        {error && <p className="truncate text-sm text-rose-400">{error}</p>}
        <p className="hidden shrink-0 text-xs text-slate-500 lg:block">
          display: http://{location.host}/?view=display
        </p>
      </footer>
    </div>
  );
}
