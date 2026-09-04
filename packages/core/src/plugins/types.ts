import type { Editor } from "../editor";
import type { MarkSpec, NodeSpec } from "../schema/types";
import type { Command } from "../commands/types";
import type { NodeSerializers, MarkSerializers } from "../serialization/registry";
import type { HtmlParserRegistry } from "../parsing/html";

export interface PluginSchemaExtension {
  nodes?: NodeSpec[];
  marks?: MarkSpec[];
}

/**
 * The unit of extensibility: every non-core feature (a mark, a block type,
 * a whole list system) registers itself as a plugin rather than being
 * wired into the engine directly. See section 71 of the design brief.
 */
export interface Plugin {
  name: string;
  schema?: PluginSchemaExtension;
  commands?: (editor: Editor) => Record<string, Command>;
  /** Keyboard shortcut string (e.g. "Mod-b", "Shift-Enter") -> command name. */
  keymap?: (editor: Editor) => Record<string, string>;
  htmlSerializers?: NodeSerializers;
  markHtmlSerializers?: MarkSerializers;
  markdownSerializers?: NodeSerializers;
  markMarkdownSerializers?: MarkSerializers;
  /** Registers HTML block/mark parsers used when importing pasted or source-mode HTML. */
  htmlParsers?: (registry: HtmlParserRegistry) => void;
  onInit?: (editor: Editor) => void;
  onDestroy?: (editor: Editor) => void;
}
