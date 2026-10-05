import { useMemo } from "react";
import ConsoleApp from "./console/ConsoleApp";
import DisplayApp from "./display/DisplayApp";
import { viewFromPath } from "./lib/routes";

// One SPA, several views chosen by path. The console window loads /, the
// display (projector + phones) loads /display. All are plain web clients of
// the same server.
export default function App() {
  const view = useMemo(() => viewFromPath(window.location.pathname), []);
  return view === "display" ? <DisplayApp /> : <ConsoleApp />;
}
