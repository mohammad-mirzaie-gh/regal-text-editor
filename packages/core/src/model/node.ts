import { generateId } from "../utils/id";
import type { Attrs, ElementNode, EditorDocument, EditorNode, Mark, TextNode } from "./types";

export function createText(text: string, marks: Mark[] = []): TextNode {
  return { object: "text", text, marks };
}

export function createElement(
  type: string,
  attrs: Attrs = {},
  children: EditorNode[] = [],
  id?: string
): ElementNode {
  return { object: "element", id: id ?? generateId(type), type, attrs, children };
}

export function createDocument(children: ElementNode[] = [], id?: string): EditorDocument {
  return { object: "document", id: id ?? generateId("doc"), children };
}

export function hasMark(node: TextNode, markType: string): boolean {
  return node.marks.some((mark) => mark.type === markType);
}

export function getMark(node: TextNode, markType: string): Mark | undefined {
  return node.marks.find((mark) => mark.type === markType);
}

export function marksEqual(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.type.localeCompare(y.type));
  const sortedB = [...b].sort((x, y) => x.type.localeCompare(y.type));
  return sortedA.every((mark, index) => {
    const other = sortedB[index];
    if (!other || other.type !== mark.type) return false;
    const aKeys = Object.keys(mark.attrs);
    const bKeys = Object.keys(other.attrs);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => mark.attrs[key] === other.attrs[key]);
  });
}

export function addMark(marks: Mark[], mark: Mark): Mark[] {
  const withoutExisting = marks.filter((existing) => existing.type !== mark.type);
  return [...withoutExisting, mark].sort((a, b) => a.type.localeCompare(b.type));
}

export function removeMark(marks: Mark[], markType: string): Mark[] {
  return marks.filter((mark) => mark.type !== markType);
}

/** Depth-first traversal yielding every node (element and text) with its path. */
export function* walk(
  root: EditorDocument | ElementNode,
  path: number[] = []
): Generator<{ node: EditorNode; path: number[] }> {
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index] as EditorNode;
    const childPath = [...path, index];
    yield { node: child, path: childPath };
    if (child.object === "element") {
      yield* walk(child, childPath);
    }
  }
}

export function* textNodes(
  root: EditorDocument | ElementNode
): Generator<{ node: TextNode; path: number[] }> {
  for (const entry of walk(root)) {
    if (entry.node.object === "text") {
      yield entry as { node: TextNode; path: number[] };
    }
  }
}

export function getNodeAtPath(
  root: EditorDocument | ElementNode,
  path: number[]
): EditorNode | EditorDocument {
  let current: EditorNode | EditorDocument = root;
  for (const index of path) {
    if (current.object === "text") {
      throw new Error(`Invalid path: cannot descend into a text node at [${path.join(",")}]`);
    }
    const next = current.children[index] as EditorNode | undefined;
    if (!next) {
      throw new Error(`Invalid path: no node at index ${index} in [${path.join(",")}]`);
    }
    current = next;
  }
  return current;
}

export function getParentPath(path: number[]): number[] {
  return path.slice(0, -1);
}

export function isEqualPath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function comparePaths(a: number[], b: number[]): -1 | 0 | 1 {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const av = a[i];
    const bv = b[i];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

export function lastTextEntry(
  root: EditorDocument | ElementNode
): { node: TextNode; path: number[] } | undefined {
  let last: { node: TextNode; path: number[] } | undefined;
  for (const entry of textNodes(root)) last = entry;
  return last;
}

export function firstTextEntry(
  root: EditorDocument | ElementNode
): { node: TextNode; path: number[] } | undefined {
  for (const entry of textNodes(root)) return entry;
  return undefined;
}

export function findPathById(
  root: EditorDocument | ElementNode,
  id: string
): number[] | undefined {
  for (const entry of walk(root)) {
    if (entry.node.object === "element" && entry.node.id === id) {
      return entry.path;
    }
  }
  return undefined;
}
