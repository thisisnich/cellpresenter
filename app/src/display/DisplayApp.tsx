import { useCallback, useEffect, useState } from "react";
import type { LiveCommand } from "../lib/api";
import { t } from "../i18n";
import { api } from "../lib/api";
import { useTransportKeys } from "../lib/transportKeys";
import { useLiveState } from "../lib/useLiveState";
import { footerLines } from "../domain/credits";
import { CreditsFooter } from "./CreditsFooter";
import { DEFAULT_LOOK, LookContext } from "./look";
import { LyricSlide } from "./LyricSlide";
import { isVideoUrl, SlideBackground } from "./SlideBackground";
import { Stage, STAGE_HEIGHT, STAGE_WIDTH } from "./Stage";

// Stateless renderer: everything it shows comes from the live state pushed
// over /ws, so this view is byte-for-byte identical on a phone or projector.
export default function DisplayApp() {
  const { state, status } = useLiveState();
  // The projector window on this machine responds to a clicker aimed at it.
  // Displays on other devices only watch.
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const send = useCallback((command: LiveCommand) => api.liveCommand(command).catch(() => undefined), []);
  useTransportKeys(send, local);
  const appWindow = new URLSearchParams(window.location.search).get("window") === "1";
  useFullscreenKey(appWindow);
  const slide = state?.slides[state.slide_index];
  const active = slide?.text ?? "";
  const shown = state?.visible ?? false;
  const textScale = state?.text_scale ?? 1;
  // The background layer, which slide cues switch on the server.
  const background = state?.background ?? null;
  const nextBackground = state?.slides[state.slide_index + 1]?.background ?? null;
  const footer = state ? footerLines(state.credits, state.look, state.slide_index) : null;

  // Load the next slide's background ahead of time so it never pops in.
  useEffect(() => {
    if (nextBackground && !isVideoUrl(nextBackground)) new Image().src = nextBackground;
  }, [nextBackground]);

  // `?diag=1` overlays diagnostics so we can confirm every client runs the
  // same bundle, has the font loaded, and computes the same stage scale.
  const diag = new URLSearchParams(window.location.search).get("diag") === "1";
  const [viewport, setViewport] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const bundle =
    document.querySelector('script[src*="/assets/index-"]')?.getAttribute("src") ??
    "vite";
  const scale = Math.min(
    viewport.w / STAGE_WIDTH,
    viewport.h / STAGE_HEIGHT,
  );
  const fontOk =
    typeof document.fonts?.check === "function" &&
    document.fonts.check('700 90px "Inter Variable"');

  return (
    <LookContext.Provider value={state?.look ?? DEFAULT_LOOK}>
      <main className="relative h-dvh w-full overflow-hidden bg-black" onDoubleClick={() => toggleFullscreen(appWindow)}>
        <Stage backdrop={state && background ? <SlideBackground url={background} paused={!shown} /> : null}>
          {/* Sizes here are stage pixels (1920 wide), so messages stay readable
              when the stage is scaled down to a phone. Blacked out = nothing. */}
          {!state && (
            <p className="text-5xl text-white/40">
              {status === "closed" ? t("display.noSignal") : t("connection.connecting")}
            </p>
          )}
          {state && shown && !state.text_hidden && state.slides.length > 0 && (
            <LyricSlide text={active} textScale={textScale} />
          )}
          {state && shown && !state.text_hidden && footer && <CreditsFooter lines={footer} />}
          {state && shown && state.slides.length === 0 && !background && (
            <p className="text-4xl text-white/25">{t("display.waiting")}</p>
          )}
        </Stage>

        {diag && (
          <div className="absolute left-3 top-3 z-10 rounded bg-black/70 px-2 py-1 font-mono text-[10px] leading-4 text-white/70">
            <div>
              viewport: {viewport.w}×{viewport.h}
            </div>
            <div>scale: {scale.toFixed(3)}</div>
            <div>font: {fontOk ? "Inter ✓" : "fallback ✗"}</div>
            <div>state: {state ? `slide ${state.slide_index + 1}, ${Math.round(textScale * 100)}%` : "none"}</div>
            <div>bundle: {bundle.split("/").pop()}</div>
          </div>
        )}

        {status !== "open" && (
          <p className="absolute top-6 right-8 text-xs text-white/40">
            {status === "connecting" ? t("connection.connecting") : t("display.reconnecting")}
          </p>
        )}
      </main>
    </LookContext.Provider>
  );
}

/**
 * F toggles fullscreen, like YouTube (Esc leaves it). The app's own Display
 * window asks the app, which fills the screen it's on (no title bar or
 * taskbar); a browser page uses the browser's fullscreen.
 */
function toggleFullscreen(appWindow: boolean): void {
  if (appWindow) {
    void api.toggleFullscreen().catch(() => undefined);
  } else if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined);
  } else {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }
}

function useFullscreenKey(appWindow: boolean): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen(appWindow);
      } else if (e.key === "Escape" && appWindow) {
        // Back to a window (does nothing if it already is one).
        void api.showDisplayOn(null).catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appWindow]);
}
