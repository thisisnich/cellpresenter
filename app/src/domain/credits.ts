// The copyright line under a song's lyrics, as CCLI asks for: title and
// writers, the copyright owner, the song's CCLI number and the church's
// licence number. Pure functions, no I/O.

import type { Credits } from "../generated/Credits";
import type { Look } from "../generated/Look";

/** The footer's lines for this slide, or null when it shouldn't show. */
export function footerLines(credits: Credits | null, look: Pick<Look, "footer" | "ccli_licence">, slideIndex: number): string[] | null {
  if (!credits || look.footer === "off") return null;
  if (look.footer === "first" && slideIndex > 0) return null;
  const copyright = credits.copyright?.trim();
  const songNumber = credits.ccli_number?.trim();
  // Without an owner or a CCLI number there is nothing to credit.
  if (!copyright && !songNumber) return null;
  const artist = credits.artist?.trim();
  const second = [
    copyright && (/^(©|\(c\)|copyright\b|public domain)/i.test(copyright) ? copyright : `© ${copyright}`),
    songNumber && `CCLI Song #${songNumber}`,
    songNumber && look.ccli_licence && `CCLI Licence #${look.ccli_licence}`,
  ].filter(Boolean);
  return [artist ? `${credits.title} — ${artist}` : credits.title, second.join(" · ")];
}
