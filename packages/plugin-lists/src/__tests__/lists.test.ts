import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor } from "@rte/core";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { ListsPlugin } from "../index";

// A list item's content is bare "block+", and a paragraph is the natural,
// near-universal case — @rte/plugin-basic-blocks supplies the paragraph
// HTML/Markdown serializers these tests render through, the same pairing
// the example app and _integration-tests use.
function makeEditor(): Editor {
  return new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin(), ListsPlugin()] });
}

describe("toggleBulletList / toggleOrderedList", () => {
  it("isActive is false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.isActive(editor, "toggleBulletList")).toBe(false);
  });

  it("isActive is false outside any list", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.isActive(editor, "toggleBulletList")).toBe(false);
  });

  it("canExecute is false with no selection, true with one", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "toggleBulletList")).toBe(false);
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.canExecute(editor, "toggleBulletList")).toBe(true);
  });

  it("execute() returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "toggleBulletList")).toBe(false);
  });

  it("wraps a plain paragraph into a new single-item list", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 1 }));
    expect(editor.commands.execute(editor, "toggleBulletList")).toBe(true);
    expect(editor.getHTML()).toBe("<ul><li><p>hi</p></li></ul>");
    expect(editor.commands.isActive(editor, "toggleBulletList")).toBe(true);
  });

  it("switches an existing list item's list type in place (e.g. bullet -> ordered)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>hi</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "toggleOrderedList")).toBe(true);
    expect(editor.getHTML()).toBe("<ol><li><p>hi</p></li></ol>");
  });

  it("toggling the same list type off dissolves the whole list back to plain blocks", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>one</p></li><li><p>two</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "toggleBulletList")).toBe(true);
    expect(editor.getHTML()).toBe("<p>one</p><p>two</p>");
  });
});

describe("listEnter", () => {
  it("returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "listEnter")).toBe(false);
  });

  it("returns false for a non-collapsed selection", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>hi</p></li></ul>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0, 0, 0], offset: 0 }, focus: { path: [0, 0, 0, 0], offset: 2 } });
    expect(editor.commands.execute(editor, "listEnter")).toBe(false);
  });

  it("returns false when the cursor isn't inside a list item", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 1 }));
    expect(editor.commands.execute(editor, "listEnter")).toBe(false);
  });

  it("splits the item into a new sibling item when its text block isn't empty", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>hello</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 5 }));
    expect(editor.commands.execute(editor, "listEnter")).toBe(true);
    expect(editor.getHTML()).toBe("<ul><li><p>hello</p></li><li><p><br></p></li></ul>");
  });

  it("exits the list into a plain paragraph when the current item's text block is empty", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>hello</p></li><li><p></p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 1, 0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "listEnter")).toBe(true);
    expect(editor.getHTML()).toBe("<ul><li><p>hello</p></li></ul><p><br></p>");
  });
});

describe("listIndent / listOutdent", () => {
  it("listIndent returns false with no selection, outside a list, or with nothing to indent into", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "listIndent")).toBe(false);

    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "listIndent")).toBe(false);

    editor.setContent({ html: "<ul><li><p>only item</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "listIndent")).toBe(false);
  });

  it("listIndent nests the item under its preceding sibling and preserves the cursor position", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>one</p></li><li><p>two</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 1, 0, 0], offset: 2 }));
    expect(editor.commands.execute(editor, "listIndent")).toBe(true);
    expect(editor.getHTML()).toBe("<ul><li><p>one</p><ul><li><p>two</p></li></ul></li></ul>");
    expect(editor.getSelection()).toEqual(cursor({ path: [0, 0, 1, 0, 0, 0], offset: 2 }));
  });

  it("listOutdent returns false with no selection, outside a list, or already at the top level", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "listOutdent")).toBe(false);

    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "listOutdent")).toBe(false);

    editor.setContent({ html: "<ul><li><p>only item</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "listOutdent")).toBe(false);
  });

  it("listOutdent moves a nested item back out and preserves the cursor position", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>one</p><ul><li><p>two</p></li></ul></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 1, 0, 0, 0], offset: 2 }));
    expect(editor.commands.execute(editor, "listOutdent")).toBe(true);
    expect(editor.getHTML()).toBe("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    expect(editor.getSelection()).toEqual(cursor({ path: [0, 1, 0, 0], offset: 2 }));
  });
});

describe("toggleTaskListItem", () => {
  it("execute returns false with no selection or outside a list", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "toggleTaskListItem")).toBe(false);

    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "toggleTaskListItem")).toBe(false);
  });

  it("isActive is false with no selection, outside a list, and when unchecked; true once checked", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.isActive(editor, "toggleTaskListItem")).toBe(false);

    editor.setContent({ html: "<ul><li><p>hi</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    expect(editor.commands.isActive(editor, "toggleTaskListItem")).toBe(false);

    editor.commands.execute(editor, "toggleTaskListItem");
    expect(editor.commands.isActive(editor, "toggleTaskListItem")).toBe(true);
  });

  it("toggles the checked attribute back and forth", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>hi</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleTaskListItem");
    expect(editor.getHTML()).toBe('<ul><li data-checked="true"><p>hi</p></li></ul>');
    editor.commands.execute(editor, "toggleTaskListItem");
    expect(editor.getHTML()).toBe('<ul><li data-checked="false"><p>hi</p></li></ul>');
  });
});

describe("HTML export", () => {
  it("emits an ordered list's start attribute only when it isn't 1", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ol><li><p>one</p></li></ol>" });
    expect(editor.getHTML()).toBe("<ol><li><p>one</p></li></ol>");

    const editor2 = makeEditor();
    editor2.setContent({ html: '<ol start="3"><li><p>three</p></li></ol>' });
    expect(editor2.getHTML()).toBe('<ol start="3"><li><p>three</p></li></ol>');
  });
});

describe("Markdown export", () => {
  it("prefixes bullet and ordered list items and indents wrapped/multi-line content", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>one</p></li><li><p>two</p></li></ul>" });
    expect(editor.getMarkdown()).toBe("- one\n- two");
  });

  it("prefixes a checked/unchecked task item with [x]/[ ]", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li><p>hi</p></li></ul>" });
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleTaskListItem");
    expect(editor.getMarkdown()).toBe("- [x] hi");
  });
});

describe("HTML import", () => {
  it("parses an <ol> without a start attribute as starting at 1", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ol><li><p>one</p></li></ol>" });
    expect(editor.getHTML()).toBe("<ol><li><p>one</p></li></ol>");
  });

  it("wraps a <li>'s loose inline content (no block children) in a paragraph", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li>just plain text</li></ul>" });
    expect(editor.getText()).toBe("just plain text");
    expect(editor.getHTML()).toContain("<li><p>");
  });
});
