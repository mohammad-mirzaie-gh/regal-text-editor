import { describe, expect, it } from "vitest";
import {
  Editor,
  createBaseSchema,
  cursor,
  insertTextAtSelection,
  normalizeSelection,
  type Point
} from "@rte/core";
import { BasicMarksPlugin } from "@rte/plugin-basic-marks";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { ListsPlugin } from "@rte/plugin-lists";
import { HistoryPlugin } from "@rte/plugin-history";

function makeEditor(): Editor {
  return new Editor({
    schema: createBaseSchema(),
    plugins: [BasicBlocksPlugin(), BasicMarksPlugin(), ListsPlugin(), HistoryPlugin()]
  });
}

function typeAt(editor: Editor, point: Point, text: string): Point {
  const tx = editor.createTransaction({ origin: "keyboard", historyGroup: "typing" });
  const range = normalizeSelection(cursor(point));
  const end = insertTextAtSelection(tx, editor.schema, range, text);
  tx.setSelection(cursor(end));
  editor.dispatch(tx);
  return end;
}

describe("full plugin stack", () => {
  it("types, bolds a selection, and exports matching HTML and Markdown", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "hello world");

    editor.setSelection({
      type: "range",
      anchor: { path: [0, 0], offset: 6 },
      focus: { path: [0, 0], offset: 11 }
    });
    editor.commands.execute(editor, "toggleBold");

    expect(editor.getHTML()).toBe("<p>hello <strong>world</strong></p>");
    expect(editor.getMarkdown()).toBe("hello **world**");
    expect(editor.commands.isActive(editor, "toggleBold")).toBe(true);
  });

  it("keeps the selection valid after un-bolding exactly a bolded run merges it back into its neighbor (regression: a selection restored from pre-normalization paths used to make clampSelection throw)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>visit <strong>example</strong></p>" });
    // "example" is its own leaf (path [0,1]); selecting exactly it and
    // toggling bold off merges it back into the plain "visit " leaf at
    // [0,0], so a selection still referencing [0,1] afterwards is stale.
    editor.setSelection({ type: "range", anchor: { path: [0, 1], offset: 0 }, focus: { path: [0, 1], offset: 7 } });
    editor.commands.execute(editor, "toggleBold");
    expect(editor.getHTML()).toBe("<p>visit example</p>");
    expect(editor.getSelection()).not.toBeNull();
  });

  it("converts a paragraph to a heading and back", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "Title");
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "setHeading2");
    expect(editor.getHTML()).toBe("<h2>Title</h2>");
    expect(editor.getMarkdown()).toBe("## Title");

    editor.commands.execute(editor, "setParagraph");
    expect(editor.getHTML()).toBe("<p>Title</p>");
  });

  it("sets and reports text alignment on a paragraph, round-tripping through HTML", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "hello");
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));

    expect(editor.commands.execute(editor, "setTextAlign", "center")).toBe(true);
    expect(editor.getHTML()).toBe('<p style="text-align:center">hello</p>');
    expect(editor.commands.isActive(editor, "setTextAlign", "center")).toBe(true);
    expect(editor.commands.isActive(editor, "setTextAlign", "start")).toBe(false);

    editor.setContent({ html: editor.getHTML() });
    expect(editor.getHTML()).toBe('<p style="text-align:center">hello</p>');

    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "setTextAlign", "start")).toBe(true);
    expect(editor.getHTML()).toBe("<p>hello</p>");
  });

  it("wraps and unwraps a blockquote", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "quoted text");
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBlockquote");
    expect(editor.getHTML()).toBe("<blockquote><p>quoted text</p></blockquote>");

    editor.commands.execute(editor, "toggleBlockquote");
    expect(editor.getHTML()).toBe("<p>quoted text</p>");
  });

  it("unwraps a multi-paragraph blockquote without losing content (regression: unwrapBlocks used to corrupt/lose data for wrappers with 2+ children)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<blockquote><p>one</p><p>two</p><p>three</p></blockquote>" });
    editor.setSelection(cursor({ path: [0, 1, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBlockquote");
    expect(editor.getHTML()).toBe("<p>one</p><p>two</p><p>three</p>");

    // Toggling repeatedly must keep stabilizing, never corrupt further.
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBlockquote");
    editor.commands.execute(editor, "toggleBlockquote");
    expect(editor.getHTML()).toBe("<p>one</p><p>two</p><p>three</p>");
  });

  it("toggles a blockquote off from inside a list nested inside it, instead of nesting another blockquote around it forever (regression: the toggle only checked the block's IMMEDIATE parent for \"blockquote\", so a list sitting between the text and the blockquote hid it, and every click wrapped yet another blockquote around the outside)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<blockquote><ul><li>item</li></ul></blockquote>" });

    const textPath = [0, 0, 0, 0, 0];
    editor.setSelection(cursor({ path: textPath, offset: 0 }));
    editor.commands.execute(editor, "toggleBlockquote");
    expect(editor.getHTML()).toBe("<ul><li><p>item</p></li></ul>");

    // Toggling on/off repeatedly from inside the (now unwrapped) list must
    // keep alternating cleanly, never stacking up nested blockquotes.
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBlockquote");
    expect(editor.getHTML()).toBe("<blockquote><ul><li><p>item</p></li></ul></blockquote>");

    editor.setSelection(cursor({ path: [0, 0, 0, 0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBlockquote");
    expect(editor.getHTML()).toBe("<ul><li><p>item</p></li></ul>");
  });

  it("creates a bullet list, splits an item on Enter, and exits on empty Enter", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "first item");
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBulletList");
    expect(editor.getHTML()).toBe("<ul><li><p>first item</p></li></ul>");

    const selection = editor.getSelection();
    expect(selection).not.toBeNull();
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 11 }));
    editor.commands.execute(editor, "listEnter");
    const afterListEnter = editor.getSelection();
    typeAt(editor, afterListEnter!.type === "cursor" ? afterListEnter!.position : { path: [], offset: 0 }, "second item");
    expect(editor.getHTML()).toBe("<ul><li><p>first item</p></li><li><p>second item</p></li></ul>");

    // Enter on an empty third item exits the list back to a paragraph.
    editor.commands.execute(editor, "listEnter");
    editor.commands.execute(editor, "listEnter");
    expect(editor.getHTML()).toBe(
      "<ul><li><p>first item</p></li><li><p>second item</p></li></ul><p><br></p>"
    );
  });

  it("toggles a multi-item list back off without losing or orphaning items (regression: toggling off used to only unwrap the current item, leaving a schema-invalid list, then corrupt/lose content when dissolving it)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<ul><li>a</li><li>b</li><li>c</li></ul>" });

    editor.setSelection(cursor({ path: [0, 1, 0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBulletList");
    expect(editor.getHTML()).toBe("<p>a</p><p>b</p><p>c</p>");

    // Toggling back on then off again must keep stabilizing, not compound.
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBulletList");
    editor.commands.execute(editor, "toggleBulletList");
    expect(editor.getHTML()).toBe("<p>a</p><p>b</p><p>c</p>");
  });

  it("indents and outdents a list item into a nested list", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "one");
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBulletList");
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 3 }));
    editor.commands.execute(editor, "listEnter");
    const afterNestedListEnter = editor.getSelection();
    typeAt(editor, afterNestedListEnter!.type === "cursor" ? afterNestedListEnter!.position : { path: [], offset: 0 }, "two");

    editor.setSelection(cursor({ path: [0, 1, 0, 0], offset: 0 }));
    const indented = editor.commands.execute(editor, "listIndent");
    expect(indented).toBe(true);
    expect(editor.getHTML()).toBe("<ul><li><p>one</p><ul><li><p>two</p></li></ul></li></ul>");

    const outdented = editor.commands.execute(editor, "listOutdent");
    expect(outdented).toBe(true);
    expect(editor.getHTML()).toBe("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
  });

  it("toggles a task list item's checked state", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "todo");
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleBulletList");
    editor.setSelection(cursor({ path: [0, 0, 0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleTaskListItem");
    expect(editor.commands.isActive(editor, "toggleTaskListItem")).toBe(true);
    expect(editor.getHTML()).toContain('data-checked="true"');
    expect(editor.getMarkdown()).toBe("- [x] todo");
  });

  it("round-trips through HTML import", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<h1>Title</h1><p>Some <strong>bold</strong> and <em>italic</em> text.</p><ul><li>a</li><li>b</li></ul>" });
    expect(editor.getText()).toContain("Title");
    expect(editor.getHTML()).toContain("<h1>Title</h1>");
    expect(editor.getHTML()).toContain("<strong>bold</strong>");
    expect(editor.getHTML()).toContain("<ul><li><p>a</p></li><li><p>b</p></li></ul>");
  });

  it("undo/redo covers a mixed sequence of typing and formatting commands", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "abc");
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "setHeading1");
    expect(editor.getHTML()).toBe("<h1>abc</h1>");

    expect(editor.undo()).toBe(true);
    expect(editor.getHTML()).toBe("<p>abc</p>");
    expect(editor.undo()).toBe(true);
    expect(editor.getText()).toBe("");
    expect(editor.redo()).toBe(true);
    expect(editor.getText()).toBe("abc");
    expect(editor.redo()).toBe(true);
    expect(editor.getHTML()).toBe("<h1>abc</h1>");
  });

  it("undo/redo shortcuts are wired through the history plugin", () => {
    const editor = makeEditor();
    typeAt(editor, { path: [0, 0], offset: 0 }, "x");
    expect(editor.keymap["Mod-z"]).toBe("undo");
    expect(editor.commands.execute(editor, "undo")).toBe(true);
    expect(editor.getText()).toBe("");
  });
});
