import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor } from "@rte/core";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { getActiveLinkHref, LinkPlugin } from "../index";

function makeEditor(): Editor {
  return new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin(), LinkPlugin()] });
}

function rangeOf(startOffset: number, endOffset: number, path: number[] = [0, 0]) {
  return { type: "range" as const, anchor: { path, offset: startOffset }, focus: { path, offset: endOffset } };
}

describe("setLink", () => {
  it("rejects a missing or empty href", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection(rangeOf(0, 5));
    expect(editor.commands.execute(editor, "setLink")).toBe(false);
    expect(editor.commands.execute(editor, "setLink", "")).toBe(false);
    expect(editor.commands.execute(editor, "setLink", 42)).toBe(false);
  });

  it("rejects a collapsed selection (nothing to carry the link)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(editor.commands.execute(editor, "setLink", "https://example.com")).toBe(false);
  });

  it("rejects a missing selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "setLink", "https://example.com")).toBe(false);
  });

  it("rejects an unsafe href without touching the model", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection(rangeOf(0, 5));
    expect(editor.commands.execute(editor, "setLink", "javascript:alert(1)")).toBe(false);
    expect(editor.getHTML()).toBe("<p>hello</p>");
  });

  it("canExecute is false with no selection or a collapsed one, true for a real range", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "setLink")).toBe(false);
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(editor.commands.canExecute(editor, "setLink")).toBe(false);
    editor.setSelection(rangeOf(0, 5));
    expect(editor.commands.canExecute(editor, "setLink")).toBe(true);
  });

  it("applies a link spanning exactly one block and restores the selection over it", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello world</p>" });
    editor.setSelection(rangeOf(0, 5));
    expect(editor.commands.execute(editor, "setLink", "https://example.com")).toBe(true);
    expect(editor.getHTML()).toBe('<p><a href="https://example.com" rel="noopener noreferrer">hello</a> world</p>');
    expect(editor.getSelection()).toEqual(rangeOf(0, 5));
  });

  it("applies a link spanning multiple blocks, falling back to the original selection object", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p><p>world</p>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [1, 0], offset: 5 } });
    expect(editor.commands.execute(editor, "setLink", "https://example.com")).toBe(true);
    expect(editor.getHTML()).toBe(
      '<p><a href="https://example.com" rel="noopener noreferrer">hello</a></p><p><a href="https://example.com" rel="noopener noreferrer">world</a></p>'
    );
  });

  it("isActive is false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.isActive(editor, "setLink")).toBe(false);
  });

  it("isActive at a collapsed cursor reflects the mark at that point", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="https://example.com">hello</a></p>' });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(editor.commands.isActive(editor, "setLink")).toBe(true);
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    // At offset 0 with no previous leaf, marksAtPoint falls back to the
    // leaf's own marks, which are the link's.
    expect(editor.commands.isActive(editor, "setLink")).toBe(true);
  });

  it("isActive over a range is 'mixed' -> false unless the whole range is linked", () => {
    const editor = makeEditor();
    // Two separate leaves: "hello" (linked) and " world" (not).
    editor.setContent({ html: '<p><a href="https://example.com">hello</a> world</p>' });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 1], offset: 6 } });
    expect(editor.commands.isActive(editor, "setLink")).toBe(false);
    editor.setSelection(rangeOf(0, 5));
    expect(editor.commands.isActive(editor, "setLink")).toBe(true);
  });
});

describe("unsetLink", () => {
  it("returns false with no selection or a collapsed one", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "unsetLink")).toBe(false);
    editor.setContent({ html: '<p><a href="https://example.com">hi</a></p>' });
    editor.setSelection(cursor({ path: [0, 0], offset: 1 }));
    expect(editor.commands.execute(editor, "unsetLink")).toBe(false);
  });

  it("canExecute mirrors setLink's isActive", () => {
    const editor = makeEditor();
    // Two separate leaves: "hello" (linked) and " world" (not).
    editor.setContent({ html: '<p><a href="https://example.com">hello</a> world</p>' });
    editor.setSelection(rangeOf(0, 5));
    expect(editor.commands.canExecute(editor, "unsetLink")).toBe(true);
    editor.setSelection({ type: "range", anchor: { path: [0, 1], offset: 0 }, focus: { path: [0, 1], offset: 6 } });
    expect(editor.commands.canExecute(editor, "unsetLink")).toBe(false);
  });

  it("removes the link mark spanning exactly one block", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="https://example.com">hello</a> world</p>' });
    editor.setSelection(rangeOf(0, 5));
    expect(editor.commands.execute(editor, "unsetLink")).toBe(true);
    expect(editor.getHTML()).toBe("<p>hello world</p>");
  });

  it("removes a link spanning multiple blocks, falling back to the original selection object", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="https://example.com">hello</a></p><p><a href="https://example.com">world</a></p>' });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [1, 0], offset: 5 } });
    expect(editor.commands.execute(editor, "unsetLink")).toBe(true);
    expect(editor.getHTML()).toBe("<p>hello</p><p>world</p>");
  });
});

describe("getActiveLinkHref", () => {
  it("returns null with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(getActiveLinkHref(editor)).toBeNull();
  });

  it("returns null when the cursor isn't on a link", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(getActiveLinkHref(editor)).toBeNull();
  });

  it("returns the href at a collapsed cursor inside a link", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="https://example.com">hello</a></p>' });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(getActiveLinkHref(editor)).toBe("https://example.com");
  });

  it("returns the href of the first overlapping leaf for a non-collapsed selection right after applying a link", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello world</p>" });
    editor.setSelection(rangeOf(0, 5));
    editor.commands.execute(editor, "setLink", "https://example.com");
    expect(getActiveLinkHref(editor)).toBe("https://example.com");
  });

  it("returns null for a non-collapsed selection with no overlapping link", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello world</p>" });
    editor.setSelection(rangeOf(0, 5));
    expect(getActiveLinkHref(editor)).toBeNull();
  });
});

describe("HTML/Markdown export", () => {
  it("renders a title attribute when present", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="https://example.com" title="Example">hi</a></p>' });
    expect(editor.getHTML()).toBe('<p><a href="https://example.com" title="Example" rel="noopener noreferrer">hi</a></p>');
  });

  it("renders no title attribute when absent", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="https://example.com">hi</a></p>' });
    expect(editor.getHTML()).toBe('<p><a href="https://example.com" rel="noopener noreferrer">hi</a></p>');
  });

  it("sanitizes the href on export even if it somehow reached the model unsafely", () => {
    const editor = makeEditor();
    // setContent's own HTML parser already sanitizes on import (see below),
    // so this exercises the export-side sanitizeUrl call directly.
    editor.setContent({ html: '<p><a href="https://example.com">hi</a></p>' });
    const doc = editor.getJSON();
    const textNode = doc.children[0]!.children[0] as unknown as { marks: { attrs: { href: string } }[] };
    textNode.marks[0]!.attrs.href = "javascript:alert(1)";
    editor.setContent(doc);
    expect(editor.getHTML()).toBe('<p><a href="" rel="noopener noreferrer">hi</a></p>');
  });

  it("renders Markdown link syntax", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="https://example.com">hi</a></p>' });
    expect(editor.getMarkdown()).toBe("[hi](https://example.com)");
  });

  it("sanitizes an unsafe href on HTML import", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="javascript:alert(1)">hi</a></p>' });
    expect(editor.getHTML()).toBe('<p><a href="" rel="noopener noreferrer">hi</a></p>');
  });
});
