/** Rather than sprinkling `navigator.platform` checks through the codebase,
 * every platform-dependent decision (which physical key is the "primary"
 * modifier, how a shortcut string like "Mod-b" resolves) funnels through
 * this module. */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform ?? "";
  const userAgent = navigator.userAgent ?? "";
  return /Mac|iPod|iPhone|iPad/.test(platform || userAgent);
}

export function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Win/.test(navigator.platform ?? navigator.userAgent ?? "");
}

export function isLinux(): boolean {
  return !isMac() && !isWindows();
}

export function isPrimaryModifier(event: KeyboardEvent): boolean {
  return isMac() ? event.metaKey : event.ctrlKey;
}

function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * Builds every shortcut string an event could match against a plugin
 * keymap: a literal form (explicit Ctrl/Meta/Alt/Shift) and, when the
 * platform's primary modifier is held, a "Mod"-normalized form — so a
 * plugin can write `"Mod-b"` once and have it mean Cmd-B on macOS and
 * Ctrl-B everywhere else.
 */
export function shortcutCandidates(event: KeyboardEvent): string[] {
  const key = normalizeKey(event.key);
  const candidates = new Set<string>();

  const literalMods: string[] = [];
  if (event.ctrlKey) literalMods.push("Ctrl");
  if (event.metaKey) literalMods.push("Meta");
  if (event.altKey) literalMods.push("Alt");
  if (event.shiftKey) literalMods.push("Shift");
  candidates.add([...literalMods, key].join("-"));

  if (isPrimaryModifier(event)) {
    const modMods: string[] = ["Mod"];
    if (event.altKey) modMods.push("Alt");
    if (event.shiftKey) modMods.push("Shift");
    candidates.add([...modMods, key].join("-"));
  }

  return [...candidates];
}

/** Renders a shortcut string ("Mod-b") into a display label ("⌘B" / "Ctrl+B")
 * for tooltips and the keyboard-shortcuts help dialog. */
export function formatShortcutForDisplay(shortcut: string): string {
  const parts = shortcut.split("-");
  const key = parts[parts.length - 1] ?? "";
  const mods = parts.slice(0, -1);
  const mac = isMac();
  const symbols: Record<string, string> = mac
    ? { Mod: "⌘", Ctrl: "⌃", Meta: "⌘", Alt: "⌥", Shift: "⇧" }
    : { Mod: "Ctrl", Ctrl: "Ctrl", Meta: "Win", Alt: "Alt", Shift: "Shift" };
  const modLabels = mods.map((mod) => symbols[mod] ?? mod);
  const keyLabel = key.length === 1 ? key.toUpperCase() : key;
  return mac ? [...modLabels, keyLabel].join("") : [...modLabels, keyLabel].join("+");
}
