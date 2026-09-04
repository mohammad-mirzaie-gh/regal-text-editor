import {
  createElement,
  createText,
  cursor,
  defineNode,
  findTextBlockPath,
  getNodeAtPath,
  normalizeSelection,
  resolveBlockRelativePoint,
  setBlockType,
  toBlockRelativePoint,
  unwrapBlocks,
  wrapBlocks,
  type Attrs,
  type Command,
  type Editor,
  type EditorDocument,
  type EditorNode,
  type ElementNode,
  type HtmlParseContext,
  type Plugin
} from "@rte/core";

/** A `<p>`/`<h*>` whose only content is a single `<br>` is the empty-block
 * marker this plugin's own HTML export produces (see `htmlSerializers`
 * below), not a soft line break — parsing it as inline content would
 * otherwise turn it into a literal "\n" character via the generic `<br>`
 * handling in core's HTML parser, corrupting a round-tripped empty block.
 * Normalization fills in the actual empty text leaf once this returns []. */
function parseTextBlockInline(el: Element, ctx: HtmlParseContext): EditorNode[] {
  const isSoleBr = el.childNodes.length === 1 && el.firstChild?.nodeType === 1 && (el.firstChild as Element).tagName === "BR";
  return isSoleBr ? [] : ctx.parseInline(el);
}

export interface BasicBlocksConfig {
  /** Heading levels to register commands/schema for. Defaults to 1-6. */
  headingLevels?: number[];
}

function setBlockTypeCommand(type: string, attrs: Attrs = {}): Command {
  return {
    execute(editor: Editor) {
      const selection = editor.getSelection();
      if (!selection) return false;
      const range = normalizeSelection(selection);
      const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
      const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
      setBlockType(tx, blockPath, type, attrs);
      tx.setSelection(selection);
      editor.dispatch(tx);
      return true;
    },
    canExecute(editor: Editor) {
      return editor.getSelection() !== null;
    },
    isActive(editor: Editor) {
      const selection = editor.getSelection();
      if (!selection) return false;
      const range = normalizeSelection(selection);
      const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
      const node = getNodeAtPath(editor.doc, blockPath);
      if (node.object !== "element" || node.type !== type) return false;
      return Object.entries(attrs).every(([key, value]) => node.attrs[key] === value);
    }
  };
}

/** Finds the nearest blockquote *ancestor* of `blockPath`, at any depth —
 * not just the immediate parent. A text block can sit inside a blockquote
 * through an arbitrary number of intermediate wrappers (e.g. a list inside
 * a blockquote: paragraph -> listItem -> bulletList -> blockquote), and
 * checking only `blockPath.slice(0, -1)` would miss the blockquote
 * entirely whenever such a wrapper is in between — making toggle-off never
 * detect it's already inside a quote and instead wrap another blockquote
 * around the outside on every click, nesting deeper without limit. */
function findBlockquotePath(doc: EditorDocument, blockPath: number[]): number[] | undefined {
  for (let length = blockPath.length - 1; length >= 1; length -= 1) {
    const candidate = blockPath.slice(0, length);
    const node = getNodeAtPath(doc, candidate);
    if (node.object === "element" && node.type === "blockquote") return candidate;
  }
  return undefined;
}

const toggleBlockquoteCommand: Command = {
  execute(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    const relativePoint = toBlockRelativePoint(editor.doc, blockPath, range.start);

    const blockquotePath = findBlockquotePath(editor.doc, blockPath);
    if (blockquotePath) {
      unwrapBlocks(tx, blockquotePath);
      tx.setSelection(cursor(resolveBlockRelativePoint(tx.doc, relativePoint) ?? range.start));
      editor.dispatch(tx);
      return true;
    }

    const topIndex = blockPath[0] as number;
    wrapBlocks(tx, [], topIndex, topIndex, "blockquote");
    tx.setSelection(cursor(resolveBlockRelativePoint(tx.doc, relativePoint) ?? range.start));
    editor.dispatch(tx);
    return true;
  },
  canExecute(editor: Editor) {
    return editor.getSelection() !== null;
  },
  isActive(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
    return findBlockquotePath(editor.doc, blockPath) !== undefined;
  }
};

/** Logical (writing-direction-relative) alignment values only — "left"/
 * "right" would silently flip meaning between LTR and RTL content, exactly
 * the kind of bug this codebase's CSS already avoids by using logical
 * properties throughout (see `packages/ui/src/styles.css`). */
const ALIGN_VALUES = new Set(["start", "center", "end", "justify"]);
const ALIGNABLE_TYPES = new Set(["paragraph", "heading"]);

function alignAttr(node: ElementNode): string {
  const align = node.attrs.align;
  if (typeof align !== "string" || align === "start" || !ALIGN_VALUES.has(align)) return "";
  return ` style="text-align:${align}"`;
}

/** Reads a pasted/imported element's inline `text-align`. Physical "left"/
 * "right" (the common case pasting from Word/Docs/Sheets) are mapped to
 * logical "start"/"end" under the assumption of LTR source content — a
 * documented simplification, since the true writing direction of pasted
 * HTML isn't reliably knowable from the fragment alone. */
function parseAlign(el: Element): string | undefined {
  const style = el.getAttribute("style") ?? "";
  const match = /text-align\s*:\s*([a-z]+)/i.exec(style);
  const raw = match?.[1]?.toLowerCase();
  if (raw === "left") return "start";
  if (raw === "right") return "end";
  return raw !== undefined && ALIGN_VALUES.has(raw) ? raw : undefined;
}

function setTextAlignCommand(): Command {
  return {
    execute(editor: Editor, ...args: unknown[]) {
      const align = args[0];
      if (typeof align !== "string" || !ALIGN_VALUES.has(align)) return false;
      const selection = editor.getSelection();
      if (!selection) return false;
      const range = normalizeSelection(selection);
      const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
      const node = getNodeAtPath(editor.doc, blockPath);
      if (node.object !== "element" || !ALIGNABLE_TYPES.has(node.type)) return false;
      const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
      tx.setNodeAttribute(blockPath, { align });
      tx.setSelection(selection);
      editor.dispatch(tx);
      return true;
    },
    canExecute(editor: Editor) {
      const selection = editor.getSelection();
      if (!selection) return false;
      const range = normalizeSelection(selection);
      const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
      const node = getNodeAtPath(editor.doc, blockPath);
      return node.object === "element" && ALIGNABLE_TYPES.has(node.type);
    },
    isActive(editor: Editor, ...args: unknown[]) {
      const align = typeof args[0] === "string" ? args[0] : "start";
      const selection = editor.getSelection();
      if (!selection) return false;
      const range = normalizeSelection(selection);
      const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
      const node = getNodeAtPath(editor.doc, blockPath);
      if (node.object !== "element") return false;
      const current = typeof node.attrs.align === "string" ? node.attrs.align : "start";
      return current === align;
    }
  };
}

const insertHorizontalRuleCommand: Command = {
  execute(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const topIndex = range.start.path[0] as number;
    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    tx.insertNode([topIndex + 1], createElement("horizontalRule", {}, []));
    tx.insertNode([topIndex + 2], createElement(editor.schema.defaultBlockType, {}, [createText("")]));
    tx.setSelection(cursor({ path: [topIndex + 2, 0], offset: 0 }));
    editor.dispatch(tx);
    return true;
  },
  canExecute(editor: Editor) {
    return editor.getSelection() !== null;
  }
};

/** Paragraph (already in the base schema), heading, blockquote and
 * horizontal rule block types, with the commands, HTML/Markdown
 * serializers and HTML import parsers needed to use them end to end. */
export function BasicBlocksPlugin(config: BasicBlocksConfig = {}): Plugin {
  const levels = config.headingLevels ?? [1, 2, 3, 4, 5, 6];

  return {
    name: "basic-blocks",
    schema: {
      nodes: [
        defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true, attrs: { align: { default: "start" } } }),
        defineNode({
          name: "heading",
          group: "block",
          content: "inline*",
          marks: "_",
          isTextBlock: true,
          attrs: { level: { default: 1 }, align: { default: "start" } }
        }),
        defineNode({ name: "blockquote", group: "block", content: "block+" }),
        defineNode({ name: "horizontalRule", group: "block", void: true })
      ]
    },
    commands: () => ({
      setParagraph: setBlockTypeCommand("paragraph"),
      ...Object.fromEntries(levels.map((level) => [`setHeading${level}`, setBlockTypeCommand("heading", { level })])),
      toggleBlockquote: toggleBlockquoteCommand,
      insertHorizontalRule: insertHorizontalRuleCommand,
      setTextAlign: setTextAlignCommand()
    }),
    keymap: () =>
      Object.fromEntries([
        ...levels.map((level) => [`Mod-Alt-${level}`, `setHeading${level}`]),
        ["Mod-Alt-0", "setParagraph"]
      ]),
    htmlSerializers: {
      // An empty text block renders `<br>` in place of its (empty) text
      // content, matching the standard contentEditable convention for an
      // empty line: it gives the line real height/click target, and — more
      // importantly for the browser adapter — a `<p></p>` with literally
      // zero children still has a valid element-based caret position, so
      // this is a visual/UX improvement layered on top of, not a
      // requirement for, correct selection mapping.
      paragraph: (node, children) => `<p${alignAttr(node)}>${children.join("") || "<br>"}</p>`,
      heading: (node, children) => {
        const level = typeof node.attrs.level === "number" ? node.attrs.level : 1;
        return `<h${level}${alignAttr(node)}>${children.join("") || "<br>"}</h${level}>`;
      },
      blockquote: (_node, children) => `<blockquote>${children.join("")}</blockquote>`,
      horizontalRule: () => "<hr>"
    },
    markdownSerializers: {
      paragraph: (_node, children) => children.join(""),
      heading: (node, children) => {
        const level = typeof node.attrs.level === "number" ? node.attrs.level : 1;
        return `${"#".repeat(level)} ${children.join("")}`;
      },
      blockquote: (_node, children) =>
        children
          .join("\n\n")
          .split("\n")
          .map((line) => (line.length > 0 ? `> ${line}` : ">"))
          .join("\n"),
      horizontalRule: () => "---"
    },
    htmlParsers: (registry) => {
      registry.registerBlock("p", (el, ctx) => {
        const align = parseAlign(el);
        return createElement("paragraph", align ? { align } : {}, parseTextBlockInline(el, ctx));
      });
      for (let level = 1; level <= 6; level += 1) {
        registry.registerBlock(`h${level}`, (el, ctx) => {
          const align = parseAlign(el);
          return createElement("heading", align ? { level, align } : { level }, parseTextBlockInline(el, ctx));
        });
      }
      registry.registerBlock("blockquote", (el, ctx) => createElement("blockquote", {}, ctx.parseBlocks(el)));
      registry.registerBlock("hr", () => createElement("horizontalRule", {}, []));
    }
  };
}
