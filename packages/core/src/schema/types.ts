import type { Attrs, AttrValue } from "../model/types";

export type NodeGroup = "block" | "inline";

export interface AttrSpec {
  default: AttrValue;
}

/** A simplified content-model grammar: a space separated sequence of
 * `<name><quantifier?>` tokens, where `<name>` is a node type or group name
 * (e.g. "block", "inline") and quantifier is one of `* + ?` (omitted = exactly one).
 * Matching is greedy/sequential rather than a full NFA — sufficient for the
 * block/inline shapes real editor schemas use, and documented as a
 * deliberate simplification versus a full regular content-expression engine. */
export type ContentExpression = string;

export interface NodeSpec {
  name: string;
  group: NodeGroup;
  /** Content expression describing allowed children; omitted for leaf/void nodes. */
  content?: ContentExpression;
  /** True for nodes that hold no editable children (image, horizontalRule, ...). */
  void?: boolean;
  /** True for block nodes whose content is inline/text directly (paragraph, heading, codeBlock)
   * as opposed to container blocks that only hold other blocks (blockquote, list, listItem).
   * Cursor/selection logic walks up to the nearest text block ancestor. */
  isTextBlock?: boolean;
  /** True for a text block whose content is verbatim/preformatted (a code
   * block): pressing Enter inside it inserts a literal line break within
   * the same block instead of splitting into a new one, mirroring
   * ProseMirror's `code` node property. Read generically by the browser
   * adapter, so a plugin needs nothing beyond this flag to get correct
   * Enter behavior — no keymap registration (and no risk of colliding with
   * another plugin's own "Enter" keymap entry, since only one command can
   * occupy that key at a time). */
  code?: boolean;
  /** Which marks are allowed on inline content directly inside this node.
   * "_" allows every registered mark, an array allows only those, `false` allows none. */
  marks?: "_" | string[] | false;
  attrs?: Record<string, AttrSpec>;
}

export interface MarkSpec {
  name: string;
  attrs?: Record<string, AttrSpec>;
  /** Mark types that cannot coexist with this one on the same text run. */
  excludes?: string[];
}

export interface ValidationError {
  path: number[];
  code:
    | "unknown-node-type"
    | "unknown-mark-type"
    | "invalid-child"
    | "invalid-mark"
    | "missing-required-attr"
    | "empty-document";
  message: string;
}

export function defineNode(spec: NodeSpec): NodeSpec {
  return spec;
}

export function defineMark(spec: MarkSpec): MarkSpec {
  return spec;
}

export function attrsWithDefaults(spec: NodeSpec | MarkSpec | undefined, provided: Attrs): Attrs {
  const result: Attrs = { ...provided };
  const attrSpecs = spec?.attrs ?? {};
  for (const key of Object.keys(attrSpecs)) {
    if (!(key in result)) {
      result[key] = attrSpecs[key]!.default;
    }
  }
  return result;
}
