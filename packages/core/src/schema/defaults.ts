import { defineNode } from "./types";
import { Schema } from "./schema";

/** Minimal schema every editor instance starts from: a single paragraph
 * block type that accepts inline text. Everything else (headings, lists,
 * marks, tables, ...) is added by plugins via `schema.extend`. */
export function createBaseSchema(): Schema {
  return new Schema({
    defaultBlockType: "paragraph",
    nodes: [
      defineNode({
        name: "paragraph",
        group: "block",
        content: "inline*",
        marks: "_",
        isTextBlock: true
      })
    ],
    marks: []
  });
}
