import type { Editor } from "../editor";
import type { Command } from "./types";

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(name: string, command: Command): void {
    this.commands.set(name, command);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  names(): string[] {
    return [...this.commands.keys()];
  }

  execute(editor: Editor, name: string, ...args: unknown[]): boolean {
    const command = this.commands.get(name);
    if (!command) return false;
    if (command.canExecute && !command.canExecute(editor, ...args)) return false;
    return command.execute(editor, ...args);
  }

  canExecute(editor: Editor, name: string, ...args: unknown[]): boolean {
    const command = this.commands.get(name);
    if (!command) return false;
    return command.canExecute ? command.canExecute(editor, ...args) : true;
  }

  isActive(editor: Editor, name: string, ...args: unknown[]): boolean | "mixed" {
    const command = this.commands.get(name);
    if (!command?.isActive) return false;
    return command.isActive(editor, ...args);
  }
}
