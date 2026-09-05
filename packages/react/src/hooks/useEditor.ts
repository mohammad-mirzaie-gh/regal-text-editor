import { useState } from "react";
import { Editor, type EditorConfig } from "@regal-text-editor/core";

/**
 * Creates and owns an `Editor` instance for the lifetime of the component.
 * `useState`'s lazy initializer guarantees exactly one instance per
 * component instance (React 18 StrictMode may construct-and-discard one
 * extra instance during its development-only double-render check, which is
 * harmless — the discarded instance is never used or mounted).
 *
 * This hook deliberately does **not** destroy the editor in an effect
 * cleanup. `Editor.destroy()` only runs plugin `onDestroy` hooks and clears
 * internal listener maps — there is no external resource (socket, timer,
 * subscription) to leak — and `useState`'s initializer runs at most once
 * per component instance, so a cleanup-on-unmount would run during React
 * 18 StrictMode's development-only mount→cleanup→remount cycle and
 * destroy the *only* editor instance the component will ever have,
 * permanently breaking it (every `dispatch()` after `destroy()` is a
 * silent no-op) even though the component itself keeps rendering normally.
 * If a consumer embeds many short-lived editors in one long-lived page and
 * needs deterministic plugin cleanup timing, call `editor.destroy()`
 * explicitly (e.g. from the surrounding feature's own teardown), or use
 * `<RichTextEditor>`'s `editor` prop with a manually-managed instance.
 */
export function useEditor(config: EditorConfig): Editor {
  const [editor] = useState(() => new Editor(config));
  return editor;
}
