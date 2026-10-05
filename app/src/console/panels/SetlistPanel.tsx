import { t } from "../../i18n";
import { useLive } from "../LiveContext";

// Tonight's songs. Until the song library exists this lists the song on air.
export function SetlistPanel() {
  const { state } = useLive();
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto bg-cp-panel p-3 font-ui text-[13px] text-cp-text">
      <span className="cp-label mb-1.5">{t("setlist.tonight")}</span>
      {!state?.song_id && <p className="m-0 px-2 text-cp-muted">{t("setlist.nothingOnAir")}</p>}
      {state?.song_id && (
        <button
          type="button"
          aria-current="true"
          className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2 rounded-cp bg-cp-surface-hi px-2 py-2 text-left font-semibold"
        >
          <span className="font-mono text-[11px] text-cp-muted">1</span>
          <span>{state.title}</span>
        </button>
      )}
      <p className="m-0 mt-2 px-2 text-cp-muted">{t("setlist.comingSoon")}</p>
    </div>
  );
}
