import { FONT_FAMILY, useLook } from "./look";

// The copyright line along the bottom of the stage (canvas pixels, so it
// sits in the same place on every screen). With the words in the lower
// third, it moves to the top so the two never overlap.
export function CreditsFooter({ lines }: { lines: string[] }) {
  const look = useLook();
  return (
    <div
      className={`absolute inset-x-0 flex flex-col items-center px-24 text-center font-semibold ${look.position === "bottom" ? "top-9" : "bottom-9"}`}
      style={{
        fontSize: 24,
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
