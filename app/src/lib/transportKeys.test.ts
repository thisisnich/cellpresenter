import { describe, expect, it } from "vitest";
import { commandForKey, type KeyLike } from "./transportKeys";

const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: null,
  ...extra,
});

describe("commandForKey", () => {
  it("maps keyboard and clicker keys", () => {
    expect(commandForKey(key(" "))).toEqual({ type: "next" });
    expect(commandForKey(key("PageDown"))).toEqual({ type: "next" });
    expect(commandForKey(key("PageUp"))).toEqual({ type: "prev" });
    expect(commandForKey(key("b"))).toEqual({ type: "toggle_visible" });
    expect(commandForKey(key("."))).toEqual({ type: "toggle_visible" });
    expect(commandForKey(key("Home"))).toEqual({ type: "go_to", index: 0 });
  });

  it("ignores shortcuts with modifiers and unknown keys", () => {
    expect(commandForKey(key("b", { ctrlKey: true }))).toBeNull();
    expect(commandForKey(key("ArrowRight", { metaKey: true }))).toBeNull();
    expect(commandForKey(key("x"))).toBeNull();
  });

  it("ignores keys typed into a text field", () => {
    const input = { closest: (sel: string) => (sel.includes("input") ? {} : null) } as unknown as EventTarget;
    expect(commandForKey(key(" ", { target: input }))).toBeNull();
  });
});
