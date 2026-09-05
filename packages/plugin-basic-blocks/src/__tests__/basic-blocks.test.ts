import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor } from "@regal-text-editor/core";
import { CodeBlockPlugin } from "@regal-text-editor/plugin-code-block";
import { BasicBlocksPlugin } from "../index";

function makeEditor(): Editor {
  return new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin()] });
}

describe("setParagraph / setHeading*", () => {
  it("execute returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "setHeading1")).toBe(false);
  });

  it("canExecute is false with no selection, true with one", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "setHeading1")).toBe(false);
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.canExecute(editor, "setHeading1")).toBe(true);
  });

  it("changes a paragraph into a heading and back", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "setHeading2")).toBe(true);
    expect(editor.getHTML()).toBe("<h2>hi</h2>");
    expect(editor.commands.execute(editor, "setParagraph")).toBe(true);
    expect(editor.getHTML()).toBe("<p>hi</p>");
  });

  it("isActive is false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.isActive(editor, "setHeading1")).toBe(false);
  });

  it("isActive matches both the node type and the given attrs (e.g. heading level)", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<h2>hi</h2>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.isActive(editor, "setHeading2")).toBe(true);
    expect(editor.commands.isActive(editor, "setHeading3")).toBe(false);
    expect(editor.commands.isActive(editor, "setParagraph")).toBe(false);
  });

  it("respects a custom headingLevels config", () => {
    const editor = new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin({ headingLevels: [1, 2] })] });
    expect(editor.commands.has("setHeading1")).toBe(true);
    expect(editor.commands.has("setHeading2")).toBe(true);
    expect(editor.commands.has("setHeading3")).toBe(false);
  });
});

describe("toggleBlockquote", () => {
  it("execute returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "toggleBlockquote")).toBe(false);
  });

  it("canExecute is false with no selection, true with one", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "toggleBlockquote")).toBe(false);
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.canExecute(editor, "toggleBlockquote")).toBe(true);
  });

  it("isActive is false with no selection, true/false based on blockquote ancestry", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.isActive(editor, "toggleBlockquote")).toBe(false);

    editor.setContent({ html: "<blockquote><p>hi</p></blockquote>" });
    editor.setSelection(cursor({ path: [0, 0, 0], offset: 0 }));
    expect(editor.commands.isActive(editor, "toggleBlockquote")).toBe(true);

    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.isActive(editor, "toggleBlockquote")).toBe(false);
  });
});

describe("setTextAlign", () => {
  it("execute rejects a missing/invalid align value", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "setTextAlign")).toBe(false);
    expect(editor.commands.execute(editor, "setTextAlign", "sideways")).toBe(false);
  });

  it("execute returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "setTextAlign", "center")).toBe(false);
  });

  it("execute returns false on a text block type outside ALIGNABLE_TYPES (e.g. a code block)", () => {
    const editor = new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin(), CodeBlockPlugin()] });
    editor.setContent({ html: "<pre>code</pre>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "setTextAlign", "center")).toBe(false);
    expect(editor.commands.canExecute(editor, "setTextAlign")).toBe(false);
  });

  it("canExecute reflects whether the current block is alignable", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "setTextAlign")).toBe(false);
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.canExecute(editor, "setTextAlign")).toBe(true);
  });

  it("sets and reports the align attribute, defaulting isActive's arg to 'start'", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.isActive(editor, "setTextAlign")).toBe(true); // default "start", matches
    editor.commands.execute(editor, "setTextAlign", "center");
    expect(editor.commands.isActive(editor, "setTextAlign", "center")).toBe(true);
    expect(editor.commands.isActive(editor, "setTextAlign")).toBe(false);
  });

  it("isActive is false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.isActive(editor, "setTextAlign", "center")).toBe(false);
  });

  it("renders no inline style for the default 'start' alignment, but does for others", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    expect(editor.getHTML()).toBe("<p>hi</p>");
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "setTextAlign", "center");
    expect(editor.getHTML()).toBe('<p style="text-align:center">hi</p>');
    editor.commands.execute(editor, "setTextAlign", "justify");
    expect(editor.getHTML()).toBe('<p style="text-align:justify">hi</p>');
  });

  it("also aligns headings", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<h1>hi</h1>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "setTextAlign", "end");
    expect(editor.getHTML()).toBe('<h1 style="text-align:end">hi</h1>');
  });
});

describe("insertHorizontalRule", () => {
  it("execute returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "insertHorizontalRule")).toBe(false);
  });

  it("canExecute is false with no selection, true with one", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "insertHorizontalRule")).toBe(false);
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.canExecute(editor, "insertHorizontalRule")).toBe(true);
  });

  it("inserts an <hr> after the current block, followed by a fresh paragraph, and moves the cursor into it", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(editor.commands.execute(editor, "insertHorizontalRule")).toBe(true);
    expect(editor.getHTML()).toBe("<p>hi</p><hr><p><br></p>");
    expect(editor.getSelection()).toEqual(cursor({ path: [2, 0], offset: 0 }));
  });
});

describe("Markdown export", () => {
  it("renders heading, blockquote and horizontal rule Markdown", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<h2>Title</h2><blockquote><p>one</p><p>two</p></blockquote><hr><p>after</p>" });
    expect(editor.getMarkdown()).toBe("## Title\n\n> one\n>\n> two\n\n---\n\nafter");
  });

  it("prefixes every line of multi-line blockquote content with '>' and uses a bare '>' for blank lines", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<blockquote><p>line one</p><p></p><p>line two</p></blockquote>" });
    expect(editor.getMarkdown()).toBe("> line one\n>\n>\n>\n> line two");
  });
});

describe("HTML import", () => {
  it("parses left/right/center/justify text-align, mapping left/right to start/end", () => {
    const editor = makeEditor();
    editor.setContent({
      html:
        '<p style="text-align:left">a</p><p style="text-align:right">b</p><p style="text-align:center">c</p><p style="text-align:justify">d</p>'
    });
    expect(editor.getHTML()).toBe(
      '<p>a</p><p style="text-align:end">b</p><p style="text-align:center">c</p><p style="text-align:justify">d</p>'
    );
  });

  it("ignores an invalid or missing text-align value", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p style="text-align:sideways">a</p><p>b</p>' });
    expect(editor.getHTML()).toBe("<p>a</p><p>b</p>");
  });

  it("parses all six heading levels with their own align", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<h1>a</h1><h6>b</h6>" });
    expect(editor.getHTML()).toBe("<h1>a</h1><h6>b</h6>");
  });

  it("parses a sole <br> as an empty text block, not a literal newline", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p><br></p>" });
    expect(editor.getText()).toBe("");
    expect(editor.getHTML()).toBe("<p><br></p>");
  });

  it("parses <hr> into a horizontalRule node", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>a</p><hr><p>b</p>" });
    expect(editor.getHTML()).toBe("<p>a</p><hr><p>b</p>");
  });
});
