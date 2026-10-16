import { useEffect, useRef, useState } from "react";
import { sectionKind } from "../domain/sections";
import { songOrder, withArrangement } from "../domain/played";
import type { Song } from "../generated/Song";
import { t } from "../i18n";
import { api } from "../lib/api";

const sectionColor = (name: string) => `var(--cp-section-${sectionKind(name)})`;

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (from === to || to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

// A song's order for one setlist: each play of a section is its own chip
// (Chorus, Chorus, Chorus) to drag into place or remove; any section can be
// added again. The library song keeps its own order.
export function ArrangementEditor({
  songId,
  order,
  onChange,
}: {
  songId: string;
  /** This setlist's order (section ids), or null for the song's own. */
  order: string[] | null;
  onChange: (order: string[] | null) => void;
}) {
  const [song, setSong] = useState<Song | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  // Also kept outside React state, so a drop right after the start of a drag
  // still knows what is being dragged.
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getSong(songId)
      .then((s) => live && setSong(s))
      .catch(() => live && setSong(null));
    return () => {
      live = false;
    };
  }, [songId]);

  if (!song) return null;
  const name = new Map(song.sections.map((s) => [s.id, s.name]));
  const current = songOrder(withArrangement(song, order));
  const own = songOrder(song);
  const isOwn = !order || current.join() === own.join();
  const set = (next: string[]) => onChange(next.length === 0 || next.join() === own.join() ? null : next);

  return (
    <div className="flex flex-col gap-2 border-b-cp bg-cp-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="cp-label">{t("arrangement.title")}</span>
        <span className="text-[12px] text-cp-muted">{t("arrangement.hint")}</span>
      </div>
      <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={t("arrangement.order")}>
        {current.map((id, i) => (
          <li
            key={`${i}-${id}`}
            draggable
            onDragStart={(e) => {
              dragFrom.current = i;
              setDragging(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragFrom.current === null) return;
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom.current !== null) set(move(current, dragFrom.current, i));
              dragFrom.current = null;
              setDragging(null);
              setOver(null);
            }}
            onDragEnd={() => {
              dragFrom.current = null;
              setDragging(null);
              setOver(null);
            }}
            className={`flex cursor-grab items-center rounded-cp-sm text-[12px] font-semibold text-white ${dragging === i ? "opacity-40" : ""}`}
            style={{
              background: sectionColor(name.get(id) ?? ""),
              boxShadow: over === i && dragging !== i ? "0 0 0 2px var(--cp-text)" : undefined,
            }}
          >
            <button
              type="button"
              // Alt + arrows move the focused section, for the keyboard.
              onKeyDown={(e) => {
                if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                e.preventDefault();
                set(move(current, i, e.key === "ArrowLeft" ? i - 1 : i + 1));
              }}
              aria-label={t("arrangement.item", { position: i + 1, name: name.get(id) ?? "" })}
              title={t("arrangement.moveHelp")}
              className="py-1 pr-1 pl-2"
            >
              {name.get(id)}
            </button>
            <button
              type="button"
              onClick={() => set(current.filter((_, j) => j !== i))}
              aria-label={t("arrangement.remove", { position: i + 1, name: name.get(id) ?? "" })}
              className="rounded-r-cp-sm px-1.5 py-1 hover:bg-black/30"
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-cp-muted">{t("arrangement.add")}</span>
        {song.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => set([...current, section.id])}
            className="rounded-cp-sm border-cp px-2 py-0.5 text-[12px] text-cp-text hover:bg-cp-hover"
          >
            + {section.name}
          </button>
        ))}
        {!isOwn && (
          <button type="button" onClick={() => onChange(null)} className="ml-auto text-[12px] text-cp-muted underline hover:text-cp-text">
            {t("arrangement.reset")}
          </button>
        )}
      </div>
    </div>
  );
}
