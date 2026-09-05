import { describe, expect, it } from "vitest";
import {
  addMark,
  createDocument,
  createElement,
  createText,
  firstTextEntry,
  getMark,
  getNodeAtPath,
  hasMark,
  marksEqual,
  removeMark,
  walk
} from "../model/node";
import { isElementNode, isTextNode, isVoid } from "../model/types";

describe("model/node", () => {
  it("walks a document depth-first with correct paths", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("a")]),
      createElement("paragraph", {}, [createText("b"), createText("c")])
    ]);
    const entries = [...walk(doc)].map((entry) => entry.path);
    expect(entries).toEqual([[0], [0, 0], [1], [1, 0], [1, 1]]);
  });

  it("adds and replaces marks by type", () => {
    const marks = addMark([], { type: "bold", attrs: {} });
    const withItalic = addMark(marks, { type: "italic", attrs: {} });
    expect(withItalic.map((m) => m.type).sort()).toEqual(["bold", "italic"]);

    const replaced = addMark(withItalic, { type: "bold", attrs: { weight: 700 } });
    expect(replaced.find((m) => m.type === "bold")?.attrs.weight).toBe(700);
  });

  it("removes marks by type", () => {
    const marks = [{ type: "bold", attrs: {} }, { type: "italic", attrs: {} }];
    expect(removeMark(marks, "bold").map((m) => m.type)).toEqual(["italic"]);
  });

  it("compares mark sets structurally regardless of order", () => {
    const a = [{ type: "bold", attrs: {} }, { type: "italic", attrs: { x: 1 } }];
    const b = [{ type: "italic", attrs: { x: 1 } }, { type: "bold", attrs: {} }];
    expect(marksEqual(a, b)).toBe(true);
    expect(marksEqual(a, [{ type: "bold", attrs: {} }])).toBe(false);
  });

  it("hasMark / getMark find a mark by type", () => {
    const node = createText("hi", [{ type: "bold", attrs: { weight: 700 } }]);
    expect(hasMark(node, "bold")).toBe(true);
    expect(hasMark(node, "italic")).toBe(false);
    expect(getMark(node, "bold")).toEqual({ type: "bold", attrs: { weight: 700 } });
    expect(getMark(node, "italic")).toBeUndefined();
  });

  it("getNodeAtPath throws when the path tries to descend past a text node", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hi")])]);
    expect(() => getNodeAtPath(doc, [0, 0, 0])).toThrow(/cannot descend into a text node/);
  });

  it("firstTextEntry finds the first leaf, or undefined when there is none", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("first"), createText("second")])
    ]);
    expect(firstTextEntry(doc)).toEqual({ node: { object: "text", text: "first", marks: [] }, path: [0, 0] });
    expect(firstTextEntry(createDocument([createElement("horizontalRule", {}, [])]))).toBeUndefined();
  });

  it("isTextNode / isElementNode narrow by the object discriminant", () => {
    const textNode = createText("hi");
    const element = createElement("paragraph");
    expect(isTextNode(textNode)).toBe(true);
    expect(isTextNode(element)).toBe(false);
    expect(isElementNode(element)).toBe(true);
    expect(isElementNode(textNode)).toBe(false);
  });

  it("isVoid is true only for an element node whose type is in the given set", () => {
    const voidTypes = new Set(["image", "horizontalRule"]);
    expect(isVoid(createElement("image"), voidTypes)).toBe(true);
    expect(isVoid(createElement("paragraph"), voidTypes)).toBe(false);
    expect(isVoid(createText("hi"), voidTypes)).toBe(false);
  });
});
