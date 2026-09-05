import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText, getNodeAtPath } from "../model/node";
import type { TextNode } from "../model/types";
import type { Operation } from "../transaction/operations";
import { applyOperation, applyOperations } from "../transforms/apply";

function text(node: unknown): string {
  return (node as TextNode).text;
}

describe("applyOperation", () => {
  it("throws when a path tries to descend into a text node as if it had children", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    const op: Operation = { type: "insertText", path: [0, 0, 0], offset: 0, text: "x" };
    expect(() => applyOperation(doc, op)).toThrow(/Cannot descend into non-element/);
  });

  it("throws mergeNodes at index 0 (no preceding sibling)", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("a"), createText("b")])]);
    const op: Operation = { type: "mergeNodes", path: [0, 0] };
    expect(() => applyOperation(doc, op)).toThrow(/requires a preceding sibling/);
  });

  it("throws mergeNodes on a mismatched text/element sibling pair", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("a"), createElement("hardBreak", {}, [])])
    ]);
    const op: Operation = { type: "mergeNodes", path: [0, 1] };
    expect(() => applyOperation(doc, op)).toThrow(/requires two text nodes or two element nodes/);
  });

  it("merges two adjacent element nodes by concatenating their children", () => {
    const doc = createDocument([
      createElement("bulletList", {}, [
        createElement("listItem", {}, [createText("one")]),
        createElement("listItem", {}, [createText("two")])
      ])
    ]);
    const result = applyOperation(doc, { type: "mergeNodes", path: [0, 1] });
    const list = getNodeAtPath(result, [0]) as { children: unknown[] };
    expect(list.children).toHaveLength(1);
  });

  it("throws for an unrecognized operation type", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    const bogus = { type: "notARealOp" } as unknown as Operation;
    expect(() => applyOperation(doc, bogus)).toThrow(/Unknown operation/);
  });
});

describe("applyOperations", () => {
  it("applies a batch of operations in order against a fresh document each time", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    const ops: Operation[] = [
      { type: "insertText", path: [0, 0], offset: 5, text: " world" },
      { type: "removeText", path: [0, 0], offset: 0, length: 6 }
    ];
    const result = applyOperations(doc, ops);
    expect(text(getNodeAtPath(result, [0, 0]))).toBe("world");
    // The original document must be untouched (structural sharing, not mutation).
    expect(text(getNodeAtPath(doc, [0, 0]))).toBe("hello");
  });

  it("returns the document unchanged when given an empty operation list", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    expect(applyOperations(doc, [])).toBe(doc);
  });
});
