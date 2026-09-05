import { useCallback } from "react";
import type { Editor } from "@regal-text-editor/core";
import { useEditorSelector } from "./useEditorSelector";

export interface UseCommandResult {
  active: boolean | "mixed";
  enabled: boolean;
  execute: () => boolean;
}

/** Convenience hook for toolbar buttons/menu items: reads a command's
 * active/enabled state reactively and returns a stable `execute` callback. */
export function useCommand(editor: Editor, name: string, ...args: unknown[]): UseCommandResult {
  const active = useEditorSelector(editor, (e) => e.commands.isActive(e, name, ...args));
  const enabled = useEditorSelector(editor, (e) => e.commands.canExecute(e, name, ...args));
  const execute = useCallback(() => editor.commands.execute(editor, name, ...args), [editor, name, ...args]);
  return { active, enabled, execute };
}
