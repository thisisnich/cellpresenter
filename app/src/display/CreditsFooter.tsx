import { footerSpot } from "../domain/lyricLayout";
import { FONT_FAMILY, useLook } from "./look";

// The copyright line, at the look's spot on the stage: a preset (along the
// top or bottom, left, centred or right) or wherever it was dragged. Canvas
// pixels, so it sits in the same place on every screen.
export function CreditsFooter({ lines }: { lines: string[] }) {
  const look = useLook();
  const spot = footerSpot(look);
  const items = { left: "items-start", center: "items-center", right: "items-end" }[spot.align];
  return (
    <div
      className={`absolute flex flex-col font-semibold ${items} ${spot.centred ? "w-full px-24" : "max-w-[55%]"}`}
      style={{
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        // The line's box meets the point in the same proportion, so it never
        // hangs off the stage.
        transform: `translate(-${spot.x}%, -${spot.y}%)`,
        textAlign: spot.align,
        fontSize: spot.centred ? 24 : 20,
        lineHeight: 1.35,
        fontFamily: FONT_FAMILY[look.font],
        color: look.color,
        opacity: 0.8,
        textShadow: "0 2px 12px rgb(0 0 0 / 0.7)",
      }}
    >
      {lines.map((line) => (
        <p key={line} className="m-0 max-w-full truncate">
          {line}
        </p>
      ))}
    </div>
  );
}
