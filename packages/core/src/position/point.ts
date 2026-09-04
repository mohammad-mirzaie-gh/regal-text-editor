import type { EditorDocument, Mark, TextNode } from "../model/types";
import { comparePaths, findPathById, getNodeAtPath, getParentPath, isEqualPath, textNodes } from "../model/node";

/** A position inside the document: `path` addresses a text leaf, `offset`
 * is a character offset within that leaf's text. This mirrors how real
 * selections behave (they always ultimately land on characters) and keeps
 * position math independent of any DOM offsets. */
export interface Point {
  path: number[];
  offset: number;
}

export function comparePoints(a: Point, b: Point): -1 | 0 | 1 {
  const pathCompare = comparePaths(a.path, b.path);
  if (pathCompare !== 0) return pathCompare;
  if (a.offset < b.offset) return -1;
  if (a.offset > b.offset) return 1;
  return 0;
}

export function isEqualPoint(a: Point, b: Point): boolean {
  return isEqualPath(a.path, b.path) && a.offset === b.offset;
}

export function isBeforePoint(a: Point, b: Point): boolean {
  return comparePoints(a, b) < 0;
}

export function isAfterPoint(a: Point, b: Point): boolean {
  return comparePoints(a, b) > 0;
}

export function getTextAtPoint(doc: EditorDocument, point: Point): TextNode {
  const node = getNodeAtPath(doc, point.path);
  if (node.object !== "text") {
    throw new Error(`Point path [${point.path.join(",")}] does not address a text node`);
  }
  return node;
}

export function clampPoint(doc: EditorDocument, point: Point): Point {
  const text = getTextAtPoint(doc, point);
  return { path: point.path, offset: Math.max(0, Math.min(point.offset, text.text.length)) };
}

function allTextPaths(doc: EditorDocument): number[][] {
  const paths: number[][] = [];
  for (const entry of textNodes(doc)) paths.push(entry.path);
  return paths;
}

export function startOfDocument(doc: EditorDocument): Point {
  const paths = allTextPaths(doc);
  const first = paths[0];
  if (!first) throw new Error("Document has no text nodes; normalize() before positioning");
  return { path: first, offset: 0 };
}

export function endOfDocument(doc: EditorDocument): Point {
  const paths = allTextPaths(doc);
  const last = paths[paths.length - 1];
  if (!last) throw new Error("Document has no text nodes; normalize() before positioning");
  const text = getTextAtPoint(doc, { path: last, offset: 0 });
  return { path: last, offset: text.text.length };
}

export function nextTextPath(doc: EditorDocument, path: number[]): number[] | undefined {
  const paths = allTextPaths(doc);
  const index = paths.findIndex((candidate) => isEqualPath(candidate, path));
  return index === -1 ? undefined : paths[index + 1];
}

export function previousTextPath(doc: EditorDocument, path: number[]): number[] | undefined {
  const paths = allTextPaths(doc);
  const index = paths.findIndex((candidate) => isEqualPath(candidate, path));
  return index <= 0 ? undefined : paths[index - 1];
}

export function movePoint(doc: EditorDocument, point: Point, delta: number): Point {
  if (delta === 0) return point;
  if (delta > 0) {
    let remaining = delta;
    let current = point;
    while (remaining > 0) {
      const text = getTextAtPoint(doc, current);
      const available = text.text.length - current.offset;
      if (remaining <= available) return { path: current.path, offset: current.offset + remaining };
      remaining -= available;
      const next = nextTextPath(doc, current.path);
      if (!next) return endOfDocument(doc);
      current = { path: next, offset: 0 };
    }
    return current;
  }
  let remaining = -delta;
  let current = point;
  while (remaining > 0) {
    if (remaining <= current.offset) return { path: current.path, offset: current.offset - remaining };
    remaining -= current.offset;
    const previous = previousTextPath(doc, current.path);
    if (!previous) return startOfDocument(doc);
    const text = getTextAtPoint(doc, { path: previous, offset: 0 });
    current = { path: previous, offset: text.text.length };
  }
  return current;
}

/** The marks a newly-typed character at a collapsed cursor should inherit:
 * the marks of the text immediately before the cursor, falling back to the
 * text immediately after when at the very start of a leaf/document. */
export function marksAtPoint(doc: EditorDocument, point: Point): Mark[] {
  const leaf = getTextAtPoint(doc, point);
  if (point.offset > 0) return leaf.marks;
  const previous = previousTextPath(doc, point.path);
  if (previous) return getTextAtPoint(doc, { path: previous, offset: 0 }).marks;
  return leaf.marks;
}

/**
 * Structural commands (wrap/unwrap/indent/outdent) relocate a block
 * without touching its internal content, so a point inside that block can
 * be carried through the transform by pairing the block's stable id with
 * the point's path *relative to the block* — resolved back to an absolute
 * path afterwards via the block's new location. This is more robust than
 * re-deriving exact index arithmetic per transform, and is exactly the
 * kind of cross-transaction reference stable node ids exist for.
 */
export interface BlockRelativePoint {
  blockId: string;
  suffix: number[];
  offset: number;
}

export function toBlockRelativePoint(
  doc: EditorDocument,
  blockPath: number[],
  point: Point
): BlockRelativePoint {
  const node = getNodeAtPath(doc, blockPath);
  if (node.object !== "element") throw new Error("toBlockRelativePoint requires an element block path");
  return { blockId: node.id, suffix: point.path.slice(blockPath.length), offset: point.offset };
}

export function resolveBlockRelativePoint(doc: EditorDocument, relative: BlockRelativePoint): Point | undefined {
  const blockPath = findPathById(doc, relative.blockId);
  if (!blockPath) return undefined;
  return { path: [...blockPath, ...relative.suffix], offset: relative.offset };
}

/**
 * Marks-over-a-range transforms split text leaves at the range boundaries,
 * which changes leaf indices/offsets without changing the block's overall
 * text content. Expressing an endpoint as a character offset from the
 * start of its block survives that kind of split intact, unlike the raw
 * {path, offset} pair — resolve it back with `pointFromBlockTextOffset`
 * once the transform (and any leaf splitting/merging it did) is applied.
 */
export function blockTextOffset(doc: EditorDocument, blockPath: number[], point: Point): number {
  const blockNode = getNodeAtPath(doc, blockPath);
  if (blockNode.object !== "element") throw new Error("blockTextOffset requires an element block path");
  let offset = 0;
  for (const entry of textNodes(blockNode)) {
    if (isEqualPath([...blockPath, ...entry.path], point.path)) return offset + point.offset;
    offset += entry.node.text.length;
  }
  return offset;
}

export function pointFromBlockTextOffset(doc: EditorDocument, blockPath: number[], targetOffset: number): Point {
  const blockNode = getNodeAtPath(doc, blockPath);
  if (blockNode.object !== "element") throw new Error("pointFromBlockTextOffset requires an element block path");
  let consumed = 0;
  let last: number[] | undefined;
  let lastLength = 0;
  for (const entry of textNodes(blockNode)) {
    const length = entry.node.text.length;
    if (targetOffset <= consumed + length) {
      return { path: [...blockPath, ...entry.path], offset: targetOffset - consumed };
    }
    consumed += length;
    last = entry.path;
    lastLength = length;
  }
  if (last) return { path: [...blockPath, ...last], offset: lastLength };
  return { path: [...blockPath, 0], offset: 0 };
}

/** Path of the nearest block-level ancestor (the top-level child under the document) for a point. */
export function blockPathForPoint(point: Point): number[] {
  return point.path.slice(0, 1);
}

export function parentPath(point: Point): number[] {
  return getParentPath(point.path);
}
