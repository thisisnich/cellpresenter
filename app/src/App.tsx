import { useEffect, useState } from "react";
import { api } from "./lib/api";

type Health = "checking…" | "ok" | "unreachable";

export default function App() {
  const [health, setHealth] = useState<Health>("checking…");

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then(() => !cancelled && setHealth("ok"))
      .catch(() => !cancelled && setHealth("unreachable"));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">CellPresenter</h1>
        <p className="mt-2 text-sm text-slate-400">M0 skeleton · dev loop</p>
        <p className="mt-8 text-sm">
          embedded server:{" "}
          <span
            className={
              health === "ok"
                ? "font-medium text-emerald-400"
                : health === "unreachable"
                  ? "font-medium text-rose-400"
                  : "text-slate-400"
            }
          >
            {health}
          </span>
        </p>
      </div>
    </div>
  );
}
