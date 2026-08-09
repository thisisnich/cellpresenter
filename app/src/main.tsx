import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App";
import "./index.css";

async function boot() {
  // The stage relies on identical font metrics on every device — a fallback
  // font wraps text differently and would break cross-screen parity. Wait for
  // Inter (bundled, served from the same server) before the first render, so
  // the initial layout is measured with the real font everywhere.
  try {
    const loaded = document.fonts.load('700 90px "Inter Variable"');
    await Promise.race([
      loaded,
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    await document.fonts.ready;
  } catch {
    // Fonts API unavailable — render anyway rather than hanging.
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
