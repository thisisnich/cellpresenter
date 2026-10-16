import type { ThemeColors } from "../theme/tokens";
import { MARK_ICON, MARK_PATHS, type MarkRole } from "./markPaths";

// The app icon in the chosen palette: the browser tab's icon on every
// device, and (from the console on this computer) the app's own window and
// Dock icon.

export function appIconSvg(c: ThemeColors): string {
  const fill: Record<MarkRole, string> = { ink: c.iconInk, corner: c.markCorner, play: c.markPlay };
  const paths = MARK_PATHS.map((p) => `<path d="${p.d}" fill="${fill[p.role]}"${p.transform ? ` transform="${p.transform}"` : ""}/>`).join("");
  const { off, tile, rx, transform } = MARK_ICON;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">` +
    `<rect x="${off}" y="${off}" width="${tile}" height="${tile}" rx="${rx}" fill="${c.iconTile}"/>` +
    `<g transform="${transform}">${paths}</g></svg>`
  );
}

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function setFavicon(c: ThemeColors): void {
  let link = document.querySelector<HTMLLinkElement>("link[rel=icon]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  link.href = svgUrl(appIconSvg(c));
}

/** The icon as a PNG, for the desktop app's window and Dock. */
export function appIconPng(c: ThemeColors, size = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d")?.drawImage(img, 0, 0, size, size);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no png"))), "image/png");
    };
    img.onerror = () => reject(new Error("icon didn't render"));
    img.src = svgUrl(appIconSvg(c));
  });
}
