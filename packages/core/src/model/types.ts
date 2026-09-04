/**
 * The document model is the single source of truth for editor content.
 * The DOM is only ever a rendering target derived from this model (see the
 * browser adapter package) — it is never mutated directly and never read
 * back as authoritative state.
 */

export type NodeId = string;

export type AttrValue = string | number | boolean | null;

export interface Attrs {
  [key: string]: AttrValue;
}

export interface Mark {
  type: string;
  attrs: Attrs;
}

export interface TextNode {
  object: "text";
  text: string;
  marks: Mark[];
}

export interface ElementNode {
  object: "element";
  id: NodeId;
  type: string;
  attrs: Attrs;
  children: EditorNode[];
}

export type EditorNode = ElementNode | TextNode;

export interface EditorDocument {
  object: "document";
  id: NodeId;
  children: ElementNode[];
}

export function isTextNode(node: EditorNode): node is TextNode {
  return node.object === "text";
}

export function isElementNode(node: EditorNode): node is ElementNode {
  return node.object === "element";
}

export function isVoid(node: EditorNode, voidTypes: ReadonlySet<string>): boolean {
  return isElementNode(node) && voidTypes.has(node.type);
}
