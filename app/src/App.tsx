import { useMemo } from "react";
import ConsoleApp from "./console/ConsoleApp";
import DisplayApp from "./display/DisplayApp";
import ChordsApp from "./chords/ChordsApp";
import RemoteApp from "./remote/RemoteApp";
import { viewFromPath } from "./lib/routes";

// One SPA, several views chosen by path: the console at /, displays
// (projector, TVs, phones) at /display, the phone remote at /remote, the
// musicians' chord sheet at /chords. All are
// plain web clients of the same server.
export default function App() {
  const view = useMemo(() => viewFromPath(window.location.pathname), []);
  if (view === "display") return <DisplayApp />;
  if (view === "remote") return <RemoteApp />;
  if (view === "chords") return <ChordsApp />;
  return <ConsoleApp />;
}
