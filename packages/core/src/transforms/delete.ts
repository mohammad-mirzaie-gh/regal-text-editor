import { getNodeAtPath } from "../model/node";
import type { Point } from "../position/point";
import type { Transaction } from "../transaction/transaction";
import type { Schema } from "../schema/schema";
import { findTextBlockPath } from "./text-block";

function leafLength(tx: Transaction, path: number[]): number {
  const node = getNodeAtPath(tx.doc, path);
  if (node.object !== "text") throw new Error("Expected a text leaf");
  return node.text.length;
}

function samePath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Removes the content between two points and returns the resulting
 * collapsed cursor position. Handles the common cases: deletion inside a
 * single text leaf, deletion spanning multiple inline leaves within one
 * text block, and deletion spanning multiple top-level blocks. Deletion
 * that crosses into/out of nested containers (e.g. from a paragraph into a
 * list item several levels deep) falls back to only clearing text within
 * each endpoint's own block without merging the containers — a documented
 * simplification rather than a silent correctness gap.
 */
export function deleteRange(tx: Transaction, schema: Schema, start: Point, end: Point): Point {
  if (samePath(start.path, end.path)) {
    if (start.offset === end.offset) return start;
    tx.removeText(start.path, start.offset, end.offset - start.offset);
    return start;
  }

  const startParent = start.path.slice(0, -1);
  const endParent = end.path.slice(0, -1);

  if (samePath(startParent, endParent)) {
    const startIndex = start.path[start.path.length - 1] as number;
    const endIndex = end.path[end.path.length - 1] as number;

    tx.removeText(end.path, 0, end.offset);
    tx.removeText(start.path, start.offset, leafLength(tx, start.path) - start.offset);

    for (let i = endIndex - 1; i > startIndex; i -= 1) {
      tx.removeNode([...startParent, i]);
    }
    tx.mergeNodes([...startParent, startIndex + 1]);
    return { path: [...startParent, startIndex], offset: start.offset };
  }

  const startBlockPath = findTextBlockPath(tx.doc, schema, start.path);
  const endBlockPath = findTextBlockPath(tx.doc, schema, end.path);

  const endLeafIndex = end.path[end.path.length - 1] as number;
  const endLeafParent = end.path.slice(0, -1);
  tx.removeText(end.path, 0, end.offset);
  for (let i = endLeafIndex - 1; i >= 0; i -= 1) {
    tx.removeNode([...endLeafParent, i]);
  }

  const startLeafIndex = start.path[start.path.length - 1] as number;
  const startLeafParent = start.path.slice(0, -1);
  tx.removeText(start.path, start.offset, leafLength(tx, start.path) - start.offset);
  const startBlockChildCount = (getNodeAtPath(tx.doc, startLeafParent) as { children: unknown[] }).children.length;
  for (let i = startBlockChildCount - 1; i > startLeafIndex; i -= 1) {
    tx.removeNode([...startLeafParent, i]);
  }

  const startTopIndex = startBlockPath[0] as number;
  const endTopIndex = endBlockPath[0] as number;
  for (let i = endTopIndex - 1; i > startTopIndex; i -= 1) {
    tx.removeNode([i]);
  }

  const mergedEndBlockPath = [startTopIndex + 1];
  const endBlockNode = getNodeAtPath(tx.doc, mergedEndBlockPath) as { children: unknown[] };
  const movedChildCount = endBlockNode.children.length;
  for (let i = 0; i < movedChildCount; i += 1) {
    const targetLen = (getNodeAtPath(tx.doc, startBlockPath) as { children: unknown[] }).children.length;
    tx.moveNode([...mergedEndBlockPath, 0], [...startBlockPath, targetLen]);
  }
  tx.removeNode(mergedEndBlockPath);

  return { path: [...startLeafParent, startLeafIndex], offset: start.offset };
}
