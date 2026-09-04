import type { EditorDocument, ElementNode } from "../model/types";
import { normalizeDocument } from "../normalization/normalize";
import { comparePoints, endOfDocument, startOfDocument, type Point } from "../position/point";
import type { Schema } from "../schema/schema";
import { Transaction } from "../transaction/transaction";
import { deleteRange } from "./delete";

/**
 * Extracts the blocks between two points as a standalone fragment, for
 * clipboard copy or any future "duplicate this range" feature. Implemented
 * as "delete everything after `end`, then delete everything before `start`"
 * on a scratch transaction — reusing the already-tested `deleteRange`
 * machinery instead of a separate extraction algorithm. Deleting the tail
 * first is what makes this safe: it never touches anything before `end`,
 * so `start`'s path is still valid for the second deletion.
 */
export function sliceDocument(doc: EditorDocument, schema: Schema, start: Point, end: Point): ElementNode[] {
  const tx = new Transaction(doc, null);
  const docEnd = endOfDocument(tx.doc);
  if (comparePoints(end, docEnd) < 0) deleteRange(tx, schema, end, docEnd);
  const docStart = startOfDocument(tx.doc);
  if (comparePoints(docStart, start) < 0) deleteRange(tx, schema, docStart, start);
  return normalizeDocument(schema, tx.doc).children;
}
