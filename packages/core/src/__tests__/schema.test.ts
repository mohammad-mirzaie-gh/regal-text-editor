import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText } from "../model/node";
import { Schema } from "../schema/schema";
import { defineNode } from "../schema/types";

function buildSchema(): Schema {
  return new Schema({
    defaultBlockType: "paragraph",
    nodes: [
      defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true }),
      defineNode({ name: "heading", group: "block", content: "inline*", marks: "_", isTextBlock: true }),
      defineNode({ name: "blockquote", group: "block", content: "block+" })
    ],
    marks: [{ name: "bold" }]
  });
}

describe("Schema", () => {
  it("accepts a valid document", () => {
    const schema = buildSchema();
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    expect(schema.validate(doc)).toEqual([]);
  });

  it("flags an empty document", () => {
    const schema = buildSchema();
    const doc = createDocument([]);
    const errors = schema.validate(doc);
    expect(errors.some((e) => e.code === "empty-document")).toBe(true);
  });

  it("flags a block container with no children", () => {
    const schema = buildSchema();
    const doc = createDocument([createElement("blockquote", {}, [])]);
    const errors = schema.validate(doc);
    expect(errors.some((e) => e.code === "invalid-child")).toBe(true);
  });

  it("flags an unknown mark type", () => {
    const schema = buildSchema();
    const doc = createDocument([
      createElement("paragraph", {}, [createText("x", [{ type: "underline", attrs: {} }])])
    ]);
    const errors = schema.validate(doc);
    expect(errors.some((e) => e.code === "unknown-mark-type")).toBe(true);
  });

  it("accepts nested valid content", () => {
    const schema = buildSchema();
    const doc = createDocument([
      createElement("blockquote", {}, [createElement("paragraph", {}, [createText("quoted")])])
    ]);
    expect(schema.validate(doc)).toEqual([]);
  });
});
