import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText } from "../model/node";
import { Schema } from "../schema/schema";
import { defineNode } from "../schema/types";
import { sliceDocument } from "../transforms/slice";

function schema(): Schema {
  return new Schema({
    defaultBlockType: "paragraph",
    nodes: [defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true })],
    marks: []
  });
}

describe("sliceDocument", () => {
  it("extracts a range spanning multiple blocks without mutating the source", () => {
    const doc = createDocument([
      createElement("paragraph", {}, [createText("hello world")]),
      createElement("paragraph", {}, [createText("second block")]),
      createElement("paragraph", {}, [createText("third one")])
    ]);
    const slice = sliceDocument(doc, schema(), { path: [0, 0], offset: 6 }, { path: [2, 0], offset: 5 });
    expect(slice).toHaveLength(3);
    expect((slice[0]!.children[0] as { text: string }).text).toBe("world");
    expect((slice[1]!.children[0] as { text: string }).text).toBe("second block");
    expect((slice[2]!.children[0] as { text: string }).text).toBe("third");
    // original untouched
    expect((doc.children[0]!.children[0] as { text: string }).text).toBe("hello world");
  });
});
