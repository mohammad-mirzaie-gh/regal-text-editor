import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText } from "../model/node";
import { SerializerRegistry } from "../serialization/registry";
import { toHTML } from "../serialization/html";
import { toMarkdown } from "../serialization/markdown";

const bold = { type: "bold", attrs: {} };

describe("toHTML", () => {
  it("delegates to a registered node serializer", () => {
    const registry = new SerializerRegistry();
    registry.registerNode("paragraph", (_node, children) => `<p>${children.join("")}</p>`);
    const doc = createDocument([createElement("paragraph", {}, [createText("hi")])]);
    expect(toHTML(doc, registry)).toBe("<p>hi</p>");
  });

  it("falls back to a generic tagged <div> for an unregistered node type", () => {
    const registry = new SerializerRegistry();
    const doc = createDocument([createElement("mystery", {}, [createText("hi")])]);
    expect(toHTML(doc, registry)).toBe('<div data-node-type="mystery">hi</div>');
  });

  it("escapes text and delegates to a registered mark serializer", () => {
    const registry = new SerializerRegistry();
    registry.registerNode("paragraph", (_node, children) => children.join(""));
    registry.registerMark("bold", (_mark, content) => `<strong>${content}</strong>`);
    const doc = createDocument([createElement("paragraph", {}, [createText("<hi> & you", [bold])])]);
    expect(toHTML(doc, registry)).toBe("<strong>&lt;hi&gt; &amp; you</strong>");
  });

  it("leaves an unregistered mark's text as-is (still escaped)", () => {
    const registry = new SerializerRegistry();
    registry.registerNode("paragraph", (_node, children) => children.join(""));
    const doc = createDocument([createElement("paragraph", {}, [createText("hi", [bold])])]);
    expect(toHTML(doc, registry)).toBe("hi");
  });

  it("converts embedded newlines to <br>", () => {
    const registry = new SerializerRegistry();
    registry.registerNode("paragraph", (_node, children) => children.join(""));
    const doc = createDocument([createElement("paragraph", {}, [createText("a\nb")])]);
    expect(toHTML(doc, registry)).toBe("a<br>b");
  });
});

describe("toMarkdown", () => {
  it("delegates to a registered node serializer", () => {
    const registry = new SerializerRegistry();
    registry.registerNode("heading", (_node, children) => `# ${children.join("")}`);
    const doc = createDocument([createElement("heading", {}, [createText("Title")])]);
    expect(toMarkdown(doc, registry)).toBe("# Title");
  });

  it("joins an unregistered node's text children directly (no element children)", () => {
    const registry = new SerializerRegistry();
    const doc = createDocument([createElement("mystery", {}, [createText("a"), createText("b")])]);
    expect(toMarkdown(doc, registry)).toBe("ab");
  });

  it("joins an unregistered node's element children with blank lines", () => {
    const registry = new SerializerRegistry();
    registry.registerNode("paragraph", (_node, children) => children.join(""));
    const doc = createDocument([
      createElement("mystery", {}, [
        createElement("paragraph", {}, [createText("one")]),
        createElement("paragraph", {}, [createText("two")])
      ])
    ]);
    expect(toMarkdown(doc, registry)).toBe("one\n\ntwo");
  });

  it("delegates mark serialization and trims the final result", () => {
    const registry = new SerializerRegistry();
    registry.registerNode("paragraph", (_node, children) => children.join(""));
    registry.registerMark("bold", (_mark, content) => `**${content}**`);
    const doc = createDocument([createElement("paragraph", {}, [createText("hi", [bold])])]);
    expect(toMarkdown(doc, registry)).toBe("**hi**");
  });
});
