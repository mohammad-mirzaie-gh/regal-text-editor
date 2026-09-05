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

  it("flags an unknown node type", () => {
    const schema = buildSchema();
    const doc = createDocument([createElement("mystery", {}, [])]);
    const errors = schema.validate(doc);
    expect(errors.some((e) => e.code === "unknown-node-type")).toBe(true);
  });

  it("flags a top-level child that isn't in the block group", () => {
    const schema = new Schema({
      defaultBlockType: "paragraph",
      nodes: [
        defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true }),
        defineNode({ name: "span", group: "inline" })
      ]
    });
    const doc = createDocument([createElement("span", {}, [])]);
    const errors = schema.validate(doc);
    expect(errors.some((e) => e.code === "invalid-child" && e.path.length === 0)).toBe(true);
  });

  it("skips content validation for void nodes even with no children", () => {
    const schema = new Schema({
      defaultBlockType: "paragraph",
      nodes: [
        defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true }),
        defineNode({ name: "divider", group: "block", void: true })
      ]
    });
    const doc = createDocument([createElement("divider", {}, [])]);
    expect(schema.validate(doc)).toEqual([]);
  });

  it("throws when constructed with a defaultBlockType that isn't a registered node", () => {
    expect(
      () =>
        new Schema({
          defaultBlockType: "paragraph",
          nodes: [defineNode({ name: "heading", group: "block", content: "inline*", isTextBlock: true })]
        })
    ).toThrow(/defaultBlockType "paragraph" is not a registered node/);
  });

  describe("extend", () => {
    it("merges in additional nodes and marks while keeping the existing ones", () => {
      const schema = buildSchema();
      const extended = schema.extend({
        nodes: [defineNode({ name: "image", group: "block", void: true })],
        marks: [{ name: "italic" }]
      });
      expect(extended.nodes.has("paragraph")).toBe(true);
      expect(extended.nodes.has("image")).toBe(true);
      expect(extended.marks.has("bold")).toBe(true);
      expect(extended.marks.has("italic")).toBe(true);
    });

    it("keeps the original defaultBlockType when extend doesn't override it", () => {
      const schema = buildSchema();
      const extended = schema.extend({ nodes: [] });
      expect(extended.defaultBlockType).toBe("paragraph");
    });

    it("can override the defaultBlockType", () => {
      const schema = buildSchema();
      const extended = schema.extend({ defaultBlockType: "heading" });
      expect(extended.defaultBlockType).toBe("heading");
    });
  });

  describe("isVoid / isCode / isInline", () => {
    it("reports void, code, and inline flags from the node spec, false when absent or unknown", () => {
      const schema = new Schema({
        defaultBlockType: "paragraph",
        nodes: [
          defineNode({ name: "paragraph", group: "block", content: "inline*", isTextBlock: true }),
          defineNode({ name: "image", group: "block", void: true }),
          defineNode({ name: "codeBlock", group: "block", content: "inline*", code: true }),
          defineNode({ name: "span", group: "inline" })
        ]
      });
      expect(schema.isVoid("image")).toBe(true);
      expect(schema.isVoid("paragraph")).toBe(false);
      expect(schema.isVoid("does-not-exist")).toBe(false);
      expect(schema.isCode("codeBlock")).toBe(true);
      expect(schema.isCode("paragraph")).toBe(false);
      expect(schema.isInline("span")).toBe(true);
      expect(schema.isInline("paragraph")).toBe(false);
    });
  });

  describe("markAllowed", () => {
    it("allows any mark by default ('_')", () => {
      const schema = buildSchema();
      expect(schema.markAllowed("paragraph", "bold")).toBe(true);
      expect(schema.markAllowed("paragraph", "anything")).toBe(true);
    });

    it("disallows every mark when the node's marks rule is false", () => {
      const schema = new Schema({
        defaultBlockType: "paragraph",
        nodes: [
          defineNode({ name: "paragraph", group: "block", content: "inline*", isTextBlock: true }),
          defineNode({ name: "codeBlock", group: "block", content: "inline*", marks: false, code: true })
        ],
        marks: [{ name: "bold" }]
      });
      expect(schema.markAllowed("codeBlock", "bold")).toBe(false);
    });

    it("allows only the marks explicitly whitelisted in an array rule", () => {
      const schema = new Schema({
        defaultBlockType: "paragraph",
        nodes: [
          defineNode({ name: "paragraph", group: "block", content: "inline*", marks: ["bold"], isTextBlock: true })
        ],
        marks: [{ name: "bold" }, { name: "italic" }]
      });
      expect(schema.markAllowed("paragraph", "bold")).toBe(true);
      expect(schema.markAllowed("paragraph", "italic")).toBe(false);
    });

    it("defaults to allow-any for a node type that has no spec at all", () => {
      const schema = buildSchema();
      expect(schema.markAllowed("unregistered-type", "bold")).toBe(true);
    });
  });
});
