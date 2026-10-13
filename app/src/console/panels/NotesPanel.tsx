import { useEffect, useRef, useState } from "react";
import type { SetlistItem } from "../../generated/SetlistItem";
import { t } from "../../i18n";
import { useConsole } from "../ConsoleContext";
import { useLive } from "../LiveContext";

const label = (item: SetlistItem) =>
  item.kind === "announcement" ? item.title || t("setlist.announcement") : item.kind === "song" && item.missing ? t("setlist.missingSong") : item.title;

// Notes for the person running the service, one per setlist item ("key
// change after chorus 2", "Pastor prays here"). Shows the selected item's
// note (or the one on air) to edit, and the next item's to read ahead.
export function NotesPanel() {
  const { state } = useLive();
  const { setlist, selection, saveSetlist } = useConsole();
  const items = setlist?.items ?? [];
  const selected = selection?.kind === "item" && selection.setlistId === setlist?.id ? selection.itemId : null;
  const onAir = state?.setlist_id === setlist?.id ? state?.item_id : null;
  const targetId = selected ?? onAir ?? null;
  const at = items.findIndex((i) => i.id === targetId);
  const item = at >= 0 ? items[at] : null;
  const next = at >= 0 ? items[at + 1] : undefined;

  const [text, setText] = useState(item?.notes ?? "");
  const [saved, setSaved] = useState(true);
  const timer = useRef<number | undefined>(undefined);
  // What's being edited, so a save after switching items lands on the right one.
  const editing = useRef<string | null>(null);

  useEffect(() => {
    window.clearTimeout(timer.current);
    editing.current = item?.id ?? null;
    setText(item?.notes ?? "");
    setSaved(true);
  }, [item?.id, item?.notes]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const save = (id: string, notes: string) =>
    saveSetlist((list) => list.map((i) => (i.id === id ? { ...i, notes } : i))).then(() => setSaved(true));

  const change = (value: string) => {
    setText(value);
    setSaved(false);
    const id = editing.current;
    window.clearTimeout(timer.current);
    if (id) timer.current = window.setTimeout(() => void save(id, value), 700);
  };

  if (!setlist) return <Empty text={t("notes.noSetlist")} />;
  if (!item) return <Empty text={t("notes.pickItem")} />;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-cp-panel p-3.5 font-ui text-[13px] text-cp-text">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 truncate text-[14px] font-semibold">{label(item)}</h3>
        <span className={`shrink-0 text-[11px] font-bold ${item.id === onAir ? "text-cp-live" : "text-cp-muted"}`}>
          {item.id === onAir ? t("notes.onAir") : t("notes.selected")}
        </span>
      </div>
      <label className="flex min-h-32 flex-1 flex-col gap-1">
        <span className="sr-only">{t("notes.label", { title: label(item) })}</span>
        <textarea
          value={text}
          onChange={(e) => change(e.target.value)}
          onBlur={() => {
            const id = editing.current;
            if (!saved && id) {
              window.clearTimeout(timer.current);
              void save(id, text);
            }
          }}
          placeholder={t("notes.placeholder")}
          className="min-h-32 flex-1 resize-none rounded-cp border-cp bg-cp-bg p-3 leading-relaxed text-cp-text placeholder:text-cp-muted"
        />
      </label>
      <p className="m-0 text-[11px] text-cp-muted">{saved ? t("notes.saved") : t("notes.saving")}</p>
      {next && (
        <section className="flex flex-col gap-1 border-t-cp pt-3" aria-label={t("notes.next")}>
          <span className="cp-label text-cp-next">{t("notes.nextItem", { title: label(next) })}</span>
          <p className="m-0 whitespace-pre-wrap text-cp-muted">{next.notes || t("notes.none")}</p>
        </section>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-cp-panel p-6 font-ui text-[13px] text-cp-muted">
      <p className="m-0 max-w-[36ch] text-center">{text}</p>
    </div>
  );
}
