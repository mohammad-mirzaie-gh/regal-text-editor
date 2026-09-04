import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText, getNodeAtPath } from "../model/node";
import type { TextNode } from "../model/types";
import { Schema } from "../schema/schema";
import { defineNode } from "../schema/types";
import { Transaction } from "../transaction/transaction";
import { deleteRange } from "../transforms/delete";
import { splitBlock } from "../transforms/split-block";
import { mergeBlockBackward } from "../transforms/merge-block";
import { applyMarkToRange, isMarkActiveAcrossRange } from "../transforms/marks";
import { normalizeSelection } from "../selection/selection";
import type { Point } from "../position/point";
import { normalizeDocument } from "../normalization/normalize";

function schema(): Schema {
  return new Schema({
    defaultBlockType: "paragraph",
    nodes: [defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true })],
    marks: [{ name: "bold" }]
  });
}

function text(node: unknown): string {
  return (node as TextNode).text;
}

describe("deleteRange", () => {
  it("deletes within a single leaf", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello world")])]);
    const tx = new Transaction(doc, null);
    const start: Point = { path: [0, 0], offset: 5 };
    const end: Point = { path: [0, 0], offset: 11 };
    deleteRange(tx, schema(), start, end);
    expect(text(getNodeAtPath(tx.doc, [0, 0]))).toBe("hello");
  });

  it("deletes across multiple inline leaves in one block and merges them", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("foo"), createText("bar"), createText("baz")])
    ]);
    const tx = new Transaction(doc, null);
    const start: Point = { path: [0, 0], offset: 1 };
    const end: Point = { path: [0, 2], offset: 2 };
    deleteRange(tx, schema(), start, end);
    const paragraph = getNodeAtPath(tx.doc, [0]) as { children: unknown[] };
    expect(paragraph.children).toHaveLength(1);
    expect(text(paragraph.children[0])).toBe("fz");
  });

  it("deletes across multiple blocks and merges the remainders", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("hello world")]),
      createElement("paragraph", {}, [createText("second block")]),
      createElement("paragraph", {}, [createText("third one")])
    ]);
    const tx = new Transaction(doc, null);
    const start: Point = { path: [0, 0], offset: 5 };
    const end: Point = { path: [2, 0], offset: 5 };
    deleteRange(tx, schema(), start, end);
    const normalized = normalizeDocument(schema(), tx.doc);
    expect(normalized.children).toHaveLength(1);
    expect(text(getNodeAtPath(normalized, [0, 0]))).toBe("hello one");
  });
});

describe("splitBlock", () => {
  it("splits a paragraph into two at the cursor", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello world")])]);
    const tx = new Transaction(doc, null);
    splitBlock(tx, schema(), { path: [0, 0], offset: 5 });
    expect(tx.doc.children).toHaveLength(2);
    expect(text(getNodeAtPath(tx.doc, [0, 0]))).toBe("hello");
    expect(text(getNodeAtPath(tx.doc, [1, 0]))).toBe(" world");
  });

  it("produces an empty trailing block when splitting at the end, valid after normalization", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    const tx = new Transaction(doc, null);
    splitBlock(tx, schema(), { path: [0, 0], offset: 5 });
    const normalized = normalizeDocument(schema(), tx.doc);
    expect(normalized.children).toHaveLength(2);
    expect(text(getNodeAtPath(normalized, [1, 0]))).toBe("");
  });
});

describe("mergeBlockBackward", () => {
  it("merges a block into its previous sibling and returns the join point", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("hello")]),
      createElement("paragraph", {}, [createText(" world")])
    ]);
    const tx = new Transaction(doc, null);
    const join = mergeBlockBackward(tx, [1]);
    const normalized = normalizeDocument(schema(), tx.doc);
    expect(normalized.children).toHaveLength(1);
    expect(text(getNodeAtPath(normalized, [0, 0]))).toBe("hello world");
    expect(join).toEqual({ path: [0, 0], offset: 5 });
  });

  it("returns undefined when there is no preceding sibling", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    const tx = new Transaction(doc, null);
    expect(mergeBlockBackward(tx, [0])).toBeUndefined();
  });
});

describe("marks", () => {
  it("applies a mark to exactly the selected substring, splitting leaves as needed", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello world")])]);
    const tx = new Transaction(doc, null);
    const range = normalizeSelection({
      type: "range",
      anchor: { path: [0, 0], offset: 6 },
      focus: { path: [0, 0], offset: 11 }
    });
    applyMarkToRange(tx, range, { type: "bold", attrs: {} });
    const paragraph = getNodeAtPath(tx.doc, [0]) as { children: TextNode[] };
    expect(paragraph.children.map((c) => c.text)).toEqual(["hello ", "world"]);
    expect(paragraph.children[1]!.marks).toEqual([{ type: "bold", attrs: {} }]);
    expect(paragraph.children[0]!.marks).toEqual([]);
  });

  it("reports mixed activation across a partially-marked range", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [
        createText("bold", [{ type: "bold", attrs: {} }]),
        createText("plain")
      ])
    ]);
    const range = normalizeSelection({
      type: "range",
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 1], offset: 5 }
    });
    expect(isMarkActiveAcrossRange(doc, range, "bold")).toBe("mixed");
  });
});
