import { useCallback, useEffect, useState } from "react";
import type { Screens } from "../generated/Screens";
import { t } from "../i18n";
import { api } from "../lib/api";

// Where the Display window shows: a normal window, or fullscreen on one of
// the computer's screens (pick the projector). Re-opens the window if it was
// closed. Hidden when the console runs in a plain browser.
export function ScreenPicker() {
  const [screens, setScreens] = useState<Screens | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(() => {
    api
      .screens()
      .then(setScreens)
      .catch(() => setScreens(null));
  }, []);
  useEffect(refresh, [refresh]);

  if (!screens) return null;
  const choose = async (value: string) => {
    try {
      setScreens(await api.showDisplayOn(value === "" ? null : Number(value)));
      setFailed(false);
      // The window manager finishes the move a moment later.
      setTimeout(refresh, 800);
    } catch {
      setFailed(true);
    }
  };

  return (
    <label className="flex min-w-0 items-center gap-1.5" data-guide="screens">
      <span className="sr-only">{t("screens.label")}</span>
      <select
        value={screens.output ?? ""}
        onChange={(e) => void choose(e.target.value)}
        onFocus={refresh}
        title={failed ? t("screens.failed") : t("screens.help")}
        className={`h-7 min-w-0 max-w-56 rounded-cp-sm border-cp bg-cp-bg px-1.5 text-[12px] ${failed ? "text-cp-danger" : "text-cp-text"}`}
      >
        <option value="">{t("screens.window")}</option>
        {screens.screens.map((s) => (
          <option key={s.index} value={s.index}>
            {t("screens.fullscreenOn", { number: s.index + 1, name: s.name, size: `${s.width}×${s.height}` })}
            {s.primary ? ` · ${t("screens.main")}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
