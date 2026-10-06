import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { announcementSlides, playedSlides } from "../domain/played";
import type { Media } from "../generated/Media";
import type { Setlist } from "../generated/Setlist";
import type { SetlistInput } from "../generated/SetlistInput";
import type { SetlistItem } from "../generated/SetlistItem";
import type { SetlistItemInput } from "../generated/SetlistItemInput";
import type { SetlistSummary } from "../generated/SetlistSummary";
import type { Slide } from "../generated/Slide";
import type { Song } from "../generated/Song";
import { t } from "../i18n";
import { api } from "../lib/api";
import { onLibraryChanged } from "../lib/libraryEvents";

/** What the Slides panel previews. `null` means "follow what's on air". */
export type Selection = { kind: "song"; songId: string } | { kind: "item"; setlistId: string; itemId: string };

export interface Content {
  title: string;
  slides: Slide[];
}

interface ConsoleValue {
  selection: Selection | null;
  select: (selection: Selection | null) => void;

  setlists: SetlistSummary[];
  setlist: Setlist | null;
  openSetlist: (id: string | null) => void;
  createSetlist: () => Promise<void>;
  saveSetlist: (change: (items: SetlistItemInput[]) => SetlistItemInput[], meta?: Partial<SetlistInput>) => Promise<void>;
  deleteSetlist: () => Promise<void>;
  setlistError: string | null;

  /** The slides a song or setlist item shows (cached). */
  contentOf: (selection: Selection) => Promise<Content | null>;
  /** Bumps when songs change, so content is reloaded. */
  libraryVersion: number;

  /** Background images in the library, newest first. */
  media: Media[];
  reloadMedia: () => Promise<void>;
  /** Image URL for a media id, if it still exists. */
  mediaUrl: (id: string | null | undefined) => string | null;
  defaultBackgroundId: string | null;
  setDefaultBackground: (id: string | null) => Promise<void>;
}

const ConsoleContext = createContext<ConsoleValue | null>(null);
const OPEN_SETLIST_KEY = "cellpresenter.setlist";

/** A setlist item as the server takes it back (ids kept). */
export function itemInput(item: SetlistItem): SetlistItemInput {
  return item.kind === "song"
    ? { kind: "song", id: item.id, song_id: item.song_id }
    : { kind: "announcement", id: item.id, title: item.title, text: item.text, background_id: item.background_id };
}

function defaultSetlistName(date: Date): string {
  return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
}

function isoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// Console-only state: which setlist is open and what is being previewed.
// (Live state lives on the server; see LiveContext.)
export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [setlists, setSetlists] = useState<SetlistSummary[]>([]);
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(OPEN_SETLIST_KEY);
    } catch {
      return null;
    }
  });
  const [setlistError, setSetlistError] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const songs = useRef(new Map<string, Promise<Song | null>>());
  const [media, setMedia] = useState<Media[]>([]);
  const [defaultBackgroundId, setDefaultBackgroundId] = useState<string | null>(null);

  const reloadMedia = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([api.listMedia(), api.settings()]);
      setMedia(list);
      setDefaultBackgroundId(settings.default_background_id);
    } catch {
      // Keep what we have; the Media panel shows its own errors.
    }
  }, []);
  useEffect(() => {
    void reloadMedia();
  }, [reloadMedia]);

  const mediaUrl = useCallback(
    (id: string | null | undefined) => (id ? (media.find((m) => m.id === id)?.url ?? null) : null),
    [media],
  );
  const setDefaultBackground = useCallback(async (id: string | null) => {
    const settings = await api.updateSettings({ default_background_id: id });
    setDefaultBackgroundId(settings.default_background_id);
  }, []);

  const refreshSetlists = useCallback(async () => {
    try {
      setSetlists(await api.listSetlists());
    } catch {
      setSetlistError(t("setlist.loadFailed"));
    }
  }, []);

  useEffect(() => {
    void refreshSetlists();
    return onLibraryChanged(() => {
      songs.current.clear();
      setLibraryVersion((v) => v + 1);
      void refreshSetlists();
    });
  }, [refreshSetlists]);

  // Load the open setlist (and reload it when songs change, for titles).
  useEffect(() => {
    try {
      if (openId) localStorage.setItem(OPEN_SETLIST_KEY, openId);
      else localStorage.removeItem(OPEN_SETLIST_KEY);
    } catch {
      // Not remembered across restarts; fine.
    }
    if (!openId) {
      setSetlist(null);
      return;
    }
    let cancelled = false;
    api
      .getSetlist(openId)
      .then((s) => !cancelled && setSetlist(s))
      .catch(() => {
        if (!cancelled) {
          setSetlist(null);
          setOpenId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [openId, libraryVersion]);

  const song = useCallback((id: string) => {
    let cached = songs.current.get(id);
    if (!cached) {
      cached = api.getSong(id).catch(() => null);
      songs.current.set(id, cached);
    }
    return cached;
  }, []);

  const contentOf = useCallback(
    async (sel: Selection): Promise<Content | null> => {
      if (sel.kind === "song") {
        const s = await song(sel.songId);
        return s && { title: s.title, slides: playedSlides(s, mediaUrl(s.background_id)) };
      }
      const list = setlist?.id === sel.setlistId ? setlist : await api.getSetlist(sel.setlistId).catch(() => null);
      const item = list?.items.find((i) => i.id === sel.itemId);
      if (!item) return null;
      if (item.kind === "announcement")
        return { title: item.title, slides: announcementSlides(item.title, item.text, mediaUrl(item.background_id)) };
      const s = await song(item.song_id);
      return s && { title: s.title, slides: playedSlides(s, mediaUrl(s.background_id)) };
    },
    [setlist, song, mediaUrl],
  );

  const saveSetlist = useCallback<ConsoleValue["saveSetlist"]>(
    async (change, meta) => {
      if (!setlist) return;
      const input: SetlistInput = {
        name: meta?.name ?? setlist.name,
        service_date: meta?.service_date !== undefined ? meta.service_date : setlist.service_date,
        items: change(setlist.items.map(itemInput)),
      };
      try {
        setSetlist(await api.updateSetlist(setlist.id, input));
        setSetlistError(null);
        void refreshSetlists();
      } catch {
        setSetlistError(t("setlist.saveFailed"));
      }
    },
    [setlist, refreshSetlists],
  );

  const createSetlist = useCallback(async () => {
    const today = new Date();
    try {
      const created = await api.createSetlist({ name: defaultSetlistName(today), service_date: isoDate(today), items: [] });
      setSetlist(created);
      setOpenId(created.id);
      void refreshSetlists();
    } catch {
      setSetlistError(t("setlist.saveFailed"));
    }
  }, [refreshSetlists]);

  const deleteSetlist = useCallback(async () => {
    if (!setlist) return;
    try {
      await api.deleteSetlist(setlist.id);
      setOpenId(null);
      setSelection(null);
      void refreshSetlists();
    } catch {
      setSetlistError(t("setlist.saveFailed"));
    }
  }, [setlist, refreshSetlists]);

  const value = useMemo<ConsoleValue>(
    () => ({
      selection,
      select: setSelection,
      setlists,
      setlist,
      openSetlist: setOpenId,
      createSetlist,
      saveSetlist,
      deleteSetlist,
      setlistError,
      contentOf,
      libraryVersion,
      media,
      reloadMedia,
      mediaUrl,
      defaultBackgroundId,
      setDefaultBackground,
    }),
    [
      selection,
      setlists,
      setlist,
      createSetlist,
      saveSetlist,
      deleteSetlist,
      setlistError,
      contentOf,
      libraryVersion,
      media,
      reloadMedia,
      mediaUrl,
      defaultBackgroundId,
      setDefaultBackground,
    ],
  );
  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole(): ConsoleValue {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error("useConsole must be used inside <ConsoleProvider>");
  return value;
}

/** Load the content of a selection; null while loading or if it's gone. */
export function useContent(selection: Selection | null): { content: Content | null; loading: boolean } {
  const { contentOf, libraryVersion, setlist } = useConsole();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const key = selection ? JSON.stringify(selection) : null;
  useEffect(() => {
    if (!selection) {
      setContent(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    contentOf(selection)
      .then((c) => !cancelled && setContent(c))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Reload when the selection, the songs or the open setlist change.
  }, [key, libraryVersion, setlist]);
  return { content, loading };
}
