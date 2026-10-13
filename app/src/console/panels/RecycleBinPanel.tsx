import type { IDockviewPanelProps } from "dockview-react";
import { useCallback, useEffect, useState } from "react";
import type { Deleted } from "../../generated/Deleted";
import type { RecycleBin } from "../../generated/RecycleBin";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import { notifyLibraryChanged, onLibraryChanged } from "../../lib/libraryEvents";

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// Deleted songs and setlists, ready to bring back.
export function RecycleBinPanel({ api: panel }: IDockviewPanelProps) {
  const [bin, setBin] = useState<RecycleBin | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBin(await api.recycleBin());
    } catch (err) {
      setError(err instanceof ApiError && err.code === "pin_required" ? t("bin.needPin") : t("bin.loadFailed"));
    }
  }, []);
  useEffect(() => {
    void load();
    // Fresh each time the tab is shown: things get deleted elsewhere too.
    const shown = panel.onDidVisibilityChange(({ isVisible }) => isVisible && void load());
    const active = panel.onDidActiveChange(({ isActive }) => isActive && void load());
    const changed = onLibraryChanged(() => void load());
    return () => {
      shown.dispose();
      active.dispose();
      changed();
    };
  }, [load, panel]);

  const restore = async (kind: "song" | "setlist", item: Deleted) => {
    setBusy(item.id);
    setError(null);
    try {
      await (kind === "song" ? api.undeleteSong(item.id) : api.undeleteSetlist(item.id));
      notifyLibraryChanged();
    } catch {
      setError(t("bin.restoreFailed"));
    } finally {
      setBusy(null);
    }
  };

  const group = (kind: "song" | "setlist", items: Deleted[]) => (
    <section className="flex flex-col gap-1" aria-labelledby={`bin-${kind}`}>
      <h3 id={`bin-${kind}`} className="cp-label m-0">
        {t(kind === "song" ? "bin.songs" : "bin.setlists")}
      </h3>
      {items.length === 0 && <p className="m-0 text-cp-muted">{t("bin.empty")}</p>}
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-cp px-2 py-1.5 hover:bg-cp-surface">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{item.title}</span>
              <span className="truncate text-[12px] text-cp-muted">
                {[item.detail, t("bin.deletedAt", { when: when(item.deleted_at) })].filter(Boolean).join(" · ")}
              </span>
            </span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void restore(kind, item)}
              aria-label={t("bin.restoreItem", { title: item.title })}
              className="cp-btn px-2.5 py-1"
            >
              {busy === item.id ? t("bin.restoring") : t("bin.restore")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-cp-panel p-3.5 font-ui text-[13px] text-cp-text">
      <p className="m-0 text-cp-muted">{t("bin.intro")}</p>
      {error && (
        <p role="alert" className="m-0 text-cp-danger">
          {error}
        </p>
      )}
      {bin && group("song", bin.songs)}
      {bin && group("setlist", bin.setlists)}
    </div>
  );
}
