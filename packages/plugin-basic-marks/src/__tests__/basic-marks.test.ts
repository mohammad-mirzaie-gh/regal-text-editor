import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor } from "@regal-text-editor/core";
import { BasicBlocksPlugin } from "@regal-text-editor/plugin-basic-blocks";
import { BasicMarksPlugin, markDefinitions } from "../index";

function makeEditor(): Editor {
  return new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin(), BasicMarksPlugin()] });
}

describe("toggleBold (collapsed cursor / stored marks)", () => {
  it("execute returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "toggleBold")).toBe(false);
  });

  it("canExecute is false with no selection, true with one", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "toggleBold")).toBe(false);
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.canExecute(editor, "toggleBold")).toBe(true);
  });

  it("turns on a stored mark at a collapsed cursor, then off again on a second toggle", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 1 }));
    expect(editor.commands.isActive(editor, "toggleBold")).toBe(false);
    editor.commands.execute(editor, "toggleBold");
    expect(editor.getStoredMarks()).toEqual([{ type: "bold", attrs: {} }]);
    expect(editor.commands.isActive(editor, "toggleBold")).toBe(true);
    editor.commands.execute(editor, "toggleBold");
    expect(editor.getStoredMarks()).toEqual([]);
    expect(editor.commands.isActive(editor, "toggleBold")).toBe(false);
  });

  it("isActive at a collapsed cursor with no stored marks falls back to marksAtPoint", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p><strong>bold</strong></p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(editor.commands.isActive(editor, "toggleBold")).toBe(true);
  });

  it("isActive is false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.isActive(editor, "toggleBold")).toBe(false);
  });
});

describe("toggleBold (range)", () => {
  it("applies bold over a plain range, keeping the selection over the same text", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello world</p>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    editor.commands.execute(editor, "toggleBold");
    expect(editor.getHTML()).toBe("<p><strong>hello</strong> world</p>");
    expect(editor.getSelection()).toEqual({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
  });

  it("removes bold when the whole range is already bold, restoring the selection after the merge", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p><strong>hello</strong> world</p>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    editor.commands.execute(editor, "toggleBold");
    expect(editor.getHTML()).toBe("<p>hello world</p>");
    expect(editor.getSelection()).toEqual({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
  });

  it("supports a backward range selection (focus before anchor)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello world</p>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 5 }, focus: { path: [0, 0], offset: 0 } });
    editor.commands.execute(editor, "toggleBold");
    expect(editor.getHTML()).toBe("<p><strong>hello</strong> world</p>");
    expect(editor.getSelection()).toEqual({ type: "range", anchor: { path: [0, 0], offset: 5 }, focus: { path: [0, 0], offset: 0 } });
  });

  it("falls back to the original selection object for a range spanning multiple blocks", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p><p>world</p>" });
    const selection = { type: "range" as const, anchor: { path: [0, 0], offset: 0 }, focus: { path: [1, 0], offset: 5 } };
    editor.setSelection(selection);
    editor.commands.execute(editor, "toggleBold");
    expect(editor.getHTML()).toBe("<p><strong>hello</strong></p><p><strong>world</strong></p>");
    expect(editor.getSelection()).toEqual(selection);
  });

  it("isActive over a mixed range is false, over a fully-bold range is true", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p><strong>hello</strong> world</p>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 1], offset: 6 } });
    expect(editor.commands.isActive(editor, "toggleBold")).toBe(false);
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    expect(editor.commands.isActive(editor, "toggleBold")).toBe(true);
  });
});

describe("every mark definition registers a working toggle command", () => {
  for (const def of markDefinitions) {
    it(`${def.commandName} applies and removes the ${def.type} mark`, () => {
      const editor = makeEditor();
      editor.setContent({ html: "<p>hello</p>" });
      editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
      editor.commands.execute(editor, def.commandName);
      expect(editor.getHTML()).toBe(`<p>${def.toHtml("hello")}</p>`);
      editor.commands.execute(editor, def.commandName);
      expect(editor.getHTML()).toBe("<p>hello</p>");
    });
  }
});

describe("HTML import", () => {
  it("recognizes every alternate tag for a mark (e.g. <b> and <strong> both mean bold)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p><b>a</b><strike>b</strike><del>c</del></p>" });
    // "b" and "c" carry the identical (strikethrough) mark set, so
    // normalization merges them into one leaf/tag rather than two.
    expect(editor.getHTML()).toBe("<p><strong>a</strong><s>bc</s></p>");
  });
});

describe("Markdown export", () => {
  it("renders each mark's Markdown syntax where defined", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    editor.commands.execute(editor, "toggleBold");
    expect(editor.getMarkdown()).toBe("**hello**");
  });

  it("underline has no Markdown serializer, so it round-trips as plain text", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p><u>hello</u></p>" });
    expect(editor.getMarkdown()).toBe("hello");
  });
});
