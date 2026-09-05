import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../commands/registry";
import type { Command } from "../commands/types";
import { Editor } from "../editor";
import { createBaseSchema } from "../schema/defaults";

function makeEditor(): Editor {
  return new Editor({ schema: createBaseSchema() });
}

describe("CommandRegistry", () => {
  it("has() and names() reflect registered commands", () => {
    const registry = new CommandRegistry();
    expect(registry.has("bold")).toBe(false);
    expect(registry.names()).toEqual([]);

    registry.register("bold", { execute: () => true });
    registry.register("italic", { execute: () => true });
    expect(registry.has("bold")).toBe(true);
    expect(registry.names().sort()).toEqual(["bold", "italic"]);
  });

  it("execute() returns false for an unregistered command name", () => {
    const registry = new CommandRegistry();
    expect(registry.execute(makeEditor(), "nope")).toBe(false);
  });

  it("execute() runs the command and returns its result when canExecute is absent", () => {
    const registry = new CommandRegistry();
    const run = vi.fn().mockReturnValue(true);
    registry.register("go", { execute: run });
    expect(registry.execute(makeEditor(), "go", "arg1")).toBe(true);
    expect(run).toHaveBeenCalledWith(expect.anything(), "arg1");
  });

  it("execute() short-circuits without running when canExecute returns false", () => {
    const registry = new CommandRegistry();
    const run = vi.fn();
    registry.register("go", { canExecute: () => false, execute: run });
    expect(registry.execute(makeEditor(), "go")).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("canExecute() returns false for an unregistered command name", () => {
    const registry = new CommandRegistry();
    expect(registry.canExecute(makeEditor(), "nope")).toBe(false);
  });

  it("canExecute() defaults to true when the command doesn't define one", () => {
    const registry = new CommandRegistry();
    registry.register("go", { execute: () => true });
    expect(registry.canExecute(makeEditor(), "go")).toBe(true);
  });

  it("canExecute() delegates to the command's own canExecute", () => {
    const registry = new CommandRegistry();
    registry.register("go", { canExecute: () => false, execute: () => true });
    expect(registry.canExecute(makeEditor(), "go")).toBe(false);
  });

  it("isActive() returns false for an unregistered command name", () => {
    const registry = new CommandRegistry();
    expect(registry.isActive(makeEditor(), "nope")).toBe(false);
  });

  it("isActive() returns false when the command doesn't define isActive", () => {
    const registry = new CommandRegistry();
    registry.register("go", { execute: () => true });
    expect(registry.isActive(makeEditor(), "go")).toBe(false);
  });

  it("isActive() delegates to the command's own isActive, including 'mixed'", () => {
    const registry = new CommandRegistry();
    const command: Command = { execute: () => true, isActive: () => "mixed" };
    registry.register("go", command);
    expect(registry.isActive(makeEditor(), "go")).toBe("mixed");
  });
});
