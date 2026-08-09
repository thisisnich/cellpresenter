import { useLiveState } from "../lib/useLiveState";

// Stateless renderer: everything it shows comes from the live state pushed
// over /ws, so this view is byte-for-byte identical on a phone or projector.
export default function DisplayApp() {
  const { state, status } = useLiveState();
  const active = state?.slides[state.slide_index] ?? "";
  const shown = state?.visible ?? false;

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white">
      {state && shown ? (
        <>
          <p className="max-w-5xl px-8 text-center text-5xl font-bold leading-snug md:text-7xl">
            {active}
          </p>
          <p className="absolute bottom-6 right-8 text-sm text-white/40">
            {state.slide_index + 1} / {state.slides.length}
          </p>
        </>
      ) : (
        <p className="text-sm text-white/30">
          {state ? "blacked out" : "no signal"}
        </p>
      )}

      {status !== "open" && (
        <p className="absolute top-6 right-8 text-xs text-white/40">
          {status === "connecting" ? "connecting…" : "disconnected — reconnecting"}
        </p>
      )}
    </div>
  );
}
