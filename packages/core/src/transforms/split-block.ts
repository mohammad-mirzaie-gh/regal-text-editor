import { createElement, getNodeAtPath } from "../model/node";
import type { ElementNode } from "../model/types";
import type { Point } from "../position/point";
import type { Transaction } from "../transaction/transaction";
import type { Schema } from "../schema/schema";
import { findTextBlockPath } from "./text-block";

export interface SplitBlockResult {
  beforePath: number[];
  afterPath: number[];
  cursor: Point;
}

/** Splits the text block containing `point` into two sibling blocks of the
 * same type/attrs at that point (the default Enter behavior; plugins for
 * lists/blockquotes override this in their own keymaps for their node types). */
export function splitBlock(tx: Transaction, schema: Schema, point: Point): SplitBlockResult {
  const blockPath = findTextBlockPath(tx.doc, schema, point.path);
  const blockParent = blockPath.slice(0, -1);
  const blockIndex = blockPath[blockPath.length - 1] as number;
  const leafIndex = point.path[point.path.length - 1] as number;

  tx.splitText(point.path, point.offset);
  const splitIndex = leafIndex + 1;

  const currentBlock = getNodeAtPath(tx.doc, blockPath) as ElementNode;
  const movingCount = currentBlock.children.length - splitIndex;
  const newBlock = createElement(currentBlock.type, { ...currentBlock.attrs }, []);
  const afterPath = [...blockParent, blockIndex + 1];
  tx.insertNode(afterPath, newBlock);

  for (let i = 0; i < movingCount; i += 1) {
    const targetLen = (getNodeAtPath(tx.doc, afterPath) as ElementNode).children.length;
    tx.moveNode([...blockPath, splitIndex], [...afterPath, targetLen]);
  }

  return { beforePath: blockPath, afterPath, cursor: { path: [...afterPath, 0], offset: 0 } };
}
