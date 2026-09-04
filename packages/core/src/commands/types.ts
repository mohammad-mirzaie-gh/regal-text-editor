import type { Editor } from "../editor";

export interface Command {
  execute: (editor: Editor, ...args: unknown[]) => boolean;
  canExecute?: (editor: Editor, ...args: unknown[]) => boolean;
  isActive?: (editor: Editor, ...args: unknown[]) => boolean | "mixed";
}
