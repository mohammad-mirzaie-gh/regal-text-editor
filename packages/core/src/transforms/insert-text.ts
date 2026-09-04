import type { Point } from "../position/point";
import type { NormalizedRange } from "../selection/selection";
import type { Transaction } from "../transaction/transaction";
import type { Schema } from "../schema/schema";
import { deleteRange } from "./delete";

/** Inserts text at the current selection, first deleting any selected
 * content. Returns the resulting cursor position (end of the inserted text). */
export function insertTextAtSelection(
  tx: Transaction,
  schema: Schema,
  selection: NormalizedRange,
  text: string
): Point {
  const point = selection.isCollapsed ? selection.start : deleteRange(tx, schema, selection.start, selection.end);
  if (text.length === 0) return point;
  tx.insertText(point.path, point.offset, text);
  return { path: point.path, offset: point.offset + text.length };
}
