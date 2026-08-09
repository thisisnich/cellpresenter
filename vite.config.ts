import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Embedded axum server port (must match src-tauri DEFAULT_PORT)
const API_PORT = 9100;

export default defineConfig({
  // SPA source lives in app/; tooling runs from repo root
  root: "app",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin dev: relative URLs in lib/api.ts reach axum through this proxy,
    // mirroring prod where axum serves the SPA itself.
    proxy: {
      "/api": { target: `http://localhost:${API_PORT}`, changeOrigin: true },
      "/ws": { target: `ws://localhost:${API_PORT}`, ws: true },
      "/media": { target: `http://localhost:${API_PORT}`, changeOrigin: true },
      "/native": { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
