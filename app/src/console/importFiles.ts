import { songFromFile, type ImportedSong } from "../domain/fileImport";
import { toSongInput } from "../domain/songEditing";
import { parseSongText } from "../domain/songText";
import { api } from "../lib/api";
import { notifyLibraryChanged } from "../lib/libraryEvents";

export interface ImportResult {
  /** One readable file: open it in the editor to check before saving. */
  single: ImportedSong | null;
  saved: number;
  /** Files that had no song in them or couldn't be saved. */
  failed: string[];
}

/**
 * Read song files. One file comes back to open in the editor; several are
 * saved straight to the library (like ProPresenter's import), split into
 * slides of two lines.
 */
export async function importSongFiles(files: File[]): Promise<ImportResult> {
  const read = await Promise.all(
    files.map(async (file) => ({ file, song: songFromFile(file.name, await file.text().catch(() => "")) })),
  );
  const failed = read.filter((r) => !r.song).map((r) => r.file.name);
  const songs = read.filter((r): r is { file: File; song: ImportedSong } => r.song !== null);
  if (files.length === 1) return { single: songs[0]?.song ?? null, saved: 0, failed };
  let saved = 0;
  for (const { file, song } of songs) {
    try {
      const parsed = parseSongText(song.text, { linesPerSlide: 2 });
      await api.createSong(
        toSongInput(parsed, {
          title: song.title,
          artist: song.artist,
          key: song.key,
          capo: song.capo,
          copyright: song.copyright ?? "",
          ccli: song.ccli ?? "",
          sectionBackgrounds: {},
        }),
      );
      saved++;
    } catch {
      failed.push(file.name);
    }
  }
  if (saved) notifyLibraryChanged();
  return { single: null, saved, failed };
}
