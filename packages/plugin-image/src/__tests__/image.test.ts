import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor } from "@rte/core";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { ImagePlugin } from "../index";

function makeEditor(): Editor {
  return new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin(), ImagePlugin()] });
}

describe("insertImage", () => {
  it("rejects a missing, non-string, or empty src", () => {
    const editor = makeEditor();
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "insertImage")).toBe(false);
    expect(editor.commands.execute(editor, "insertImage", 42)).toBe(false);
    expect(editor.commands.execute(editor, "insertImage", "")).toBe(false);
  });

  it("rejects an unsafe src scheme", () => {
    const editor = makeEditor();
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "insertImage", "data:text/html,evil")).toBe(false);
  });

  it("returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "insertImage", "https://example.com/a.png")).toBe(false);
  });

  it("canExecute is false with no selection, true with one", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "insertImage")).toBe(false);
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.canExecute(editor, "insertImage")).toBe(true);
  });

  it("inserts the image after the current block with a defaulted empty alt", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(editor.commands.execute(editor, "insertImage", "https://example.com/a.png")).toBe(true);
    expect(editor.getHTML()).toBe('<p>hi</p><img src="https://example.com/a.png" alt=""><p><br></p>');
  });

  it("accepts an explicit alt text", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    editor.commands.execute(editor, "insertImage", "https://example.com/a.png", "a cat");
    expect(editor.getHTML()).toBe('<p>hi</p><img src="https://example.com/a.png" alt="a cat"><p><br></p>');
  });

  it("places the cursor in the fresh paragraph after the inserted image", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    editor.commands.execute(editor, "insertImage", "https://example.com/a.png");
    expect(editor.getSelection()).toEqual(cursor({ path: [2, 0], offset: 0 }));
  });
});

describe("HTML export", () => {
  it("renders a width attribute only when it's a number", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<img src="https://example.com/a.png" alt="x" width="200">' });
    expect(editor.getHTML()).toBe('<img src="https://example.com/a.png" alt="x" width="200">');
  });

  it("omits the width attribute when absent", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<img src="https://example.com/a.png" alt="x">' });
    expect(editor.getHTML()).toBe('<img src="https://example.com/a.png" alt="x">');
  });
});

describe("Markdown export", () => {
  it("renders standard image syntax", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<img src="https://example.com/a.png" alt="a cat">' });
    expect(editor.getMarkdown()).toBe("![a cat](https://example.com/a.png)");
  });
});

describe("HTML import", () => {
  it("ignores an <img> with no src attribute", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<img>" });
    expect(editor.getHTML()).toBe("<p><br></p>");
  });

  it("parses a valid numeric width attribute", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<img src="https://example.com/a.png" width="150">' });
    expect(editor.getHTML()).toBe('<img src="https://example.com/a.png" alt="" width="150">');
  });

  it("ignores a non-numeric width attribute", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<img src="https://example.com/a.png" width="not-a-number">' });
    expect(editor.getHTML()).toBe('<img src="https://example.com/a.png" alt="">');
  });

  it("defaults alt to an empty string when absent", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<img src="https://example.com/a.png">' });
    expect(editor.getHTML()).toBe('<img src="https://example.com/a.png" alt="">');
  });
});
