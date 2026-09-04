import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText, getNodeAtPath } from "../model/node";
import type { TextNode } from "../model/types";
import { Schema } from "../schema/schema";
import { defineNode } from "../schema/types";
import { Transaction } from "../transaction/transaction";
import { insertBlocksAtSelection } from "../transforms/insert-blocks";
import { normalizeSelection, cursor } from "../selection/selection";
import { normalizeDocument } from "../normalization/normalize";

function schema(): Schema {
  return new Schema({
    defaultBlockType: "paragraph",
    nodes: [
      defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true }),
      defineNode({ name: "horizontalRule", group: "block", void: true })
    ],
    marks: [{ name: "bold" }]
  });
}

function text(node: unknown): string {
  return (node as TextNode).text;
}

describe("insertBlocksAtSelection", () => {
  it("merges a single-paragraph fragment directly into the surrounding text", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello world")])]);
    const tx = new Transaction(doc, null);
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 6 }));
    const fragment = [createElement("paragraph", {}, [createText("brave new "), createText("bold", [{ type: "bold", attrs: {} }])])];
    insertBlocksAtSelection(tx, schema(), range, fragment);
    const normalized = normalizeDocument(schema(), tx.doc);
    expect(normalized.children).toHaveLength(1);
    const paragraph = getNodeAtPath(normalized, [0]) as { children: TextNode[] };
    expect(paragraph.children.map((c) => c.text).join("")).toBe("hello brave new boldworld");
  });

  it("splits the block and inserts multiple blocks between the halves", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello world")])]);
    const tx = new Transaction(doc, null);
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 6 }));
    const fragment = [
      createElement("paragraph", {}, [createText("middle one")]),
      createElement("paragraph", {}, [createText("middle two")])
    ];
    const cursorPoint = insertBlocksAtSelection(tx, schema(), range, fragment);
    expect(tx.doc.children.map((child) => text(getNodeAtPath(tx.doc, [tx.doc.children.indexOf(child), 0])))).toEqual([
      "hello ",
      "middle one",
      "middle two",
      "world"
    ]);
    expect(text(getNodeAtPath(tx.doc, cursorPoint.path))).toBe("middle two");
    expect(cursorPoint.offset).toBe("middle two".length);
  });

  it("replaces a selection before inserting", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello world")])]);
    const tx = new Transaction(doc, null);
    const range = normalizeSelection({
      type: "range",
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 11 }
    });
    insertBlocksAtSelection(tx, schema(), range, [createElement("paragraph", {}, [createText("replaced")])]);
    const normalized = normalizeDocument(schema(), tx.doc);
    expect(text(getNodeAtPath(normalized, [0, 0]))).toBe("replaced");
  });
});
