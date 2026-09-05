import { useCallback, useSyncExternalStore } from "react";
import type { Editor } from "@regal-text-editor/core";

/**
 * Subscribes to the editor's coarse "something changed" signal and derives
 * a value from it via `selector`, re-rendering only when that derived value
 * actually changes (per `useSyncExternalStore`'s `Object.is` comparison).
 * This is the granular-subscription primitive every other React hook here
 * (and toolbar/UI components) builds on, instead of re-rendering the whole
 * tree on every keystroke — see section 123 of the design brief.
 */
export function useEditorSelector<T>(editor: Editor, selector: (editor: Editor) => T): T {
  const getSnapshot = useCallback(() => selector(editor), [editor, selector]);
  const subscribe = useCallback((onStoreChange: () => void) => editor.subscribe(onStoreChange), [editor]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
