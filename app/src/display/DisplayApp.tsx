import { useEffect, useState } from "react";
import { useLiveState } from "../lib/useLiveState";
import { LyricSlide } from "./LyricSlide";
import { Stage, STAGE_HEIGHT, STAGE_WIDTH } from "./Stage";

// Stateless renderer: everything it shows comes from the live state pushed
// over /ws, so this view is byte-for-byte identical on a phone or projector.
export default function DisplayApp() {
  const { state, status } = useLiveState();
  const active = state?.slides[state.slide_index] ?? "";
  const shown = state?.visible ?? false;
  const textScale = state?.text_scale ?? 1;

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
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <Stage>
        {state && shown ? (
          <LyricSlide text={active} textScale={textScale} />
        ) : (
          <p className="text-sm text-white/30">
            {state ? "blacked out" : "no signal"}
          </p>
        )}
        {state && (
          <p className="absolute bottom-6 right-10 text-xl font-medium text-white/40">
            {state.slide_index + 1} / {state.slides.length}
          </p>
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
          {status === "connecting" ? "connecting…" : "disconnected — reconnecting"}
        </p>
      )}
    </div>
  );
}
