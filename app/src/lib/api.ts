// The ONLY module that talks to the server (see layering rule in the spec).
// Relative URLs everywhere: in dev the Vite proxy forwards /api, /ws, /media,
// /native to the embedded axum server; in prod axum serves this SPA itself,
// so same-origin holds in both worlds.

export interface Health {
  status: string;
  version: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
};
