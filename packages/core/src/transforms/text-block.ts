import type { EditorDocument } from "../model/types";
import { getNodeAtPath } from "../model/node";
import type { Schema } from "../schema/schema";

/** Walks up from any path to the nearest ancestor element whose schema
 * spec is marked `isTextBlock` (paragraph, heading, codeBlock, ...). */
export function findTextBlockPath(doc: EditorDocument, schema: Schema, path: number[]): number[] {
  for (let length = path.length; length >= 1; length -= 1) {
    const candidatePath = path.slice(0, length);
    const node = getNodeAtPath(doc, candidatePath);
    if (node.object === "element" && schema.nodes.get(node.type)?.isTextBlock) {
      return candidatePath;
    }
  }
  throw new Error(`No text block ancestor found for path [${path.join(",")}]`);
}
