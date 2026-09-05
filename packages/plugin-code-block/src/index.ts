import {
  createElement,
  createText,
  defineNode,
  findTextBlockPath,
  getNodeAtPath,
  normalizeSelection,
  setBlockType,
  type Command,
  type Editor,
  type Plugin
} from "@regal-text-editor/core";

const NODE_TYPE = "codeBlock";

const toggleCodeBlockCommand: Command = {
  execute(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
    const node = getNodeAtPath(editor.doc, blockPath);
    const isCode = node.object === "element" && node.type === NODE_TYPE;
    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    setBlockType(tx, blockPath, isCode ? editor.schema.defaultBlockType : NODE_TYPE, {});
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
    return node.object === "element" && node.type === NODE_TYPE;
  }
};

/** Reads text out of a parsed `<pre>`/`<code>` element verbatim — unlike the
 * generic inline HTML parser, this never collapses whitespace (code
 * indentation depends on it) and converts `<br>` elements to a literal "\n"
 * character (mirroring how this plugin's own HTML export represents a line
 * break, and how several other web apps format a copied code block) while
 * literal newline characters already present in a text node pass through
 * untouched. */
function extractPreformattedText(el: Element): string {
  let text = "";
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      text += child.textContent ?? "";
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const childEl = child as Element;
      text += childEl.tagName.toLowerCase() === "br" ? "\n" : extractPreformattedText(childEl);
    }
  }
  return text;
}

/** A preformatted code block: schema (with `code: true`, so Enter inserts a
 * line break instead of splitting the block — see the `code` flag on
 * `NodeSpec` and its handling in `@regal-text-editor/browser`'s `EditorView`), a
 * `toggleCodeBlock` command, and HTML/Markdown import/export. No syntax
 * highlighting — `language` is recorded as an attribute for a future
 * highlighter to key off, but nothing in this plugin renders one. */
export function CodeBlockPlugin(): Plugin {
  return {
    name: "code-block",
    schema: {
      nodes: [
        defineNode({
          name: NODE_TYPE,
          group: "block",
          content: "inline*",
          marks: false,
          isTextBlock: true,
          code: true,
          attrs: { language: { default: null } }
        })
      ]
    },
    commands: () => ({ toggleCodeBlock: toggleCodeBlockCommand }),
    keymap: () => ({ "Mod-Alt-c": "toggleCodeBlock" }),
    htmlSerializers: {
      [NODE_TYPE]: (_node, children) => `<pre><code>${children.join("") || "<br>"}</code></pre>`
    },
    markdownSerializers: {
      [NODE_TYPE]: (_node, children) => "```\n" + children.join("") + "\n```"
    },
    htmlParsers: (registry) => {
      registry.registerBlock("pre", (el) => {
        const text = extractPreformattedText(el);
        return createElement(NODE_TYPE, {}, [createText(text)]);
      });
    }
  };
}
