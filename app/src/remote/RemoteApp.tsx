import { useCallback, useEffect, useState } from "react";
import { SlidePreview } from "../console/SlidePreview";
import { LookContext } from "../display/look";
import { currentJump, sectionJumps } from "../domain/sections";
import type { LiveState } from "../generated/LiveState";
import { t } from "../i18n";
import { api, ApiError, controlPinSet, setControlPin, type LiveCommand } from "../lib/api";
import { useLiveState } from "../lib/useLiveState";
import { PinGate } from "./PinGate";
import { SongPicker } from "./SongPicker";

/** A PIN in the link (`/remote#pin=1234`, from the console's QR code). */
function takePinFromLink(): void {
  const match = /(?:^|[#&])pin=(\d{4})(?:&|$)/.exec(location.hash);
  if (!match) return;
  setControlPin(match[1]);
  history.replaceState(null, "", location.pathname + location.search);
}

/** Keep the phone's screen on while the remote is open, where allowed. */
function useWakeLock(): void {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = () => {
      const wakeLock = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } }).wakeLock;
      if (document.visibilityState === "visible" && wakeLock) wakeLock.request("screen").then((l) => (lock = l)).catch(() => undefined);
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

// Phone remote: what's on screen, what's next, section jumps and big
// Next / Prev buttons. Devices other than the presenting computer need the PIN.
export default function RemoteApp() {
  const [paired, setPaired] = useState<"checking" | "yes" | "no" | "changed">("checking");

  useEffect(() => {
    takePinFromLink();
    api
      .checkControl()
      .then(() => setPaired("yes"))
      .catch(() => {
        const hadPin = controlPinSet();
        setControlPin(null);
        setPaired(hadPin ? "changed" : "no");
      });
  }, []);

  if (paired === "checking") {
    return <div className="flex h-dvh items-center justify-center bg-cp-bg font-ui text-cp-muted">{t("connection.connecting")}</div>;
  }
  if (paired !== "yes") {
    return <PinGate onPaired={() => setPaired("yes")} reason={paired === "changed" ? "changed" : undefined} />;
  }
  return (
    <Remote
      onUnpaired={() => {
        setControlPin(null);
        setPaired("changed");
      }}
    />
  );
}

function Remote({ onUnpaired }: { onUnpaired: () => void }) {
  const { state, patch, status } = useLiveState();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useWakeLock();

  const run = useCallback(
    async (call: () => Promise<LiveState>) => {
      try {
        patch(await call());
        setError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onUnpaired();
        else setError(t("remote.failed"));
      }
    },
    [patch, onUnpaired],
  );
  const send = (command: LiveCommand) => run(() => api.liveCommand(command));

  if (!state) {
    return <div className="flex h-dvh items-center justify-center bg-cp-bg font-ui text-cp-muted">{t("connection.connecting")}</div>;
  }

  const slide = state.slides[state.slide_index];
  const next = state.slides[state.slide_index + 1];
  const jumps = sectionJumps(state.slides);
  const here = currentJump(jumps, state.slide_index);
  const background = state.background;

  return (
    <LookContext.Provider value={state.look}>
      <main className="flex h-dvh flex-col gap-3 bg-cp-bg p-3 font-ui text-cp-text select-none">
        <header className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setPicking(true)} className="flex min-w-0 flex-1 flex-col items-start text-left">
            <span className="text-xs text-cp-muted">{t("remote.changeSong")} ▾</span>
            <span className="max-w-full truncate text-lg font-semibold">{state.title || t("remote.nothingOnAir")}</span>
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs text-cp-muted">
            <span className={`size-2 rounded-full ${status === "open" ? "bg-cp-ok" : "bg-cp-danger"}`} />
            {status === "open" ? t("connection.open") : t("connection.connecting")}
          </span>
        </header>

        <section aria-label={t("output.live")} className="flex flex-col gap-1">
          <span className="cp-label text-cp-live">
            {t("output.live")}
            {slide ? ` · ${slide.section}` : ""}
          </span>
          <div className="overflow-hidden rounded-cp border-cp">
            <SlidePreview
              text={slide?.text ?? ""}
              textScale={state.text_scale}
              blank={!state.visible}
              blankLabel={t("output.blackedOut")}
              background={background}
              hideText={state.text_hidden}
            />
          </div>
        </section>

        {next && (
          <section aria-label={t("slides.next")} className="flex flex-col gap-1">
            <span className="cp-label text-cp-next">{t("output.next", { section: next.section })}</span>
            <p className="m-0 line-clamp-2 rounded-cp border-cp bg-cp-panel px-3 py-2 text-sm whitespace-pre-line text-cp-muted">{next.text}</p>
          </section>
        )}

        {jumps.length > 1 && (
          <nav aria-label={t("remote.sections")} className="flex flex-wrap gap-2">
            {jumps.map((jump) => {
              const on = jump === here;
              return (
                <button
                  key={jump.index}
                  type="button"
                  onClick={() => void send({ type: "go_to", index: jump.index })}
                  aria-current={on ? "true" : undefined}
                  title={jump.section}
                  className={`h-11 min-w-11 shrink-0 rounded-cp px-3 font-mono text-sm font-semibold ${on ? "bg-cp-live text-cp-on-live" : "border-cp bg-cp-surface"}`}
                >
                  {jump.label}
                </button>
              );
            })}
          </nav>
        )}

        {error && (
          <p role="alert" className="m-0 text-sm text-cp-danger">
            {error}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void send({ type: "toggle_visible" })}
              aria-pressed={!state.visible}
              className={`h-12 ${!state.visible ? "cp-btn-danger" : "cp-btn"}`}
            >
              {state.visible ? t("transport.blackOut") : t("transport.show")}
            </button>
            <button
              type="button"
              disabled={state.text_hidden}
              onClick={() => void send({ type: "clear_text" })}
              className="cp-btn h-12"
            >
              {t("transport.clearText")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => void send({ type: "prev" })} className="cp-btn h-24 text-lg font-semibold">
              {t("transport.prev")}
            </button>
            <button type="button" onClick={() => void send({ type: "next" })} className="cp-btn-live col-span-2 h-24 text-2xl">
              {t("transport.next")}
            </button>
          </div>
        </div>

        {picking && (
          <SongPicker
            live={state}
            onClose={() => setPicking(false)}
            onShowItem={(setlistId, itemId) => {
              setPicking(false);
              void run(() => api.showItem({ setlist_id: setlistId, item_id: itemId, slide_index: 0 }));
            }}
            onShowSong={(songId) => {
              setPicking(false);
              void run(() => api.showSong({ song_id: songId, slide_index: 0 }));
            }}
          />
        )}
      </main>
    </LookContext.Provider>
  );
}
