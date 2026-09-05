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

  it("returns a cursor point that stays valid after the inserted leaf merges into its same-marks neighbor", () => {
    // Regression test: the single-text-block branch used to return a raw
    // {path, offset} pointing at the just-inserted leaf's own index. When
    // that leaf carries the same marks as its neighbor(s) (plain text next
    // to plain text — the common case), normalizeDocument merges them into
    // one leaf during dispatch, which happens *after* this point was
    // computed — leaving a selection that points past the end of a now
    // shorter children array and fails to clamp.
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    const tx = new Transaction(doc, null);
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 5 }));
    const fragment = [createElement("paragraph", {}, [createText(" world")])];
    const cursorPoint = insertBlocksAtSelection(tx, schema(), range, fragment);

    const normalized = normalizeDocument(schema(), tx.doc);
    // Must resolve without throwing against the post-merge document.
    const resolved = getNodeAtPath(normalized, cursorPoint.path) as TextNode;
    expect(resolved.text).toBe("hello world");
    expect(cursorPoint.offset).toBe("hello world".length);
    expect(normalized.children[0]).toMatchObject({ children: [{ text: "hello world" }] });
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
