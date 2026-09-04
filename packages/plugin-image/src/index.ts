import {
  createElement,
  createText,
  cursor,
  defineNode,
  escapeHtml,
  normalizeSelection,
  sanitizeUrl,
  type Command,
  type Editor,
  type Plugin
} from "@rte/core";

/** A block-level image, the same shape as `horizontalRule` in
 * `plugin-basic-blocks`: a void node sitting between text blocks, not an
 * inline atom inside one. The document model has no concept of an inline
 * void node (every inline child of a text block is assumed to be plain
 * text — see `@rte/browser`'s DOM<->model position mapping, which indexes
 * text leaves 1:1), so an image that could sit *inside* a line of text
 * would need a NodeSelection concept and void-aware caret navigation this
 * editor doesn't have yet. Block-level avoids that gap entirely while
 * still covering the common "insert an image" case; it's a deliberate,
 * documented simplification rather than a silent limitation. */
const insertImageCommand: Command = {
  execute(editor: Editor, ...args: unknown[]) {
    const rawSrc = args[0];
    if (typeof rawSrc !== "string" || rawSrc.length === 0) return false;
    const src = sanitizeUrl(rawSrc);
    if (src.length === 0) return false;
    const alt = typeof args[1] === "string" ? args[1] : "";

    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const topIndex = range.start.path[0] as number;
    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    tx.insertNode([topIndex + 1], createElement("image", { src, alt }, []));
    tx.insertNode([topIndex + 2], createElement(editor.schema.defaultBlockType, {}, [createText("")]));
    tx.setSelection(cursor({ path: [topIndex + 2, 0], offset: 0 }));
    editor.dispatch(tx);
    return true;
  },
  canExecute(editor: Editor) {
    return editor.getSelection() !== null;
  }
};

/** A block-level image node: schema, `insertImage(src, alt?)` command, and
 * HTML/Markdown import/export. No upload/file-picker support — `src` is
 * whatever URL the caller (a UI popover, typically) provides; hosting the
 * actual image data is out of scope for this plugin. */
export function ImagePlugin(): Plugin {
  return {
    name: "image",
    schema: {
      nodes: [
        defineNode({
          name: "image",
          group: "block",
          void: true,
          attrs: { src: { default: "" }, alt: { default: "" }, width: { default: null } }
        })
      ]
    },
    commands: () => ({
      insertImage: insertImageCommand
    }),
    htmlSerializers: {
      image: (node) => {
        const src = escapeHtml(sanitizeUrl(typeof node.attrs.src === "string" ? node.attrs.src : ""));
        const alt = escapeHtml(typeof node.attrs.alt === "string" ? node.attrs.alt : "");
        const width = typeof node.attrs.width === "number" ? ` width="${node.attrs.width}"` : "";
        return `<img src="${src}" alt="${alt}"${width}>`;
      }
    },
    markdownSerializers: {
      image: (node) => {
        const src = sanitizeUrl(typeof node.attrs.src === "string" ? node.attrs.src : "");
        const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
        return `![${alt}](${src})`;
      }
    },
    htmlParsers: (registry) => {
      registry.registerBlock("img", (el) => {
        const src = el.getAttribute("src");
        if (!src) return null;
        const width = el.hasAttribute("width") ? Number(el.getAttribute("width")) : null;
        return createElement("image", {
          src: sanitizeUrl(src),
          alt: el.getAttribute("alt") ?? "",
          width: width !== null && Number.isFinite(width) ? width : null
        }, []);
      });
    }
  };
}
