import { describe, expect, it } from "vitest";
import { isNewer } from "./liveVersion";
import type { LiveState } from "./ws";

const state = (session: string, version: number): LiveState => ({
  session,
  version,
  song_id: null,
  title: "",
  slides: [],
  slide_index: 0,
  visible: true,
  text_scale: 1,
});

describe("isNewer", () => {
  it("accepts the first state", () => {
    expect(isNewer(null, state("a", 0))).toBe(true);
  });

  it("drops older versions from the same session", () => {
    expect(isNewer(state("a", 5), state("a", 4))).toBe(false);
    expect(isNewer(state("a", 5), state("a", 5))).toBe(true);
    expect(isNewer(state("a", 5), state("a", 6))).toBe(true);
  });

  it("accepts anything from a restarted server", () => {
    expect(isNewer(state("a", 50), state("b", 1))).toBe(true);
  });
});
