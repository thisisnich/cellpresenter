import type { IDockviewPanelProps } from "dockview-react";
import { useEffect, useMemo, useState } from "react";
import { sectionKind } from "../../domain/sections";
import { sectionBackgroundsOf, songForText, toSongInput, type SongMeta } from "../../domain/songEditing";
import { arrangementRuns, joinWithNext, splitInTwo } from "../../domain/slideEdits";
import { parseSongText, songToText } from "../../domain/songText";
import type { Song } from "../../generated/Song";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import { notifyLibraryChanged } from "../../lib/libraryEvents";
import { useLive } from "../LiveContext";
import type { EditorParams } from "../openEditor";
import { BackgroundPicker } from "../BackgroundPicker";
import { useConsole } from "../ConsoleContext";
import { usePages } from "../pages";
import { SlidePreview } from "../SlidePreview";

const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B", "Am", "Bm", "Cm", "Dm", "Em", "Fm", "Gm"];
const sectionColor = (name: string) => `var(--cp-section-${sectionKind(name)})`;
const EMPTY_META: SongMeta = { title: "", artist: "", key: "", capo: 0, copyright: "", ccli: "", sectionBackgrounds: {} };

// Edit a song as text, with a live preview of the slides it makes.
export function EditorPanel({ params, api: panel }: IDockviewPanelProps<EditorParams>) {
  const { showSong } = useLive();
  const { setPage } = usePages();
  const { mediaUrl } = useConsole();
  const [songId, setSongId] = useState(params.songId);
  const [stored, setStored] = useState<Song | null>(null);
  const [loading, setLoading] = useState(Boolean(params.songId));
  // A draft (a song found online) starts out unsaved.
  const { draft } = params;
  const [meta, setMeta] = useState<SongMeta>(() =>
    draft
      ? {
          ...EMPTY_META,
          title: draft.title,
          artist: draft.artist,
          key: draft.key,
          capo: draft.capo,
          copyright: draft.copyright ?? "",
          ccli: draft.ccli ?? "",
        }
      : EMPTY_META,
  );
  const [text, setText] = useState(draft?.text ?? "");
  // How long stanzas become slides: every N lines, or 0 = as written (only
  // blank lines break). Saved songs open as written: the text then shows
  // exactly the slides they have.
  const [linesPerSlide, setLinesPerSlide] = useState(2);
  const [dirty, setDirty] = useState(Boolean(draft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);

  useEffect(() => {
    if (!params.songId) return;
    api
      .getSong(params.songId)
      .then((song) => {
        setStored(song);
        setMeta({
          title: song.title,
          artist: song.artist ?? "",
          key: song.key ?? "",
          capo: song.capo,
          copyright: song.copyright ?? "",
          ccli: song.ccli_number ?? "",
          sectionBackgrounds: sectionBackgroundsOf(song),
        });
        setText(songToText(songForText(song)));
        setLinesPerSlide(0);
      })
      .catch(() => setError(t("editor.loadFailed")))
      .finally(() => setLoading(false));
  }, [params.songId]);

  const parsed = useMemo(() => parseSongText(text, { linesPerSlide }), [text, linesPerSlide]);
  const played = useMemo(
    () =>
      parsed.arrangement.flatMap((name) => {
        const section = parsed.sections.find((s) => s.name === name);
        // A slide keeps its background cue by position, as on save.
        const old = stored?.sections.find((s) => s.name === name);
        return (section?.slides ?? []).map((lines, i) => ({
          section: name,
          index: i,
          lines: lines.length,
          last: i === (section?.slides.length ?? 0) - 1,
          text: lines.map((l) => l.text).join("\n"),
          background: mediaUrl(old?.slides[i]?.background_id ?? meta.sectionBackgrounds[name]),
        }));
      }),
    [parsed, stored, mediaUrl, meta.sectionBackgrounds],
  );

  // Join / Split from the preview: the breaks go into the text as blank
  // lines, and the song switches to "as written" so they stay put.
  const reshape = (next: string | null) => {
    if (next === null) return;
    setText(next);
    setLinesPerSlide(0);
    setDirty(true);
  };

  const edit = <K extends keyof SongMeta>(field: K, value: SongMeta[K]) => {
    setMeta((m) => ({ ...m, [field]: value }));
    setDirty(true);
  };
  const editText = (value: string) => {
    setText(value);
    setDirty(true);
    // A pasted ChordPro file can fill in the blanks.
    const p = parseSongText(value, { linesPerSlide });
    setMeta((m) => ({ ...m, title: m.title || p.title || "", key: m.key || p.key || "" }));
  };

  const save = async (andShow: boolean) => {
    if (!meta.title.trim()) {
      setError(t("editor.titleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = toSongInput(parsed, meta, stored ?? undefined);
      const song = songId ? await api.updateSong(songId, input) : await api.createSong(input);
      setStored(song);
      setSongId(song.id);
      panel.updateParameters({ songId: song.id, draft: undefined });
      panel.setTitle(t("editor.tabTitle", { title: song.title }));
      setDirty(false);
      notifyLibraryChanged();
      if (andShow) {
        await showSong(song.id);
        setPage("show");
      }
    } catch (err) {
      setError(err instanceof ApiError && err.code === "pin_required" ? t("editor.needPin") : t("editor.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!songId) return panel.close();
    try {
      await api.deleteSong(songId);
      notifyLibraryChanged();
      panel.close();
    } catch {
      setError(t("editor.deleteFailed"));
    }
  };

  const close = () => (dirty && confirm !== "discard" ? setConfirm("discard") : panel.close());

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-cp-panel font-ui text-cp-muted">{t("connection.connecting")}</div>;
  }

  return (
    <div className="flex h-full flex-col bg-cp-panel font-ui text-[13px] text-cp-text">
      {draft?.source && !songId && (
        <p className="m-0 border-b-cp bg-cp-surface px-3 py-2 text-cp-muted">
          {t("editor.fromOnline", { site: t(`search.source.${draft.source}`) })}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3 border-b-cp p-3">
        <label className="flex min-w-48 flex-[2] flex-col gap-1">
          <span className="cp-label">{t("editor.title")}</span>
          <input
            value={meta.title}
            onChange={(e) => edit("title", e.target.value)}
            placeholder={t("editor.titlePlaceholder")}
            className="h-9 rounded-cp border-cp bg-cp-bg px-2.5 text-[15px] font-semibold"
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="cp-label">{t("editor.artist")}</span>
          <input value={meta.artist} onChange={(e) => edit("artist", e.target.value)} className="h-9 rounded-cp border-cp bg-cp-bg px-2.5" />
        </label>
        <label className="flex w-24 flex-col gap-1">
          <span className="cp-label">{t("editor.key")}</span>
          <input list="song-keys" value={meta.key} onChange={(e) => edit("key", e.target.value)} className="h-9 rounded-cp border-cp bg-cp-bg px-2.5 font-mono" />
          <datalist id="song-keys">
            {KEYS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
        <label className="flex w-20 flex-col gap-1">
          <span className="cp-label">{t("editor.capo")}</span>
          <input
            type="number"
            min={0}
            max={11}
            value={meta.capo}
            onChange={(e) => edit("capo", Number(e.target.value) || 0)}
            className="h-9 rounded-cp border-cp bg-cp-bg px-2.5 font-mono"
          />
        </label>
        <label className="flex min-w-48 flex-[2] flex-col gap-1">
          <span className="cp-label">{t("editor.copyright")}</span>
          <input
            value={meta.copyright}
            onChange={(e) => edit("copyright", e.target.value)}
            placeholder={t("editor.copyrightPlaceholder")}
            className="h-9 rounded-cp border-cp bg-cp-bg px-2.5 placeholder:text-cp-muted"
          />
        </label>
        <label className="flex w-36 flex-col gap-1">
          <span className="cp-label">{t("editor.ccli")}</span>
          <input
            value={meta.ccli}
            inputMode="numeric"
            onChange={(e) => edit("ccli", e.target.value)}
            className="h-9 rounded-cp border-cp bg-cp-bg px-2.5 font-mono"
          />
        </label>
      </div>

      {parsed.sections.length > 0 && (
        <details className="border-b-cp px-4 py-2" open={Object.values(meta.sectionBackgrounds).some(Boolean) || undefined}>
          <summary className="cp-label cursor-pointer py-1">
            {t("editor.sectionBackgrounds")}
            {(() => {
              const set = parsed.sections.filter((s) => meta.sectionBackgrounds[s.name]).length;
              return set > 0 ? ` · ${t("editor.backgroundsSet", { count: set })}` : "";
            })()}
          </summary>
          <div className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-4 gap-y-2">
            {parsed.sections.map((section, i) => (
              <div key={section.name} className="flex items-center gap-2">
                <label
                  htmlFor={`section-bg-${i}`}
                  className="w-20 shrink-0 truncate rounded-cp-sm px-1.5 py-0.5 text-[11px] font-semibold text-white"
                  style={{ background: sectionColor(section.name) }}
                  title={section.name}
                >
                  {section.name}
                </label>
                <div className="min-w-0 flex-1">
                  <BackgroundPicker
                    id={`section-bg-${i}`}
                    value={meta.sectionBackgrounds[section.name] ?? null}
                    onChange={(id) => edit("sectionBackgrounds", { ...meta.sectionBackgrounds, [section.name]: id })}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="m-0 mt-2 text-[12px] text-cp-muted">{t("editor.sectionBackgroundsHint")}</p>
        </details>
      )}

      {/* A wrapping row sizes to its content, so cap each side at the row's
          height: wide, the preview scrolls; narrow, the whole row does. */}
      <div className="flex min-h-0 flex-1 flex-wrap overflow-y-auto">
        <label className="flex max-h-full min-h-64 min-w-0 flex-[1_1_380px] flex-col">
          <span className="sr-only">{t("editor.lyrics")}</span>
          <textarea
            value={text}
            onChange={(e) => editText(e.target.value)}
            spellCheck={false}
            placeholder={t("editor.placeholder")}
            className="h-full w-full flex-1 resize-none border-0 bg-cp-bg p-4 font-mono text-[13px] leading-relaxed text-cp-text outline-none placeholder:text-cp-muted"
          />
        </label>

        <section aria-label={t("editor.preview")} className="flex max-h-full min-w-0 flex-[1_1_320px] flex-col overflow-hidden border-l-cp">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-cp px-3 py-2">
            <span className="cp-label">{t("editor.previewCount", { count: played.length })}</span>
            <div className="flex flex-wrap gap-1">
              {arrangementRuns(parsed.arrangement).map((run, i) => (
                <span key={i} className="rounded-cp-sm px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: sectionColor(run.name) }}>
                  {run.name}
                  {run.times > 1 && ` ×${run.times}`}
                </span>
              ))}
            </div>
          </div>
          {/* Focusable so the keyboard can scroll it too. */}
          <div
            tabIndex={0}
            aria-label={t("editor.preview")}
            className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 overflow-y-auto p-3"
          >
            {played.length === 0 && <p className="m-0 col-span-full text-cp-muted">{t("editor.previewEmpty")}</p>}
            {played.map((slide, i) => (
              <div key={i} className="group overflow-hidden rounded-cp border-cp">
                <SlidePreview text={slide.text} background={slide.background} transparent />
                <div className="flex items-center justify-between gap-1 px-2 py-1 text-[11px] font-semibold text-white" style={{ background: sectionColor(slide.section) }}>
                  <span className="truncate">
                    {i + 1} · {slide.section}
                  </span>
                  <span className="flex shrink-0 gap-1 opacity-70 group-hover:opacity-100">
                    {slide.lines > 1 && (
                      <button
                        type="button"
                        onClick={() => reshape(splitInTwo(parsed, slide.section, slide.index))}
                        title={t("editor.splitHelp")}
                        className="rounded-cp-sm bg-black/25 px-1.5 hover:bg-black/45"
                      >
                        {t("editor.split")}
                      </button>
                    )}
                    {!slide.last && (
                      <button
                        type="button"
                        onClick={() => reshape(joinWithNext(parsed, slide.section, slide.index))}
                        title={t("editor.joinHelp")}
                        className="rounded-cp-sm bg-black/25 px-1.5 hover:bg-black/45"
                      >
                        {t("editor.join")}
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div role="group" aria-label={t("panel.actions")} className="flex flex-wrap items-center justify-between gap-3 border-t-cp bg-cp-chrome px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-cp-muted" title={t("editor.slidesHelp")}>
            {t("editor.slides")}
            <select
              value={linesPerSlide}
              onChange={(e) => setLinesPerSlide(Number(e.target.value))}
              className="rounded-cp border-cp bg-cp-surface px-2 py-1 text-cp-text"
            >
              <option value={0}>{t("editor.asWritten")}</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? t("editor.everyLine") : t("editor.everyLines", { count: n })}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="m-0 text-cp-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {confirm === "delete" ? (
            <>
              <span className="text-cp-danger">{t("editor.confirmDelete")}</span>
              <button type="button" onClick={remove} className="cp-btn-danger">
                {t("editor.delete")}
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="cp-btn">
                {t("editor.keep")}
              </button>
            </>
          ) : (
            songId && (
              <button type="button" onClick={() => setConfirm("delete")} className="cp-btn text-cp-danger">
                {t("editor.delete")}
              </button>
            )
          )}
          {confirm === "discard" && <span className="text-cp-muted">{t("editor.unsaved")}</span>}
          <button type="button" onClick={close} className="cp-btn">
            {confirm === "discard" ? t("editor.discard") : t("editor.close")}
          </button>
          <button type="button" disabled={saving} onClick={() => save(true)} className="cp-btn">
            {t("editor.saveAndShow")}
          </button>
          <button type="button" disabled={saving} onClick={() => save(false)} className="cp-btn-live">
            {saving ? t("editor.saving") : t("editor.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
