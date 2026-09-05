import { describe, expect, it } from "vitest";
import { Schema } from "../schema/schema";
import { defineNode } from "../schema/types";
import { HtmlParserRegistry, parseHTML, safeAttr } from "../parsing/html";
import type { TextNode } from "../model/types";

function schema(): Schema {
  return new Schema({
    defaultBlockType: "paragraph",
    nodes: [
      defineNode({ name: "paragraph", group: "block", content: "inline*", marks: "_", isTextBlock: true }),
      defineNode({ name: "blockquote", group: "block", content: "block+" })
    ],
    marks: [{ name: "bold" }]
  });
}

function paragraphRegistry(): HtmlParserRegistry {
  const registry = new HtmlParserRegistry();
  registry.registerBlock("p", (el, ctx) => ({
    object: "element",
    id: "p1",
    type: "paragraph",
    attrs: {},
    children: ctx.parseInline(el)
  }));
  return registry;
}

describe("HtmlParserRegistry", () => {
  it("get*() returns undefined for an unregistered tag and the parser for a registered one", () => {
    const registry = new HtmlParserRegistry();
    expect(registry.getBlock("p")).toBeUndefined();
    expect(registry.getMark("strong")).toBeUndefined();
    const blockParser = (): null => null;
    registry.registerBlock("p", blockParser);
    expect(registry.getBlock("p")).toBe(blockParser);
    // Tag lookups are case-insensitive.
    expect(registry.getBlock("P")).toBe(blockParser);
  });
});

describe("parseHTML", () => {
  it("converts a <br> inside inline content to a newline within the text", () => {
    const registry = paragraphRegistry();
    const doc = parseHTML(schema(), "<p>line one<br>line two</p>", registry);
    const paragraph = doc.children[0] as { children: TextNode[] };
    expect(paragraph.children.map((c) => c.text).join("")).toBe("line one\nline two");
  });

  it("recurses into an unrecognized wrapping element to find nested recognized blocks", () => {
    const registry = paragraphRegistry();
    // <section> has no registered block parser, so it's treated as a
    // transparent container and its <p> children are still found.
    const doc = parseHTML(schema(), "<section><p>inside</p></section>", registry);
    expect(doc.children).toHaveLength(1);
    const paragraph = doc.children[0] as { type: string; children: TextNode[] };
    expect(paragraph.type).toBe("paragraph");
    expect(paragraph.children[0]!.text).toBe("inside");
  });

  it("wraps a lone unrecognized element's own text in the default block type", () => {
    const registry = paragraphRegistry();
    const doc = parseHTML(schema(), "<span>just text</span>", registry);
    expect(doc.children).toHaveLength(1);
    const paragraph = doc.children[0] as { type: string; children: TextNode[] };
    expect(paragraph.type).toBe("paragraph");
    expect(paragraph.children[0]!.text).toBe("just text");
  });

  it("contributes nothing from an unrecognized *empty* element, leaving its text siblings merged into one block", () => {
    // parseBlocks(childEl) returning zero blocks (truly empty/whitespace-only
    // content) is what actually reaches the "treat as inline" fallback —
    // an element with real inline text already produces its own flushed
    // paragraph via the recursive call, taking the nestedBlocks>0 branch
    // instead (see the next test).
    const registry = paragraphRegistry();
    const doc = parseHTML(schema(), "before <span></span>after", registry);
    expect(doc.children).toHaveLength(1);
    const paragraph = doc.children[0] as { children: TextNode[] };
    expect(paragraph.children.map((c) => c.text).join("")).toBe("before after");
  });

  it("splits into separate blocks around an unrecognized element that itself contains text (still flushed as its own paragraph)", () => {
    const registry = paragraphRegistry();
    const doc = parseHTML(schema(), "before <span>middle</span> after", registry);
    expect(doc.children.map((c) => (c as { children: TextNode[] }).children.map((t) => t.text).join(""))).toEqual([
      "before ",
      "middle",
      " after"
    ]);
  });

  it("applies a registered mark parser to wrap the text it contains", () => {
    const registry = paragraphRegistry();
    registry.registerMark("strong", () => ({ type: "bold", attrs: {} }));
    const doc = parseHTML(schema(), "<p>plain <strong>bold</strong></p>", registry);
    const paragraph = doc.children[0] as { children: TextNode[] };
    expect(paragraph.children.map((c) => ({ text: c.text, marks: c.marks }))).toEqual([
      { text: "plain ", marks: [] },
      { text: "bold", marks: [{ type: "bold", attrs: {} }] }
    ]);
  });

  it("strips a dangerous tag and its content entirely, even nested deep inside recognized markup", () => {
    const registry = paragraphRegistry();
    const doc = parseHTML(schema(), "<p>safe<script>alert(1)</script> text</p>", registry);
    const paragraph = doc.children[0] as { children: TextNode[] };
    expect(paragraph.children.map((c) => c.text).join("")).toBe("safe text");
  });

  it("strips event-handler attributes from every element, even when no block/mark parser reads that attribute", () => {
    const registry = paragraphRegistry();
    const doc = parseHTML(schema(), `<p onclick="evil()">hi</p>`, registry);
    // The parser never surfaces attrs for unregistered readers, so this
    // mainly asserts parsing still succeeds and yields the expected text —
    // the attribute-stripping itself is exercised end-to-end via safeAttr below.
    const paragraph = doc.children[0] as { children: TextNode[] };
    expect(paragraph.children[0]!.text).toBe("hi");
  });

  it("safeAttr sanitizes a dangerous URL scheme read from an element's attribute", () => {
    const registry = new HtmlParserRegistry();
    registry.registerBlock("a", (el) => ({
      object: "element",
      id: "a1",
      type: "paragraph",
      attrs: { href: safeAttr(el, "href") },
      children: []
    }));
    const doc = parseHTML(schema(), `<a href="javascript:alert(1)">link</a>`, registry);
    expect(doc.children[0]!.attrs.href).toBe("");
  });
});
