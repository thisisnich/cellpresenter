import { useCallback, useEffect, useRef, useState } from "react";
import type { BackupList } from "../../generated/BackupList";
import type { RestoredCounts } from "../../generated/RestoredCounts";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import { notifyLibraryChanged } from "../../lib/libraryEvents";

const onThisComputer = () => ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function problem(err: unknown): string {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "pin_required") return t("backup.needPin");
  if (code === "not_a_backup") return t("backup.notABackup");
  return t("backup.failed");
}

// Back up the whole library (songs, setlists, settings, pictures) to one
// file, and bring a backup back, here or on another computer.
export function BackupPanel() {
  const [list, setList] = useState<BackupList | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setList(await api.listBackups());
    } catch (err) {
      setMessage({ ok: false, text: problem(err) });
    }
  }, []);
  useEffect(() => void load(), [load]);

  const run = async (what: string, job: () => Promise<string>) => {
    setBusy(what);
    setMessage(null);
    setConfirm(null);
    try {
      setMessage({ ok: true, text: await job() });
    } catch (err) {
      setMessage({ ok: false, text: problem(err) });
    } finally {
      setBusy(null);
      void load();
    }
  };
  const restored = (c: RestoredCounts) => {
    notifyLibraryChanged();
    return t("backup.restored", { songs: c.songs, setlists: c.setlists, pictures: c.pictures });
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-cp-panel p-3.5 font-ui text-[13px] text-cp-text">
      <p className="m-0 text-cp-muted">{t("backup.intro")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run("create", async () => t("backup.made", { name: (await api.createBackup()).name }))}
          className="cp-btn-live px-4"
        >
          {busy === "create" ? t("backup.making") : t("backup.now")}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => picker.current?.click()} className="cp-btn">
          {busy === "file" ? t("backup.restoring") : t("backup.fromFile")}
        </button>
        {onThisComputer() && (
          <button type="button" onClick={() => void api.openBackupFolder().catch(() => undefined)} className="cp-btn">
            {t("backup.openFolder")}
          </button>
        )}
        <input
          ref={picker}
          type="file"
          accept=".cpbackup"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void run("file", async () => restored(await api.restoreBackupFile(file)));
          }}
        />
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`m-0 ${message.ok ? "text-cp-text" : "text-cp-danger"}`}>
          {message.text}
        </p>
      )}
      {list && (
        <p className="m-0 break-all text-[12px] text-cp-muted">{t("backup.folder", { folder: list.folder })}</p>
      )}

      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {list?.backups.length === 0 && <li className="text-cp-muted">{t("backup.none")}</li>}
        {list?.backups.map((b) => (
          <li key={b.name} className="flex flex-col gap-1.5 rounded-cp border-cp bg-cp-surface px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span>
                {when(b.created_at)}
                <span className="ml-2 text-[12px] text-cp-muted">
                  {size(b.size)}
                  {b.auto ? ` · ${t("backup.auto")}` : ""}
                </span>
              </span>
              {confirm !== b.name && (
                <button type="button" disabled={busy !== null} onClick={() => setConfirm(b.name)} className="cp-btn px-2.5 py-1">
                  {busy === b.name ? t("backup.restoring") : t("backup.restore")}
                </button>
              )}
            </div>
            {confirm === b.name && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-cp-muted">{t("backup.confirm")}</span>
                <button
                  type="button"
                  onClick={() => void run(b.name, async () => restored(await api.restoreBackup(b.name)))}
                  className="cp-btn-live px-3 py-1"
                >
                  {t("backup.restore")}
                </button>
                <button type="button" onClick={() => setConfirm(null)} className="cp-btn px-3 py-1">
                  {t("backup.cancel")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
