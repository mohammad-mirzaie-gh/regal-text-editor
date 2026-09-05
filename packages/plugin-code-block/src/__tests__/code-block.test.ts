import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor } from "@rte/core";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { CodeBlockPlugin } from "../index";

function makeEditor(): Editor {
  return new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin(), CodeBlockPlugin()] });
}

describe("toggleCodeBlock", () => {
  it("execute returns false with no selection", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.execute(editor, "toggleCodeBlock")).toBe(false);
  });

  it("canExecute is false with no selection, true with one", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.canExecute(editor, "toggleCodeBlock")).toBe(false);
    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.canExecute(editor, "toggleCodeBlock")).toBe(true);
  });

  it("turns a paragraph into a code block and back", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>const x = 1;</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "toggleCodeBlock")).toBe(true);
    expect(editor.getHTML()).toBe("<pre><code>const x = 1;</code></pre>");
    expect(editor.commands.execute(editor, "toggleCodeBlock")).toBe(true);
    expect(editor.getHTML()).toBe("<p>const x = 1;</p>");
  });

  it("isActive is false with no selection, tracks the code block state otherwise", () => {
    const editor = makeEditor();
    editor.setSelection(null);
    expect(editor.commands.isActive(editor, "toggleCodeBlock")).toBe(false);

    editor.setContent({ html: "<p>hi</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.isActive(editor, "toggleCodeBlock")).toBe(false);

    editor.commands.execute(editor, "toggleCodeBlock");
    expect(editor.commands.isActive(editor, "toggleCodeBlock")).toBe(true);
  });
});

describe("HTML export", () => {
  it("renders <br> in place of empty content", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p></p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleCodeBlock");
    expect(editor.getHTML()).toBe("<pre><code><br></code></pre>");
  });
});

describe("Markdown export", () => {
  it("wraps content in a fenced code block", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>const x = 1;</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleCodeBlock");
    expect(editor.getMarkdown()).toBe("```\nconst x = 1;\n```");
  });
});

describe("HTML import (extractPreformattedText)", () => {
  it("preserves whitespace verbatim instead of collapsing it", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<pre>  two  spaces</pre>" });
    expect(editor.getText()).toBe("  two  spaces");
  });

  it("converts a <br> element to a literal newline", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<pre>line one<br>line two</pre>" });
    expect(editor.getText()).toBe("line one\nline two");
  });

  it("recurses into nested elements (e.g. a <code> wrapper) collecting their text too", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<pre><code>const x = 1;</code></pre>" });
    expect(editor.getText()).toBe("const x = 1;");
  });

  it("passes literal newline characters already in the text through untouched", () => {
    const editor = makeEditor();
    const doc = {
      object: "document" as const,
      id: "d",
      children: [{ object: "element" as const, id: "c", type: "codeBlock", attrs: {}, children: [{ object: "text" as const, text: "a\nb", marks: [] }] }]
    };
    editor.setContent(doc);
    expect(editor.getText()).toBe("a\nb");
  });
});
