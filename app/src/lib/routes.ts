// Client-side routes. Every view is served from the same SPA build; the
// server returns index.html for any path, so these work on a hard refresh.
export type View = "console" | "display" | "remote";

export const ROUTES: Record<View, string> = {
  console: "/",
  display: "/display",
  remote: "/remote",
};

export function viewFromPath(pathname: string): View {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === ROUTES.display) return "display";
  if (path === ROUTES.remote) return "remote";
  return "console";
}
