import { FONT_FAMILY, useLook } from "./look";

// The copyright line, centred along the bottom of the stage or small in the
// bottom-right corner (canvas pixels, so it sits in the same place on every
// screen). With the words in the lower third it moves to the top, so the
// two never overlap.
export function CreditsFooter({ lines }: { lines: string[] }) {
  const look = useLook();
  const corner = look.footer_place === "corner";
  const edge = look.position === "bottom" ? "top-9" : "bottom-9";
  return (
    <div
      className={`absolute flex flex-col font-semibold ${edge} ${corner ? "right-12 max-w-[55%] items-end text-right" : "inset-x-0 items-center px-24 text-center"}`}
      style={{
        fontSize: corner ? 20 : 24,
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
