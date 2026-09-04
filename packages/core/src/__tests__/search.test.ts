import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText } from "../model/node";
import { Schema } from "../schema/schema";
import { defineNode } from "../schema/types";
import { Transaction } from "../transaction/transaction";
import { findMatches, replaceAllMatches, replaceMatch } from "../search/search";

function schema(): Schema {
  return new Schema({
    defaultBlockType: "paragraph",
    nodes: [defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true })],
    marks: []
  });
}

describe("findMatches", () => {
  it("finds every occurrence in document order, case-insensitively by default", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("Cat and cat")]),
      createElement("paragraph", {}, [createText("caterpillar")])
    ]);
    const matches = findMatches(doc, "cat");
    expect(matches).toHaveLength(3);
    expect(matches[0]).toEqual({ start: { path: [0, 0], offset: 0 }, end: { path: [0, 0], offset: 3 } });
    expect(matches[1]).toEqual({ start: { path: [0, 0], offset: 8 }, end: { path: [0, 0], offset: 11 } });
    expect(matches[2]).toEqual({ start: { path: [1, 0], offset: 0 }, end: { path: [1, 0], offset: 3 } });
  });

  it("respects caseSensitive", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("Cat and cat")])]);
    expect(findMatches(doc, "Cat", { caseSensitive: true })).toHaveLength(1);
  });

  it("never matches across a block boundary", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("cat")]),
      createElement("paragraph", {}, [createText("erpillar")])
    ]);
    expect(findMatches(doc, "caterpillar")).toHaveLength(0);
  });

  it("matches across a mark/leaf boundary within the same block", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("hello "), createText("world", [{ type: "bold", attrs: {} }])])
    ]);
    const matches = findMatches(doc, "o wo");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ start: { path: [0, 0], offset: 4 }, end: { path: [0, 1], offset: 2 } });
  });

  it("returns nothing for an empty query", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    expect(findMatches(doc, "")).toEqual([]);
  });
});

describe("replaceMatch / replaceAllMatches", () => {
  it("replaces a single match spanning two leaves", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("hello "), createText("world", [{ type: "bold", attrs: {} }])])
    ]);
    const match = findMatches(doc, "o wo")[0]!;
    const tx = new Transaction(doc, null);
    replaceMatch(tx, schema(), match, "X");
    expect((tx.doc.children[0]!.children as { text?: string }[]).map((n) => n.text).join("")).toBe("hellXrld");
  });

  it("replaces every match in one transaction without corrupting later paths", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("cat and cat and cat")])
    ]);
    const matches = findMatches(doc, "cat");
    const tx = new Transaction(doc, null);
    const count = replaceAllMatches(tx, schema(), matches, "dog");
    expect(count).toBe(3);
    expect((tx.doc.children[0]!.children[0] as { text: string }).text).toBe("dog and dog and dog");
  });
});
