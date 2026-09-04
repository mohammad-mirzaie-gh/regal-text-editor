import { describe, expect, it } from "vitest";
import { addMark, createDocument, createElement, createText, marksEqual, removeMark, walk } from "../model/node";

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
});
