import { useEffect, useMemo, useState } from "react";
import { BOOK_NAMES, parseReference, referenceText } from "../../domain/scripture";
import { newId } from "../../domain/songEditing";
import type { BibleInfo } from "../../generated/BibleInfo";
import type { PassagePreview } from "../../generated/PassagePreview";
import type { ScriptureRef } from "../../generated/ScriptureRef";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import { BibleKeys } from "../BibleKeys";
import { useConsole } from "../ConsoleContext";

const TRANSLATION_KEY = "cellpresenter.bible.translation";
const savedTranslation = () => {
  try {
    return localStorage.getItem(TRANSLATION_KEY);
  } catch {
    return null;
  }
};

/** A passage, fetched again whenever it changes (a stale answer is dropped). */
function usePassage(translation: string | null, passage: ScriptureRef | null) {
  const [preview, setPreview] = useState<PassagePreview | null>(null);
  // Why there is no preview: "not_found", "no_key", "bad_key", "unavailable"…
  const [problem, setProblem] = useState<string | null>(null);
  const wanted = translation && passage ? JSON.stringify([translation, passage]) : null;
  useEffect(() => {
    if (!wanted || !translation || !passage) {
      setPreview(null);
      setProblem(null);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      api
        .biblePassage(translation, passage)
        .then((p) => live && (setPreview(p), setProblem(null)))
        .catch(
          (err) =>
            live && (setPreview(null), setProblem(err instanceof ApiError ? (err.status === 404 ? "not_found" : err.code) : "unavailable")),
        );
    }, 150);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // `wanted` stands for both.
  }, [wanted]);
  return { preview, problem };
}

// Scripture, ProPresenter style: type a reference ("Jn 3:16-18") or pick a
// book, chapter and verses; the passage is split into slides. Show it now,
// or add it to the setlist.
export function ScripturePanel() {
  const { setlist, saveSetlist } = useConsole();
  const [info, setInfo] = useState<BibleInfo | null>(null);
  const [translation, setTranslation] = useState<string | null>(savedTranslation());
  const [query, setQuery] = useState("");
  // The verse clicked first, so a second click (or shift-click) makes a range.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [infoVersion, setInfoVersion] = useState(0);

  useEffect(() => {
    api
      .bibleInfo()
      .then((i) => {
        setInfo(i);
        setTranslation((tr) => (tr && i.translations.some((x) => x.id === tr) ? tr : (i.translations[0]?.id ?? null)));
      })
      .catch(() => setMessage({ ok: false, text: t("scripture.loadFailed") }));
  }, [infoVersion]);
  useEffect(() => {
    try {
      if (translation) localStorage.setItem(TRANSLATION_KEY, translation);
    } catch {
      // Not remembered; fine.
    }
  }, [translation]);

  const parsed = useMemo(() => (query.trim() ? parseReference(query) : null), [query]);
  const passage = parsed?.ok ? parsed.passage : null;
  // The chapter being browsed: where the passage starts.
  const book = passage?.book ?? null;
  const chapter = passage?.ranges[0]?.from.chapter ?? null;
  const chapterRef = useMemo<ScriptureRef | null>(
    () =>
      book && chapter ? { book, ranges: [{ from: { chapter, verse: 1 }, to: { chapter, verse: 0 } }] } : null,
    [book, chapter],
  );
  const { preview: selection, problem } = usePassage(translation, passage);
  const { preview: whole } = usePassage(translation, chapterRef);
  const chosen = new Set((selection?.passage.verses ?? []).map((v) => `${v.chapter}:${v.verse}`));
  const chapters = book ? (info?.books[book - 1]?.verses.length ?? 0) : 0;

  const pickVerse = (verse: number, extend: boolean) => {
    if (!book || !chapter) return;
    const from = extend && anchor !== null ? anchor : verse;
    setQuery(referenceText(book, chapter, from, verse));
    setAnchor(extend && anchor !== null ? anchor : verse);
  };

  const run = async (job: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await job() });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError && err.code === "pin_required" ? t("scripture.needPin") : t("scripture.failed") });
    } finally {
      setBusy(false);
    }
  };
  const show = () =>
    passage && translation && run(async () => (await api.showScripture(translation, passage), t("scripture.shown", { label: selection?.passage.label ?? "" })));
  const add = () =>
    passage &&
    translation &&
    selection &&
    run(async () => {
      await saveSetlist((items) => [
        ...items,
        { kind: "scripture", id: newId(), translation, passage, title: selection.passage.label },
      ]);
      return t("scripture.added", { label: selection.passage.label, setlist: setlist?.name ?? "" });
    });

  return (
    <div className="flex h-full flex-col bg-cp-panel font-ui text-[13px] text-cp-text">
      <form
        className="flex flex-col gap-2 border-b-cp p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void show();
        }}
      >
        <div className="flex gap-2">
          <label htmlFor="scripture-ref" className="sr-only">
            {t("scripture.reference")}
          </label>
          <input
            id="scripture-ref"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAnchor(null);
            }}
            placeholder={t("scripture.placeholder")}
            className="min-w-0 flex-1 rounded-cp border-cp bg-cp-bg px-2.5 py-1.5 text-cp-text placeholder:text-cp-muted"
          />
          <label htmlFor="scripture-translation" className="sr-only">
            {t("scripture.translation")}
          </label>
          <select
            id="scripture-translation"
            value={translation ?? ""}
            onChange={(e) => setTranslation(e.target.value)}
            className="rounded-cp border-cp bg-cp-bg px-2 py-1.5 text-cp-text"
          >
            {info?.translations.map((tr) => (
              <option key={tr.id} value={tr.id} title={tr.name}>
                {tr.short}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowKeys((v) => !v)}
            aria-expanded={showKeys}
            title={t("scripture.moreTranslations")}
            className={`rounded-cp border-cp px-2 ${showKeys ? "bg-cp-surface-hi" : "text-cp-muted hover:text-cp-text"}`}
          >
            {t("scripture.more")}
          </button>
        </div>
        <p className={`m-0 min-h-4 text-[12px] ${parsed && !parsed.ok ? "text-cp-danger" : "text-cp-muted"}`}>
          {parsed && !parsed.ok
            ? t(parsed.reason === "book" ? "scripture.unknownBook" : "scripture.badNumbers")
            : problem
              ? t(
                  problem === "not_found"
                    ? "scripture.notFound"
                    : problem === "no_key" || problem === "bad_key"
                      ? "scripture.keyProblem"
                      : problem === "pin_required"
                        ? "scripture.needPin"
                        : "scripture.offline",
                )
              : selection
                ? t("scripture.summary", {
                    label: selection.passage.label,
                    translation: selection.passage.translation,
                    count: selection.slides.length,
                  })
                : t("scripture.hint")}
        </p>
      </form>

      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        {showKeys && (
          <section className="border-b-cp p-3" aria-label={t("scripture.moreTranslations")}>
            <BibleKeys onChange={() => setInfoVersion((v) => v + 1)} />
          </section>
        )}
        {!book && (
          <div className="flex flex-col gap-2 p-3">
            {[
              [t("scripture.oldTestament"), 0, 39],
              [t("scripture.newTestament"), 39, 66],
            ].map(([label, from, to]) => (
              <section key={label as string} className="flex flex-col gap-1">
                <h3 className="cp-label m-0">{label}</h3>
                <div className="flex flex-wrap gap-1">
                  {BOOK_NAMES.slice(from as number, to as number).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setQuery(`${name} 1`)}
                      className="rounded-cp-sm border-cp px-1.5 py-0.5 text-[12px] text-cp-muted hover:bg-cp-surface hover:text-cp-text"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {book && chapter && chapters > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b-cp px-3 py-2">
            <span className="truncate text-cp-muted">{BOOK_NAMES[book - 1]}</span>
            <button
              type="button"
              disabled={chapter <= 1}
              onClick={() => (setQuery(referenceText(book, chapter - 1)), setAnchor(null))}
              aria-label={t("scripture.previousChapter")}
              className="rounded-cp-sm px-1.5 text-cp-muted hover:text-cp-text disabled:opacity-30"
            >
              ‹
            </button>
            <label htmlFor="scripture-chapter" className="sr-only">
              {t("scripture.chapters")}
            </label>
            <select
              id="scripture-chapter"
              value={chapter}
              onChange={(e) => (setQuery(referenceText(book, Number(e.target.value))), setAnchor(null))}
              className="rounded-cp border-cp bg-cp-bg px-1.5 py-0.5 text-cp-text"
            >
              {Array.from({ length: chapters }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>
                  {t("scripture.chapter", { chapter: c })}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={chapter >= chapters}
              onClick={() => (setQuery(referenceText(book, chapter + 1)), setAnchor(null))}
              aria-label={t("scripture.nextChapter")}
              className="rounded-cp-sm px-1.5 text-cp-muted hover:text-cp-text disabled:opacity-30"
            >
              ›
            </button>
            <button type="button" onClick={() => setQuery("")} className="ml-auto whitespace-nowrap text-[12px] text-cp-muted underline hover:text-cp-text">
              {t("scripture.allBooks")}
            </button>
          </div>
        )}

        {whole && (
          <ol className="m-0 flex list-none flex-col p-1">
            {whole.passage.verses.map((v) => (
              <li key={v.verse}>
                <button
                  type="button"
                  // Click picks a verse; Shift-click picks through to another.
                  onClick={(e) => pickVerse(v.verse, e.shiftKey)}
                  aria-pressed={chosen.has(`${v.chapter}:${v.verse}`)}
                  className={`w-full rounded-cp px-2 py-1 text-left ${chosen.has(`${v.chapter}:${v.verse}`) ? "bg-cp-surface-hi" : "hover:bg-cp-surface"}`}
                >
                  <sup className="mr-1 font-semibold text-cp-muted">{v.verse}</sup>
                  {v.text}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t-cp bg-cp-chrome p-2.5">
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`m-0 text-[12px] ${message.ok ? "text-cp-muted" : "text-cp-danger"}`}>
            {message.text}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-cp-muted">{t("scripture.pickHint")}</span>
          <div className="flex gap-2">
            {setlist && (
              <button type="button" disabled={!selection || busy} onClick={() => void add()} className="cp-btn px-3 py-1.5">
                {t("scripture.add")}
              </button>
            )}
            <button type="button" disabled={!selection || busy} onClick={() => void show()} className="cp-btn-live px-4 py-1.5">
              {t("scripture.show")}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
