// Client-side routes. Every view is served from the same SPA build; the
// server returns index.html for any path, so these work on a hard refresh.
export type View = "console" | "display";

export const ROUTES: Record<View, string> = {
  console: "/",
  display: "/display",
};

export function viewFromPath(pathname: string): View {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === ROUTES.display ? "display" : "console";
}
