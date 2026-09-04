import type { Command, Editor, Plugin } from "@rte/core";

const undoCommand: Command = {
  execute: (editor: Editor) => editor.undo(),
  canExecute: (editor: Editor) => editor.history.canUndo()
};

const redoCommand: Command = {
  execute: (editor: Editor) => editor.redo(),
  canExecute: (editor: Editor) => editor.history.canRedo()
};

/** Undo/redo commands, bound to Mod-Z, Mod-Shift-Z and (Windows/Linux
 * convention) Ctrl-Y. The actual history bookkeeping lives in the engine
 * (Editor.history) — this plugin only exposes it as commands + shortcuts. */
export function HistoryPlugin(): Plugin {
  return {
    name: "history",
    commands: () => ({ undo: undoCommand, redo: redoCommand }),
    keymap: () => ({
      "Mod-z": "undo",
      "Mod-Shift-z": "redo",
      "Mod-y": "redo"
    })
  };
}
