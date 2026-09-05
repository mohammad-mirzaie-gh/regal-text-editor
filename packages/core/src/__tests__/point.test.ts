import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText } from "../model/node";
import type { EditorDocument, ElementNode } from "../model/types";
import {
  blockPathForPoint,
  blockTextOffset,
  clampPoint,
  comparePoints,
  endOfDocument,
  getTextAtPoint,
  isAfterPoint,
  isBeforePoint,
  isEqualPoint,
  marksAtPoint,
  movePoint,
  nextTextPath,
  parentPath,
  pointFromBlockTextOffset,
  previousTextPath,
  resolveBlockRelativePoint,
  startOfDocument,
  toBlockRelativePoint
} from "../position/point";

const bold = { type: "bold", attrs: {} };

function twoParagraphDoc(): EditorDocument {
  return createDocument([
    createElement("paragraph", {}, [createText("hello"), createText("bold", [bold])]),
    createElement("paragraph", {}, [createText("world")])
  ]);
}

describe("position/point", () => {
  describe("comparePoints / isEqualPoint / isBeforePoint / isAfterPoint", () => {
    it("compares by path first, then by offset within the same path", () => {
      expect(comparePoints({ path: [0, 0], offset: 1 }, { path: [0, 1], offset: 0 })).toBe(-1);
      expect(comparePoints({ path: [1, 0], offset: 0 }, { path: [0, 0], offset: 0 })).toBe(1);
      expect(comparePoints({ path: [0, 0], offset: 2 }, { path: [0, 0], offset: 5 })).toBe(-1);
      expect(comparePoints({ path: [0, 0], offset: 5 }, { path: [0, 0], offset: 2 })).toBe(1);
      expect(comparePoints({ path: [0, 0], offset: 3 }, { path: [0, 0], offset: 3 })).toBe(0);
    });

    it("isEqualPoint requires both the same path and the same offset", () => {
      expect(isEqualPoint({ path: [0, 0], offset: 2 }, { path: [0, 0], offset: 2 })).toBe(true);
      expect(isEqualPoint({ path: [0, 0], offset: 2 }, { path: [0, 1], offset: 2 })).toBe(false);
      expect(isEqualPoint({ path: [0, 0], offset: 2 }, { path: [0, 0], offset: 3 })).toBe(false);
    });

    it("isBeforePoint / isAfterPoint delegate to comparePoints", () => {
      const a = { path: [0, 0], offset: 0 };
      const b = { path: [0, 0], offset: 5 };
      expect(isBeforePoint(a, b)).toBe(true);
      expect(isAfterPoint(a, b)).toBe(false);
      expect(isBeforePoint(b, a)).toBe(false);
      expect(isAfterPoint(b, a)).toBe(true);
      expect(isBeforePoint(a, a)).toBe(false);
      expect(isAfterPoint(a, a)).toBe(false);
    });
  });

  describe("getTextAtPoint / clampPoint", () => {
    it("throws when the path does not address a text node", () => {
      const doc = twoParagraphDoc();
      expect(() => getTextAtPoint(doc, { path: [0], offset: 0 })).toThrow(/does not address a text node/);
    });

    it("clamps an out-of-range offset into [0, text.length]", () => {
      const doc = twoParagraphDoc();
      expect(clampPoint(doc, { path: [0, 0], offset: 999 })).toEqual({ path: [0, 0], offset: 5 });
      expect(clampPoint(doc, { path: [0, 0], offset: -5 })).toEqual({ path: [0, 0], offset: 0 });
      expect(clampPoint(doc, { path: [0, 0], offset: 3 })).toEqual({ path: [0, 0], offset: 3 });
    });
  });

  describe("startOfDocument / endOfDocument", () => {
    it("returns the very first and very last text positions", () => {
      const doc = twoParagraphDoc();
      expect(startOfDocument(doc)).toEqual({ path: [0, 0], offset: 0 });
      expect(endOfDocument(doc)).toEqual({ path: [1, 0], offset: 5 });
    });

    it("throws on a document with no text nodes at all", () => {
      const empty: EditorDocument = { object: "document", id: "d", children: [] };
      expect(() => startOfDocument(empty)).toThrow(/no text nodes/);
      expect(() => endOfDocument(empty)).toThrow(/no text nodes/);
    });
  });

  describe("nextTextPath / previousTextPath", () => {
    it("walks forward and backward across leaves and blocks", () => {
      const doc = twoParagraphDoc();
      expect(nextTextPath(doc, [0, 0])).toEqual([0, 1]);
      expect(nextTextPath(doc, [0, 1])).toEqual([1, 0]);
      expect(previousTextPath(doc, [1, 0])).toEqual([0, 1]);
      expect(previousTextPath(doc, [0, 1])).toEqual([0, 0]);
    });

    it("returns undefined past either end, or for a path not in the document", () => {
      const doc = twoParagraphDoc();
      expect(nextTextPath(doc, [1, 0])).toBeUndefined();
      expect(previousTextPath(doc, [0, 0])).toBeUndefined();
      expect(nextTextPath(doc, [9, 9])).toBeUndefined();
      expect(previousTextPath(doc, [9, 9])).toBeUndefined();
    });
  });

  describe("movePoint", () => {
    it("returns the same point unchanged for a zero delta", () => {
      const doc = twoParagraphDoc();
      const point = { path: [0, 0], offset: 2 };
      expect(movePoint(doc, point, 0)).toBe(point);
    });

    it("moves forward within a single leaf", () => {
      const doc = twoParagraphDoc();
      expect(movePoint(doc, { path: [0, 0], offset: 1 }, 2)).toEqual({ path: [0, 0], offset: 3 });
    });

    it("moves forward across a leaf boundary within the same block", () => {
      const doc = twoParagraphDoc();
      // "hello"(5) + "bold"(4): starting 3 into "hello", +4 lands 2 into "bold".
      expect(movePoint(doc, { path: [0, 0], offset: 3 }, 4)).toEqual({ path: [0, 1], offset: 2 });
    });

    it("moves forward across a block boundary", () => {
      const doc = twoParagraphDoc();
      // From offset 3 in "bold" (1 char left) + 3 more lands 3 into "world".
      expect(movePoint(doc, { path: [0, 1], offset: 3 }, 4)).toEqual({ path: [1, 0], offset: 3 });
    });

    it("clamps forward movement past the end of the document to endOfDocument", () => {
      const doc = twoParagraphDoc();
      expect(movePoint(doc, { path: [0, 0], offset: 0 }, 999)).toEqual(endOfDocument(doc));
    });

    it("moves backward within a single leaf", () => {
      const doc = twoParagraphDoc();
      expect(movePoint(doc, { path: [0, 0], offset: 4 }, -2)).toEqual({ path: [0, 0], offset: 2 });
    });

    it("moves backward across a leaf boundary", () => {
      const doc = twoParagraphDoc();
      expect(movePoint(doc, { path: [0, 1], offset: 1 }, -3)).toEqual({ path: [0, 0], offset: 3 });
    });

    it("clamps backward movement past the start of the document to startOfDocument", () => {
      const doc = twoParagraphDoc();
      expect(movePoint(doc, { path: [1, 0], offset: 2 }, -999)).toEqual(startOfDocument(doc));
    });
  });

  describe("marksAtPoint", () => {
    it("returns the current leaf's marks when the offset is past the start", () => {
      const doc = twoParagraphDoc();
      expect(marksAtPoint(doc, { path: [0, 1], offset: 2 })).toEqual([bold]);
    });

    it("returns the previous leaf's marks when at offset 0 with a previous leaf", () => {
      const doc = twoParagraphDoc();
      expect(marksAtPoint(doc, { path: [0, 1], offset: 0 })).toEqual([]);
    });

    it("falls back to the leaf's own marks at offset 0 with no previous leaf", () => {
      const doc = twoParagraphDoc();
      expect(marksAtPoint(doc, { path: [0, 0], offset: 0 })).toEqual([]);
    });
  });

  describe("toBlockRelativePoint / resolveBlockRelativePoint", () => {
    it("round-trips a point through a block-relative reference by id", () => {
      const doc = twoParagraphDoc();
      const relative = toBlockRelativePoint(doc, [0], { path: [0, 1], offset: 2 });
      expect(relative.suffix).toEqual([1]);
      expect(relative.offset).toBe(2);
      expect(resolveBlockRelativePoint(doc, relative)).toEqual({ path: [0, 1], offset: 2 });
    });

    it("resolves to undefined when the block id no longer exists in the document", () => {
      const doc = twoParagraphDoc();
      const relative = toBlockRelativePoint(doc, [0], { path: [0, 0], offset: 0 });
      const withoutThatBlock = createDocument([doc.children[1] as ElementNode]);
      expect(resolveBlockRelativePoint(withoutThatBlock, relative)).toBeUndefined();
    });

    it("throws when the given path is not an element", () => {
      const doc = twoParagraphDoc();
      expect(() => toBlockRelativePoint(doc, [0, 0], { path: [0, 0], offset: 0 })).toThrow(/requires an element block path/);
    });
  });

  describe("blockTextOffset / pointFromBlockTextOffset", () => {
    it("converts a point to a flat block-relative offset spanning multiple leaves", () => {
      const doc = twoParagraphDoc();
      expect(blockTextOffset(doc, [0], { path: [0, 1], offset: 2 })).toBe(7); // "hello".length + 2
    });

    it("returns the block's total length for a path not found among its leaves", () => {
      const doc = twoParagraphDoc();
      expect(blockTextOffset(doc, [0], { path: [1, 0], offset: 0 })).toBe(9); // "hello" + "bold"
    });

    it("resolves an offset back to the correct leaf and within-leaf offset", () => {
      const doc = twoParagraphDoc();
      expect(pointFromBlockTextOffset(doc, [0], 7)).toEqual({ path: [0, 1], offset: 2 });
      expect(pointFromBlockTextOffset(doc, [0], 0)).toEqual({ path: [0, 0], offset: 0 });
    });

    it("clamps an offset beyond the block's total length to the end of its last leaf", () => {
      const doc = twoParagraphDoc();
      expect(pointFromBlockTextOffset(doc, [0], 999)).toEqual({ path: [0, 1], offset: 4 });
    });

    it("throws when the given block path is not an element", () => {
      const doc = twoParagraphDoc();
      expect(() => blockTextOffset(doc, [0, 0], { path: [0, 0], offset: 0 })).toThrow(/requires an element block path/);
      expect(() => pointFromBlockTextOffset(doc, [0, 0], 0)).toThrow(/requires an element block path/);
    });
  });

  describe("blockPathForPoint / parentPath", () => {
    it("returns just the top-level block index", () => {
      expect(blockPathForPoint({ path: [2, 1], offset: 0 })).toEqual([2]);
    });

    it("returns the path with its last segment removed", () => {
      expect(parentPath({ path: [0, 1], offset: 0 })).toEqual([0]);
    });
  });
});
