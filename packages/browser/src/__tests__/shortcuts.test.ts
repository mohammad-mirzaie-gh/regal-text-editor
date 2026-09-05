import { afterEach, describe, expect, it } from "vitest";
import { formatShortcutForDisplay, isLinux, isMac, isPrimaryModifier, isWindows, shortcutCandidates } from "../keyboard/shortcuts";

function stubPlatform(platform: string, userAgent = ""): void {
  Object.defineProperty(window.navigator, "platform", { value: platform, configurable: true });
  Object.defineProperty(window.navigator, "userAgent", { value: userAgent, configurable: true });
}

function keyEvent(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false
  });
}

describe("keyboard/shortcuts", () => {
  const originalPlatform = window.navigator.platform;
  const originalUserAgent = window.navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(window.navigator, "platform", { value: originalPlatform, configurable: true });
    Object.defineProperty(window.navigator, "userAgent", { value: originalUserAgent, configurable: true });
  });

  it("detects macOS from navigator.platform", () => {
    stubPlatform("MacIntel");
    expect(isMac()).toBe(true);
    expect(isWindows()).toBe(false);
    expect(isLinux()).toBe(false);
  });

  it("detects Windows from navigator.platform", () => {
    stubPlatform("Win32");
    expect(isMac()).toBe(false);
    expect(isWindows()).toBe(true);
    expect(isLinux()).toBe(false);
  });

  it("falls back to Linux when neither Mac nor Windows patterns match", () => {
    stubPlatform("Linux x86_64");
    expect(isMac()).toBe(false);
    expect(isWindows()).toBe(false);
    expect(isLinux()).toBe(true);
  });

  it("falls back to userAgent when platform is empty", () => {
    stubPlatform("", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(isMac()).toBe(true);
  });

  it("uses metaKey as the primary modifier on macOS and ctrlKey elsewhere", () => {
    stubPlatform("MacIntel");
    expect(isPrimaryModifier(keyEvent({ key: "b", metaKey: true }))).toBe(true);
    expect(isPrimaryModifier(keyEvent({ key: "b", ctrlKey: true }))).toBe(false);

    stubPlatform("Win32");
    expect(isPrimaryModifier(keyEvent({ key: "b", ctrlKey: true }))).toBe(true);
    expect(isPrimaryModifier(keyEvent({ key: "b", metaKey: true }))).toBe(false);
  });

  it("builds a literal-only candidate when no primary modifier is held", () => {
    stubPlatform("Win32");
    const candidates = shortcutCandidates(keyEvent({ key: "Escape" }));
    expect(candidates).toEqual(["Escape"]);
  });

  it("lower-cases single-character keys but leaves named keys as-is", () => {
    stubPlatform("Win32");
    expect(shortcutCandidates(keyEvent({ key: "B", ctrlKey: true }))).toContain("Ctrl-b");
    expect(shortcutCandidates(keyEvent({ key: "Enter" }))).toEqual(["Enter"]);
  });

  it("includes both the literal and Mod-normalized form when the primary modifier is held", () => {
    stubPlatform("MacIntel");
    const candidates = shortcutCandidates(keyEvent({ key: "b", metaKey: true }));
    expect(candidates).toContain("Meta-b");
    expect(candidates).toContain("Mod-b");
  });

  it("stacks Alt and Shift onto both the literal and Mod-normalized forms", () => {
    stubPlatform("MacIntel");
    const candidates = shortcutCandidates(keyEvent({ key: "z", metaKey: true, altKey: true, shiftKey: true }));
    expect(candidates).toContain("Meta-Alt-Shift-z");
    expect(candidates).toContain("Mod-Alt-Shift-z");
  });

  it("produces a single candidate set (no duplicates) when the literal and Mod forms coincide is impossible, but Ctrl-only on non-mac still yields two distinct strings", () => {
    stubPlatform("Win32");
    const candidates = shortcutCandidates(keyEvent({ key: "b", ctrlKey: true }));
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates).toEqual(["Ctrl-b", "Mod-b"]);
  });

  it("formats a shortcut with mac symbols", () => {
    stubPlatform("MacIntel");
    expect(formatShortcutForDisplay("Mod-b")).toBe("⌘B");
    expect(formatShortcutForDisplay("Mod-Shift-z")).toBe("⌘⇧Z");
  });

  it("formats a shortcut with non-mac labels", () => {
    stubPlatform("Win32");
    expect(formatShortcutForDisplay("Mod-b")).toBe("Ctrl+B");
    expect(formatShortcutForDisplay("Mod-Alt-Shift-z")).toBe("Ctrl+Alt+Shift+Z");
  });

  it("passes through an unrecognized modifier label as-is", () => {
    stubPlatform("Win32");
    expect(formatShortcutForDisplay("Weird-k")).toBe("Weird+K");
  });

  it("keeps multi-character key names as-is instead of upper-casing them", () => {
    stubPlatform("Win32");
    expect(formatShortcutForDisplay("Mod-Enter")).toBe("Ctrl+Enter");
  });
});
