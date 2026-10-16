// The copyright line under a song's lyrics, as CCLI asks for: title and
// writers, the copyright owner, the song's CCLI number and the church's
// licence number. Pure functions, no I/O.

import type { Credits } from "../generated/Credits";
import type { Look } from "../generated/Look";

/** The footer's lines for this slide, or null when it shouldn't show. */
export function footerLines(
  credits: Credits | null,
  look: Pick<Look, "footer" | "ccli_licence" | "title_slide">,
  slideIndex: number,
): string[] | null {
  if (!credits || look.footer === "off") return null;
  // Scripture: the reference and translation, on every slide.
  if (credits.translation) return [`${credits.title} · ${credits.translation}`];
  // "First slide" with a title slide: the title slide carries the credits.
  if (look.footer === "first" && (slideIndex > 0 || look.title_slide)) return null;
  const details = creditDetails(credits, look);
  // Without an owner or a CCLI number there is nothing to credit.
  if (!details) return null;
  const artist = credits.artist?.trim();
  return [artist ? `${credits.title} — ${artist}` : credits.title, details];
}

/** "© Owner · CCLI Song #1 · CCLI Licence #2", or null with neither. */
function creditDetails(credits: Credits, look: Pick<Look, "ccli_licence">): string | null {
  const copyright = credits.copyright?.trim();
  const songNumber = credits.ccli_number?.trim();
  if (!copyright && !songNumber) return null;
  return [
    copyright && (/^(©|\(c\)|copyright\b|public domain)/i.test(copyright) ? copyright : `© ${copyright}`),
    songNumber && `CCLI Song #${songNumber}`,
    songNumber && look.ccli_licence && `CCLI Licence #${look.ccli_licence}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export interface TitleCard {
  title: string;
  artist: string | null;
  /** The copyright and CCLI line, when the song has one. */
  details: string | null;
}

/** What a song's title slide shows, or null when the look has no title
 *  slides or what's on air isn't a song. */
export function titleCard(credits: Credits | null, look: Pick<Look, "title_slide" | "ccli_licence">): TitleCard | null {
  if (!look.title_slide || !credits || credits.translation) return null;
  return { title: credits.title, artist: credits.artist?.trim() || null, details: creditDetails(credits, look) };
}
