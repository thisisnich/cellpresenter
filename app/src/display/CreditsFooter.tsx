// The copyright line along the bottom of the stage (canvas pixels, so it
// sits in the same place on every screen).
export function CreditsFooter({ lines }: { lines: string[] }) {
  return (
    <div
      className="absolute inset-x-0 bottom-9 flex flex-col items-center px-24 text-center font-semibold text-white/80"
      style={{ fontSize: 24, lineHeight: 1.35, textShadow: "0 2px 12px rgb(0 0 0 / 0.7)" }}
    >
      {lines.map((line) => (
        <p key={line} className="m-0 max-w-full truncate">
          {line}
        </p>
      ))}
    </div>
  );
}
