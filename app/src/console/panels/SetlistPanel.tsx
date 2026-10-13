import { useEffect, useState } from "react";
import { newId } from "../../domain/songEditing";
import type { SetlistItem } from "../../generated/SetlistItem";
import type { SetlistItemInput } from "../../generated/SetlistItemInput";
import { t } from "../../i18n";
import { BackgroundPicker } from "../BackgroundPicker";
import { useConsole } from "../ConsoleContext";
import { useLive } from "../LiveContext";

interface AnnouncementDraft {
  /** The item being edited, or null for a new announcement. */
  id: string | null;
  title: string;
  text: string;
  backgroundId: string | null;
}

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

function itemLabel(item: SetlistItem): string {
  if (item.kind === "announcement") return item.title || t("setlist.announcement");
  if (item.kind === "scripture") return item.title;
  return item.missing ? t("setlist.missingSong") : item.title;
}

// Tonight's setlist: songs and announcements in order. Click to preview;
// slides go live from the Slides panel.
export function SetlistPanel() {
  const { state } = useLive();
  const { setlists, setlist, openSetlist, createSetlist, saveSetlist, deleteSetlist, setlistError, selection, select } = useConsole();
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<AnnouncementDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(setlist?.name ?? "");
    setConfirmDelete(false);
  }, [setlist?.id, setlist?.name]);

  const saveDraft = async () => {
    if (!draft || !draft.title.trim()) return;
    const entry: SetlistItemInput = {
      kind: "announcement",
      id: draft.id ?? newId(),
      title: draft.title.trim(),
      text: draft.text,
      background_id: draft.backgroundId,
    };
    // Editing keeps the item's note.
    await saveSetlist((items) =>
      draft.id ? items.map((i) => (i.id === draft.id ? { ...entry, notes: i.notes } : i)) : [...items, entry],
    );
    setDraft(null);
  };

  return (
    <div className="flex h-full flex-col bg-cp-panel font-ui text-[13px] text-cp-text">
      <div className="flex flex-col gap-2 border-b-cp p-3">
        <div className="flex gap-2">
          <label htmlFor="setlist-picker" className="sr-only">
            {t("setlist.pick")}
          </label>
          <select
            id="setlist-picker"
            value={setlist?.id ?? ""}
            onChange={(e) => openSetlist(e.target.value || null)}
            className="min-w-0 flex-1 rounded-cp border-cp bg-cp-bg px-2 py-1.5 text-cp-text"
          >
            <option value="">{t("setlist.none")}</option>
            {setlists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.item_count})
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void createSetlist()} className="cp-btn px-2.5" data-guide="setlist-new">
            {t("setlist.new")}
          </button>
        </div>
        {setlist && (
          <div className="flex flex-wrap gap-2">
            <label className="min-w-32 flex-1">
              <span className="sr-only">{t("setlist.name")}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== setlist.name && void saveSetlist((items) => items, { name: name.trim() })}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="w-full rounded-cp border-cp bg-cp-bg px-2 py-1.5 font-semibold"
              />
            </label>
            <label>
              <span className="sr-only">{t("setlist.date")}</span>
              <input
                type="date"
                value={setlist.service_date ?? ""}
                onChange={(e) => void saveSetlist((items) => items, { service_date: e.target.value || null })}
                className="w-[8.5rem] rounded-cp border-cp bg-cp-bg px-2 py-1.5 font-mono text-[12px]"
              />
            </label>
          </div>
        )}
        {setlistError && (
          <p role="alert" className="m-0 text-cp-danger">
            {setlistError}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {!setlist && <p className="m-0 p-2 text-cp-muted">{t("setlist.intro")}</p>}
        {setlist && setlist.items.length === 0 && <p className="m-0 p-2 text-cp-muted">{t("setlist.empty")}</p>}
        {setlist?.items.map((item, index) => {
          const onAir = state?.setlist_id === setlist.id && state.item_id === item.id;
          const selected = selection?.kind === "item" && selection.itemId === item.id;
          return (
            <div
              key={item.id}
              className={`group flex items-stretch rounded-cp ${selected ? "bg-cp-surface-hi" : "hover:bg-cp-surface"}`}
              style={onAir ? { boxShadow: "inset 0 0 0 var(--cp-highlight-width) var(--cp-live)" } : undefined}
            >
              <button
                type="button"
                onClick={() => select({ kind: "item", setlistId: setlist.id, itemId: item.id })}
                aria-current={onAir ? "true" : undefined}
                className="grid min-w-0 flex-1 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 text-left"
              >
                <span className="font-mono text-[11px] text-cp-muted">{index + 1}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`truncate ${item.kind === "song" && item.missing ? "text-cp-danger" : ""}`}>{itemLabel(item)}</span>
                  {item.notes && (
                    <span className="shrink-0 rounded-cp-sm border-cp px-1 text-[10px] text-cp-muted" title={item.notes}>
                      {t("notes.badge")}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-cp-muted">
                  {onAir ? (
                    <span className="font-bold text-cp-live">{t("slides.live")}</span>
                  ) : item.kind === "song" ? (
                    (item.key ?? "")
                  ) : item.kind === "scripture" ? (
                    t("setlist.scripture")
                  ) : (
                    t("setlist.notice")
                  )}
                </span>
              </button>
              <div className="flex items-center gap-0.5 pr-1 opacity-60 group-hover:opacity-100 focus-within:opacity-100">
                {item.kind === "announcement" && (
                  <button
                    type="button"
                    onClick={() => setDraft({ id: item.id, title: item.title, text: item.text, backgroundId: item.background_id })}
                    aria-label={t("setlist.editItem", { title: itemLabel(item) })}
                    className="rounded-cp-sm px-1.5 py-1 text-cp-muted hover:text-cp-text"
                  >
                    ✎
                  </button>
                )}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => void saveSetlist((items) => move(items, index, index - 1))}
                  aria-label={t("setlist.moveUp", { title: itemLabel(item) })}
                  className="rounded-cp-sm px-1.5 py-1 text-cp-muted hover:text-cp-text disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === setlist.items.length - 1}
                  onClick={() => void saveSetlist((items) => move(items, index, index + 1))}
                  aria-label={t("setlist.moveDown", { title: itemLabel(item) })}
                  className="rounded-cp-sm px-1.5 py-1 text-cp-muted hover:text-cp-text disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => void saveSetlist((items) => items.filter((_, i) => i !== index))}
                  aria-label={t("setlist.remove", { title: itemLabel(item) })}
                  className="rounded-cp-sm px-1.5 py-1 text-cp-muted hover:text-cp-danger"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveDraft();
            }}
            className="mt-2 flex flex-col gap-2 rounded-cp border-cp bg-cp-bg p-2.5"
          >
            <label className="flex flex-col gap-1">
              <span className="cp-label">{t("setlist.announcementTitle")}</span>
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="rounded-cp border-cp bg-cp-panel px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="cp-label">{t("setlist.announcementText")}</span>
              <textarea
                rows={4}
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                placeholder={t("setlist.announcementHint")}
                className="resize-y rounded-cp border-cp bg-cp-panel px-2 py-1.5"
              />
            </label>
            <div className="flex flex-col gap-1">
              <label htmlFor="announcement-background" className="cp-label">
                {t("background.label")}
              </label>
              <BackgroundPicker
                id="announcement-background"
                value={draft.backgroundId}
                onChange={(id) => setDraft({ ...draft, backgroundId: id })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="cp-btn px-3 py-1.5">
                {t("editor.close")}
              </button>
              <button type="submit" disabled={!draft.title.trim()} className="cp-btn-live px-3 py-1.5">
                {draft.id ? t("editor.save") : t("setlist.add")}
              </button>
            </div>
          </form>
        )}
      </div>

      {setlist && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-cp p-2">
          <button type="button" onClick={() => setDraft({ id: null, title: "", text: "", backgroundId: null })} className="cp-btn px-2.5 py-1.5">
            {t("setlist.addAnnouncement")}
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => void deleteSetlist()} className="cp-btn-danger px-2.5 py-1.5">
                {t("setlist.delete")}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="cp-btn px-2.5 py-1.5">
                {t("editor.keep")}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="px-2 text-cp-muted hover:text-cp-danger">
              {t("setlist.delete")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
