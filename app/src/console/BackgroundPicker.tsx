import { t } from "../i18n";
import { useConsole } from "./ConsoleContext";

// Choose a background image (or the default) for a song or announcement.
export function BackgroundPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string | null;
  onChange: (mediaId: string | null) => void;
}) {
  const { media } = useConsole();
  const chosen = media.find((m) => m.id === value);
  return (
    <div className="flex items-center gap-2">
      <div className="relative aspect-video w-14 shrink-0 overflow-hidden rounded-cp-sm border-cp bg-black">
        {chosen && <img src={chosen.thumb_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      </div>
      <select
        id={id}
        value={chosen ? chosen.id : ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 min-w-0 flex-1 rounded-cp border-cp bg-cp-bg px-2 text-cp-text"
      >
        <option value="">{t("background.default")}</option>
        {media.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
