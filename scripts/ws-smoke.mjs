// Smoke test for the /ws live-state endpoint.
// Usage: node scripts/ws-smoke.mjs [url] [timeoutMs]
// Connects, prints the snapshot, then prints updates until the timeout.
// Requires Node >= 21 (global WebSocket).

const url = process.argv[2] ?? "ws://localhost:9100/ws";
const timeoutMs = Number(process.argv[3] ?? 10_000);

const ws = new WebSocket(url);
ws.addEventListener("open", () => console.log("[ws] open"));
ws.addEventListener("message", (e) => console.log("[ws]", e.data));
ws.addEventListener("close", () => {
  console.log("[ws] closed");
  process.exit(0);
});
ws.addEventListener("error", (e) => console.error("[ws] error:", e.message ?? e));

setTimeout(() => {
  console.log("[ws] done (timeout)");
  process.exit(0);
}, timeoutMs);
