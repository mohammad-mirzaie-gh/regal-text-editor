import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor, type RangeSelection } from "@rte/core";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { LinkPlugin, getActiveLinkHref } from "@rte/plugin-link";
import { ImagePlugin } from "@rte/plugin-image";
import { CodeBlockPlugin } from "@rte/plugin-code-block";
import { EditorView } from "@rte/browser";

function makeEditor(): Editor {
  return new Editor({
    schema: createBaseSchema(),
    plugins: [BasicBlocksPlugin(), LinkPlugin(), ImagePlugin(), CodeBlockPlugin()]
  });
}

describe("plugin-link", () => {
  it("applies a link over a selection and reports it active", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>visit example</p>" });
    const selection: RangeSelection = { type: "range", anchor: { path: [0, 0], offset: 6 }, focus: { path: [0, 0], offset: 13 } };
    editor.setSelection(selection);
    expect(editor.commands.execute(editor, "setLink", "https://example.com")).toBe(true);
    expect(editor.getHTML()).toBe('<p>visit <a href="https://example.com" rel="noopener noreferrer">example</a></p>');
    expect(editor.commands.isActive(editor, "setLink")).toBe(true);
    expect(getActiveLinkHref(editor)).toBe("https://example.com");
  });

  it("rejects a javascript: href instead of writing it into the model", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>click me</p>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    expect(editor.commands.execute(editor, "setLink", "javascript:alert(1)")).toBe(false);
    expect(editor.getHTML()).toBe("<p>click me</p>");
  });

  it("removes a link via unsetLink", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p><a href="https://example.com">example</a></p>' });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 7 } });
    expect(editor.commands.execute(editor, "unsetLink")).toBe(true);
    expect(editor.getHTML()).toBe("<p>example</p>");
  });

  it("keeps the selection valid after unsetLink merges the unmarked leaf back into its neighbor (regression: stale post-transaction selection used to make clampSelection throw)", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p>visit <a href="https://example.com">example</a></p>' });
    // "example" is its own leaf (path [0,1]); selecting exactly it and then
    // removing the mark merges it back into the plain "visit " leaf at
    // [0,0], so a selection still referencing [0,1] afterwards is stale.
    editor.setSelection({ type: "range", anchor: { path: [0, 1], offset: 0 }, focus: { path: [0, 1], offset: 7 } });
    expect(editor.commands.execute(editor, "unsetLink")).toBe(true);
    expect(editor.getHTML()).toBe("<p>visit example</p>");
    expect(editor.getSelection()).not.toBeNull();
  });

  it("round-trips through HTML import", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<p>see <a href="https://example.com" title="Example">this</a></p>' });
    expect(editor.getHTML()).toContain('href="https://example.com"');
    expect(editor.getHTML()).toContain('title="Example"');
  });
});

describe("plugin-image", () => {
  it("inserts a block image after the current block, followed by a fresh paragraph", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    expect(editor.commands.execute(editor, "insertImage", "https://example.com/cat.png", "a cat")).toBe(true);
    expect(editor.getHTML()).toBe('<p>hello</p><img src="https://example.com/cat.png" alt="a cat"><p><br></p>');
  });

  it("rejects a data: src", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    expect(editor.commands.execute(editor, "insertImage", "data:text/html,evil")).toBe(false);
    expect(editor.getHTML()).toBe("<p>hello</p>");
  });

  it("round-trips through HTML import", () => {
    const editor = makeEditor();
    editor.setContent({ html: '<img src="https://example.com/cat.png" alt="a cat" width="200">' });
    expect(editor.getHTML()).toBe('<img src="https://example.com/cat.png" alt="a cat" width="200">');
  });
});

describe("plugin-code-block", () => {
  it("toggles a paragraph into a code block and back", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>const x = 1;</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    expect(editor.commands.execute(editor, "toggleCodeBlock")).toBe(true);
    expect(editor.getHTML()).toBe("<pre><code>const x = 1;</code></pre>");
    expect(editor.commands.isActive(editor, "toggleCodeBlock")).toBe(true);

    expect(editor.commands.execute(editor, "toggleCodeBlock")).toBe(true);
    expect(editor.getHTML()).toBe("<p>const x = 1;</p>");
  });

  it("inserts a literal line break on Enter instead of splitting the block", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<p>line one</p>" });
    editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    editor.commands.execute(editor, "toggleCodeBlock");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const view = new EditorView({ editor, container });

    editor.setSelection(cursor({ path: [0, 0], offset: 8 }));
    const event = new InputEvent("beforeinput", { inputType: "insertParagraph", cancelable: true, bubbles: true });
    container.dispatchEvent(event);

    expect(editor.getHTML()).toBe("<pre><code>line one<br></code></pre>");
    expect(editor.getJSON().children).toHaveLength(1);

    view.destroy();
    container.remove();
  });

  it("preserves indentation and converts <br> to newlines on HTML import", () => {
    const editor = makeEditor();
    editor.setContent({ html: "<pre><code>function f() {\n  return 1;\n}</code></pre>" });
    expect(editor.getText()).toBe("function f() {\n  return 1;\n}");

    const editor2 = makeEditor();
    editor2.setContent({ html: "<pre><code>a<br>b</code></pre>" });
    expect(editor2.getText()).toBe("a\nb");
  });
});
