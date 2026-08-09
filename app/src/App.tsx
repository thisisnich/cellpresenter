import { useMemo } from "react";
import ConsoleApp from "./console/ConsoleApp";
import DisplayApp from "./display/DisplayApp";

// One SPA, two views. The console window loads /, the display (projector +
// phones) loads ?view=display. Both are plain web clients of the same server.
export default function App() {
  const view = useMemo(
    () => new URLSearchParams(window.location.search).get("view"),
    [],
  );
  return view === "display" ? <DisplayApp /> : <ConsoleApp />;
}
