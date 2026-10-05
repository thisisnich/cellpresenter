import type { IDockviewPanelProps } from "dockview-react";
import { t, type MessageKey } from "../../i18n";

// Stand-in for panels whose feature hasn't been built yet. Keeps their place
// in the default layout so the workspace already has its final shape.
export function PlaceholderPanel({ params }: IDockviewPanelProps<{ message: MessageKey }>) {
  return (
    <div className="flex h-full items-center justify-center bg-cp-panel p-6 font-ui text-[13px] text-cp-muted">
      <p className="m-0 max-w-[32ch] text-center">{t(params.message)}</p>
    </div>
  );
}
