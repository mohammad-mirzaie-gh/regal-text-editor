import { lastTextEntry } from "../model/node";
import type { ElementNode } from "../model/types";
import type { Point } from "../position/point";
import type { NormalizedRange } from "../selection/selection";
import type { Schema } from "../schema/schema";
import type { Transaction } from "../transaction/transaction";
import { deleteRange } from "./delete";
import { splitBlock } from "./split-block";

/**
 * Inserts a fragment of block nodes at the current selection — the shared
 * primitive behind paste, drop, and any future programmatic content
 * insertion (an AI plugin per section 87, DOCX import, etc). A single
 * text-block fragment (the common "pasted one line of rich text" case)
 * merges directly into the surrounding text; anything larger splits the
 * current block and inserts the fragment's blocks between the two halves.
 */
export function insertBlocksAtSelection(
  tx: Transaction,
  schema: Schema,
  range: NormalizedRange,
  blocks: ElementNode[]
): Point {
  const point = range.isCollapsed ? range.start : deleteRange(tx, schema, range.start, range.end);
  if (blocks.length === 0) return point;

  const singleTextBlock = blocks.length === 1 && schema.nodes.get(blocks[0]!.type)?.isTextBlock;

  if (singleTextBlock) {
    const inlineChildren = blocks[0]!.children;
    tx.splitText(point.path, point.offset);
    const leafIndex = point.path[point.path.length - 1] as number;
    const leafParent = point.path.slice(0, -1);
    let insertAt = leafIndex + 1;
    for (const child of inlineChildren) {
      tx.insertNode([...leafParent, insertAt], child);
      insertAt += 1;
    }
    const last = inlineChildren[inlineChildren.length - 1];
    if (!last) return point;
    return { path: [...leafParent, insertAt - 1], offset: last.object === "text" ? last.text.length : 0 };
  }

  const split = splitBlock(tx, schema, point);
  const parentPath = split.beforePath.slice(0, -1);
  const beforeIndex = split.beforePath[split.beforePath.length - 1] as number;
  let insertAt = beforeIndex + 1;
  for (const block of blocks) {
    tx.insertNode([...parentPath, insertAt], block);
    insertAt += 1;
  }

  const lastBlock = blocks[blocks.length - 1]!;
  const lastBlockPath = [...parentPath, insertAt - 1];
  if (schema.nodes.get(lastBlock.type)?.isTextBlock) {
    const lastLeaf = lastTextEntry(lastBlock);
    if (lastLeaf) return { path: [...lastBlockPath, ...lastLeaf.path], offset: lastLeaf.node.text.length };
  }
  return { path: [...split.afterPath, 0], offset: 0 };
}
