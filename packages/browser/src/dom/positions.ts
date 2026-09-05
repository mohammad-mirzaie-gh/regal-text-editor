import { getNodeAtPath, isEqualPath, textNodes, type Editor, type Point } from "@regal-text-editor/core";

/** All DOM Text nodes under `root`, in document order. Because the
 * container is rendered straight from `editor.getHTML()`, this list is in
 * 1:1 positional correspondence with the *non-empty* text leaves of
 * `editor.doc` (`nonEmptyModelLeaves` below) — mark wrapper elements
 * (`<strong>`, `<em>`, ...) add nesting but never add or remove text
 * leaves, and an empty leaf (`text: ""`) produces no DOM text node at all,
 * which is exactly why empty leaves are excluded from that correspondence
 * rather than counted against it. */
export function collectDomTextNodes(root: Node): Text[] {
  const result: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    result.push(node as Text);
    node = walker.nextNode();
  }
  return result;
}

function nonEmptyModelLeaves(editor: Editor): { path: number[]; length: number }[] {
  return [...textNodes(editor.doc)]
    .filter((entry) => entry.node.text.length > 0)
    .map((entry) => ({ path: entry.path, length: entry.node.text.length }));
}

/** Every rendered node type in this codebase produces exactly one DOM
 * element per model element — no extra wrapper elements — for anything
 * that isn't inline mark content (paragraph/heading/blockquote/list/list
 * item/hr all render as a single tag). That means a block-level path can
 * be resolved to its DOM element by simply walking element-children by
 * index, without needing per-node `data-path` bookkeeping. This must never
 * be used to descend *into* a text block's own inline content (marks break
 * the 1:1 correspondence there) — only down to the block element itself. */
function findBlockElement(container: Element, blockPath: number[]): Element | null {
  let current: Element = container;
  for (const index of blockPath) {
    const child = current.children[index];
    if (!child) return null;
    current = child;
  }
  return current;
}

function domElementToBlockPath(container: Element, element: Element): number[] | null {
  const path: number[] = [];
  let current: Element = element;
  while (current !== container) {
    const parent = current.parentElement;
    if (!parent) return null;
    const index = Array.from(parent.children).indexOf(current);
    if (index === -1) return null;
    path.unshift(index);
    current = parent;
  }
  return path;
}

export function modelPointToDom(editor: Editor, container: HTMLElement, point: Point): { node: Node; offset: number } | null {
  const leaves = nonEmptyModelLeaves(editor);
  const index = leaves.findIndex((entry) => isEqualPath(entry.path, point.path));
  if (index !== -1) {
    const domNode = collectDomTextNodes(container)[index];
    if (domNode) {
      return { node: domNode, offset: Math.max(0, Math.min(point.offset, domNode.data.length)) };
    }
  }
  // The point addresses an empty leaf (or something didn't line up): an
  // empty leaf renders with no DOM text node, so anchor to its containing
  // block element instead — a valid, standard Selection endpoint.
  const blockPath = point.path.slice(0, -1);
  const blockElement = findBlockElement(container, blockPath);
  if (!blockElement) return null;
  return { node: blockElement, offset: 0 };
}

/** Browsers sometimes report a selection endpoint as an element + child
 * index (e.g. clicking right at the edge of a block, or into an empty
 * one) instead of a text node + character offset. This drills down to the
 * nearest actual text position, falling back to the containing element
 * itself when there is no text node to find (an empty block).
 *
 * The `<br>` a text block renders in place of empty content (see
 * plugin-basic-blocks' htmlSerializers) is a purely visual filler with no
 * model correspondence at all — unlike a real element, it must never be
 * treated as (or descended into as) an addressable node. A real browser's
 * hit-testing can report the caret as landing directly on/inside that
 * `<br>` (jsdom does not reproduce this, which is why this needed a real
 * browser to surface), so every place this function would otherwise
 * recurse into a child element checks for `<br>` first and resolves to
 * *its parent* instead — the same block element `domElementToBlockPath`
 * below expects to receive. */
function resolveToTextPosition(node: Node, offset: number): { node: Text; offset: number } | { node: Element; offset: 0 } | null {
  if (node.nodeType === Node.TEXT_NODE) return { node: node as Text, offset };
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  if (node.nodeName === "BR") {
    const parent = (node as Element).parentElement;
    return parent ? { node: parent, offset: 0 } : null;
  }

  const children = node.childNodes;
  if (children.length === 0) return { node: node as Element, offset: 0 };

  if (offset >= children.length) {
    const last = children[children.length - 1] as ChildNode;
    if (last.nodeType === Node.TEXT_NODE) return { node: last as Text, offset: (last as Text).data.length };
    if (last.nodeName === "BR") return { node: node as Element, offset: 0 };
    return resolveToTextPosition(last, (last as Element).childNodes.length) ?? { node: node as Element, offset: 0 };
  }
  const child = children[offset] as ChildNode;
  if (child.nodeType === Node.TEXT_NODE) return { node: child as Text, offset: 0 };
  if (child.nodeName === "BR") return { node: node as Element, offset: 0 };
  return resolveToTextPosition(child, 0) ?? { node: node as Element, offset: 0 };
}

export function domPointToModel(editor: Editor, container: HTMLElement, node: Node, offset: number): Point | null {
  const resolved = resolveToTextPosition(node, offset);
  if (!resolved) return null;

  if (resolved.node.nodeType === Node.TEXT_NODE) {
    const domTextNodes = collectDomTextNodes(container);
    const index = domTextNodes.indexOf(resolved.node as Text);
    if (index === -1) return null;
    const entry = nonEmptyModelLeaves(editor)[index];
    if (!entry) return null;
    return { path: entry.path, offset: Math.max(0, Math.min(resolved.offset, entry.length)) };
  }

  // Landed on an element with no text inside (an empty block): map the DOM
  // element back to its model block path and target that block's sole
  // (empty) leaf, which normalization guarantees exists at index 0.
  const blockPath = domElementToBlockPath(container, resolved.node as Element);
  if (!blockPath) return null;
  const leafPath = [...blockPath, 0];
  try {
    getNodeAtPath(editor.doc, leafPath);
  } catch {
    return null;
  }
  return { path: leafPath, offset: 0 };
}
