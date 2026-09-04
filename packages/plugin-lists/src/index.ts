import {
  createElement,
  cursor,
  defineNode,
  findTextBlockPath,
  getNodeAtPath,
  indentListItem,
  normalizeSelection,
  outdentListItem,
  resolveBlockRelativePoint,
  setBlockType,
  splitBlock,
  toBlockRelativePoint,
  unwrapBlocks,
  wrapBlocks,
  type Command,
  type Editor,
  type ElementNode,
  type Plugin,
  type Point
} from "@rte/core";

function findListItemPath(editor: Editor, path: number[]): number[] | undefined {
  for (let length = path.length; length >= 1; length -= 1) {
    const candidate = path.slice(0, length);
    const node = getNodeAtPath(editor.doc, candidate);
    if (node.object === "element" && node.type === "listItem") return candidate;
  }
  return undefined;
}

function isEmptyTextBlock(node: ElementNode): boolean {
  return node.children.length === 1 && node.children[0]?.object === "text" && node.children[0].text === "";
}

function toggleListCommand(listType: "bulletList" | "orderedList"): Command {
  return {
    execute(editor: Editor) {
      const selection = editor.getSelection();
      if (!selection) return false;
      const range = normalizeSelection(selection);
      const listItemPath = findListItemPath(editor, range.start.path);
      const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
      const relativePoint = toBlockRelativePoint(editor.doc, blockPath, range.start);
      const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });

      if (listItemPath) {
        const listPath = listItemPath.slice(0, -1);
        const listNode = getNodeAtPath(editor.doc, listPath);
        if (listNode.object === "element" && listNode.type === listType) {
          // Dissolve the whole list back to plain blocks, not just the
          // current item: unwrap every listItem first (last-to-first, so an
          // earlier item's index is never disturbed by unwrapping a later
          // one), which leaves the list holding its items' own content
          // directly; then unwrap the now-flat list itself.
          for (let i = listNode.children.length - 1; i >= 0; i -= 1) {
            unwrapBlocks(tx, [...listPath, i]);
          }
          unwrapBlocks(tx, listPath);
        } else {
          setBlockType(tx, listPath, listType, listNode.object === "element" ? listNode.attrs : {});
        }
      } else {
        const topIndex = blockPath[0] as number;
        const itemPath = wrapBlocks(tx, [], topIndex, topIndex, "listItem");
        wrapBlocks(tx, itemPath.slice(0, -1), itemPath[itemPath.length - 1] as number, itemPath[itemPath.length - 1] as number, listType);
      }

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
      const listItemPath = findListItemPath(editor, range.start.path);
      if (!listItemPath) return false;
      const listNode = getNodeAtPath(editor.doc, listItemPath.slice(0, -1));
      return listNode.object === "element" && listNode.type === listType;
    }
  };
}

const listEnterCommand: Command = {
  execute(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    if (!range.isCollapsed) return false;
    const listItemPath = findListItemPath(editor, range.start.path);
    if (!listItemPath) return false;

    const textBlockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
    const textBlockNode = getNodeAtPath(editor.doc, textBlockPath);
    if (textBlockNode.object !== "element") return false;

    const tx = editor.createTransaction({ origin: "keyboard", historyGroup: "structural" });
    const listPath = listItemPath.slice(0, -1);
    const listParentPath = listPath.slice(0, -1);
    const listIndex = listPath[listPath.length - 1] as number;

    if (isEmptyTextBlock(textBlockNode)) {
      setBlockType(tx, textBlockPath, editor.schema.defaultBlockType, {});
      const exitIndex = listIndex + 1;
      tx.moveNode(textBlockPath, [...listParentPath, exitIndex]);
      tx.removeNode(listItemPath);
      const cursorPoint: Point = { path: [...listParentPath, exitIndex, 0], offset: 0 };
      tx.setSelection(cursor(cursorPoint));
      editor.dispatch(tx);
      return true;
    }

    const split = splitBlock(tx, editor.schema, range.start);
    const itemIndex = listItemPath[listItemPath.length - 1] as number;
    const newItemPath = [...listItemPath.slice(0, -1), itemIndex + 1];
    tx.insertNode(newItemPath, createElement("listItem", {}, []));
    tx.moveNode(split.afterPath, [...newItemPath, 0]);
    tx.setSelection(cursor({ path: [...newItemPath, 0, 0], offset: 0 }));
    editor.dispatch(tx);
    return true;
  }
};

const listIndentCommand: Command = {
  execute(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const listItemPath = findListItemPath(editor, range.start.path);
    if (!listItemPath) return false;
    const listNode = getNodeAtPath(editor.doc, listItemPath.slice(0, -1));
    if (listNode.object !== "element") return false;
    const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
    const relativePoint = toBlockRelativePoint(editor.doc, blockPath, range.start);
    const tx = editor.createTransaction({ origin: "keyboard", historyGroup: "structural" });
    if (!indentListItem(tx, listItemPath, listNode.type)) return false;
    tx.setSelection(cursor(resolveBlockRelativePoint(tx.doc, relativePoint) ?? range.start));
    editor.dispatch(tx);
    return true;
  }
};

const listOutdentCommand: Command = {
  execute(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const listItemPath = findListItemPath(editor, range.start.path);
    if (!listItemPath) return false;
    const blockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
    const relativePoint = toBlockRelativePoint(editor.doc, blockPath, range.start);
    const tx = editor.createTransaction({ origin: "keyboard", historyGroup: "structural" });
    if (!outdentListItem(tx, listItemPath)) return false;
    tx.setSelection(cursor(resolveBlockRelativePoint(tx.doc, relativePoint) ?? range.start));
    editor.dispatch(tx);
    return true;
  }
};

const toggleTaskItemCommand: Command = {
  execute(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const listItemPath = findListItemPath(editor, range.start.path);
    if (!listItemPath) return false;
    const node = getNodeAtPath(editor.doc, listItemPath);
    if (node.object !== "element") return false;
    const current = node.attrs.checked;
    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    tx.setNodeAttribute(listItemPath, { checked: current === true ? false : true });
    tx.setSelection(selection);
    editor.dispatch(tx);
    return true;
  },
  isActive(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    const listItemPath = findListItemPath(editor, range.start.path);
    if (!listItemPath) return false;
    const node = getNodeAtPath(editor.doc, listItemPath);
    return node.object === "element" && node.attrs.checked === true;
  }
};

function renderListItemChecked(node: ElementNode): string {
  return node.attrs.checked === null || node.attrs.checked === undefined
    ? ""
    : ` data-checked="${node.attrs.checked ? "true" : "false"}"`;
}

function markdownListItemPrefix(content: string, marker: string): string {
  const indent = " ".repeat(marker.length);
  const lines = content.split("\n");
  return lines.map((line, i) => (i === 0 ? `${marker}${line}` : line.length > 0 ? `${indent}${line}` : "")).join("\n");
}

/** Bullet lists, ordered lists, nested lists, and a basic task-list variant
 * (a `checked` attribute on listItem). Registers Enter/Tab/Shift-Tab as
 * keymap entries so the browser adapter tries these before falling back to
 * its generic split/merge behavior. */
export function ListsPlugin(): Plugin {
  return {
    name: "lists",
    schema: {
      nodes: [
        defineNode({ name: "bulletList", group: "block", content: "listItem+" }),
        defineNode({ name: "orderedList", group: "block", content: "listItem+", attrs: { start: { default: 1 } } }),
        defineNode({ name: "listItem", group: "block", content: "block+", attrs: { checked: { default: null } } })
      ]
    },
    commands: () => ({
      toggleBulletList: toggleListCommand("bulletList"),
      toggleOrderedList: toggleListCommand("orderedList"),
      listEnter: listEnterCommand,
      listIndent: listIndentCommand,
      listOutdent: listOutdentCommand,
      toggleTaskListItem: toggleTaskItemCommand
    }),
    keymap: () => ({
      Enter: "listEnter",
      Tab: "listIndent",
      "Shift-Tab": "listOutdent"
    }),
    htmlSerializers: {
      bulletList: (_node, children) => `<ul>${children.join("")}</ul>`,
      orderedList: (node, children) => {
        const start = typeof node.attrs.start === "number" && node.attrs.start !== 1 ? ` start="${node.attrs.start}"` : "";
        return `<ol${start}>${children.join("")}</ol>`;
      },
      listItem: (node, children) => `<li${renderListItemChecked(node)}>${children.join("")}</li>`
    },
    markdownSerializers: {
      bulletList: (_node, children) => children.map((c) => markdownListItemPrefix(c, "- ")).join("\n"),
      orderedList: (_node, children) => children.map((c) => markdownListItemPrefix(c, "1. ")).join("\n"),
      listItem: (node, children) => {
        const body = children.join("\n\n");
        if (node.attrs.checked === true) return `[x] ${body}`;
        if (node.attrs.checked === false) return `[ ] ${body}`;
        return body;
      }
    },
    htmlParsers: (registry) => {
      registry.registerBlock("ul", (el, ctx) => createElement("bulletList", {}, ctx.parseBlocks(el)));
      registry.registerBlock("ol", (el, ctx) => {
        const start = el.hasAttribute("start") ? Number(el.getAttribute("start")) : 1;
        return createElement("orderedList", { start }, ctx.parseBlocks(el));
      });
      registry.registerBlock("li", (el, ctx) => {
        const blocks = ctx.parseBlocks(el);
        const children = blocks.length > 0 ? blocks : [createElement("paragraph", {}, ctx.parseInline(el))];
        return createElement("listItem", {}, children);
      });
    }
  };
}
