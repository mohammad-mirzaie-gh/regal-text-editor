import type { EditorDocument, ElementNode } from "../model/types";
import type { Schema } from "../schema/schema";

function blockToText(node: ElementNode): string {
  return node.children
    .map((child) => (child.object === "text" ? child.text : blockToText(child)))
    .join("");
}

/** Lossy plain-text export: text blocks become lines, separated by a blank
 * line between top-level blocks (a reasonable, documented default rather
 * than an attempt to fully preserve list markers/table layout in plain text). */
export function toPlainText(schema: Schema, doc: EditorDocument): string {
  void schema;
  return doc.children.map(blockToText).join("\n\n");
}
