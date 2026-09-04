import { getNodeAtPath, lastTextEntry } from "../model/node";
import type { ElementNode } from "../model/types";
import type { Point } from "../position/point";
import type { Transaction } from "../transaction/transaction";

/** Merges the block at `blockPath` into its preceding sibling block (the
 * default Backspace-at-start-of-block behavior). Returns the join point the
 * cursor should land on, or undefined if there is no preceding sibling to
 * merge into (callers typically fall back to outdent/unwrap in that case). */
export function mergeBlockBackward(tx: Transaction, blockPath: number[]): Point | undefined {
  const index = blockPath[blockPath.length - 1];
  if (index === undefined || index === 0) return undefined;
  const parent = blockPath.slice(0, -1);
  const previousPath = [...parent, index - 1];
  const previousNode = getNodeAtPath(tx.doc, previousPath) as ElementNode;
  const lastLeaf = lastTextEntry(previousNode);
  const joinPoint: Point = lastLeaf
    ? { path: [...previousPath, ...lastLeaf.path], offset: lastLeaf.node.text.length }
    : { path: [...previousPath, 0], offset: 0 };
  tx.mergeNodes(blockPath);
  return joinPoint;
}
