import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

// Embedded axum server port (must match src-tauri DEFAULT_PORT)
const API_PORT = 9100;

export default defineConfig({
  // SPA source lives in app/; tooling runs from repo root
  root: "app",
  plugins: [react(), tailwindcss()],
  // The About box shows it even when the app's server can't be reached.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
