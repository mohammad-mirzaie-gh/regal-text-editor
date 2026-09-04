import { createElement, getNodeAtPath } from "../model/node";
import type { Attrs, ElementNode } from "../model/types";
import type { Transaction } from "../transaction/transaction";

/** Changes a block's node type/attrs in place while preserving its id and
 * children (e.g. paragraph -> heading). Node type is not itself a mutable
 * field on an operation, so this composes remove + insert of a replacement
 * element that reuses the original id, keeping external references (future
 * comments/bookmarks) stable. */
export function setBlockType(tx: Transaction, blockPath: number[], type: string, attrs: Attrs = {}): void {
  const node = getNodeAtPath(tx.doc, blockPath) as ElementNode;
  const replacement = createElement(type, { ...attrs }, node.children, node.id);
  tx.removeNode(blockPath);
  tx.insertNode(blockPath, replacement);
}

/** Wraps the contiguous sibling range [startIndex, endIndex] under `parentPath`
 * in a new element of `wrapperType`. Returns the wrapper's path. */
export function wrapBlocks(
  tx: Transaction,
  parentPath: number[],
  startIndex: number,
  endIndex: number,
  wrapperType: string,
  attrs: Attrs = {}
): number[] {
  const wrapper = createElement(wrapperType, attrs, []);
  const wrapperPath = [...parentPath, startIndex];
  tx.insertNode(wrapperPath, wrapper);
  const count = endIndex - startIndex + 1;
  for (let i = 0; i < count; i += 1) {
    const targetLen = (getNodeAtPath(tx.doc, wrapperPath) as ElementNode).children.length;
    tx.moveNode([...parentPath, startIndex + 1], [...wrapperPath, targetLen]);
  }
  return wrapperPath;
}

/** Moves every child of the element at `wrapperPath` out to take its place,
 * then removes the now-empty wrapper.
 *
 * Children are extracted last-to-first, each one moved to `index + 1` (the
 * slot immediately after the wrapper). Because every move target sits
 * *after* the wrapper's own slot, the wrapper's path never shifts while the
 * loop runs — moving to `index + i` (the wrapper's own growing/shifting
 * position) would be wrong the moment there is more than one child, since
 * the first move already pushes the wrapper one slot to the right. */
export function unwrapBlocks(tx: Transaction, wrapperPath: number[]): void {
  const parentPath = wrapperPath.slice(0, -1);
  const index = wrapperPath[wrapperPath.length - 1];
  if (index === undefined) throw new Error("unwrapBlocks requires a non-root path");
  const wrapper = getNodeAtPath(tx.doc, wrapperPath) as ElementNode;
  const count = wrapper.children.length;
  for (let i = count - 1; i >= 0; i -= 1) {
    tx.moveNode([...wrapperPath, i], [...parentPath, index + 1]);
  }
  tx.removeNode(wrapperPath);
}
