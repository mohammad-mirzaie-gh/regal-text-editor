import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema } from "@rte/core";
import { extractPastedBlocks } from "../clipboard/paste";

function makeDataTransfer(data: Record<string, string>): DataTransfer {
  return {
    getData: (type: string) => data[type] ?? ""
  } as unknown as DataTransfer;
}

function makeEditor(): Editor {
  return new Editor({ schema: createBaseSchema(), plugins: [] });
}

describe("clipboard/extractPastedBlocks", () => {
  it("prefers text/html and parses it into blocks when present", () => {
    const editor = makeEditor();
    editor.htmlParserRegistry.registerBlock("p", (el, ctx) => ({
      object: "element",
      id: "x",
      type: "paragraph",
      attrs: {},
      children: ctx.parseInline(el)
    }));
    const blocks = extractPastedBlocks(editor, makeDataTransfer({ "text/html": "<p>hi</p>", "text/plain": "hi" }));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("paragraph");
  });

  it("falls back to plain text when text/html is empty", () => {
    const editor = makeEditor();
    const blocks = extractPastedBlocks(editor, makeDataTransfer({ "text/html": "", "text/plain": "hello" }));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("paragraph");
  });

  it("falls back to plain text when text/html is only whitespace", () => {
    const editor = makeEditor();
    const blocks = extractPastedBlocks(editor, makeDataTransfer({ "text/html": "   \n  ", "text/plain": "hello" }));
    expect(blocks).toHaveLength(1);
  });

  it("falls back to plain text when the parsed HTML produces no blocks", () => {
    const editor = makeEditor();
    // A <script> tag is stripped entirely by the sanitizer (isDangerousTag),
    // so parseHTML legitimately yields zero blocks here.
    const blocks = extractPastedBlocks(editor, makeDataTransfer({ "text/html": "<script>alert(1)</script>", "text/plain": "fallback text" }));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.children[0]).toMatchObject({ object: "text", text: "fallback text" });
  });

  it("splits plain text into one block per blank-line-separated paragraph", () => {
    const editor = makeEditor();
    const blocks = extractPastedBlocks(editor, makeDataTransfer({ "text/plain": "first\n\nsecond\n\n\nthird" }));
    expect(blocks.map((b) => (b.children[0] as { text: string }).text)).toEqual(["first", "second", "third"]);
  });

  it("normalizes CRLF and lone CR line endings before splitting", () => {
    const editor = makeEditor();
    const blocks = extractPastedBlocks(editor, makeDataTransfer({ "text/plain": "a\r\n\r\nb\rc" }));
    expect(blocks.map((b) => (b.children[0] as { text: string }).text)).toEqual(["a", "b\nc"]);
  });

  it("drops empty paragraphs produced by extra blank lines", () => {
    const editor = makeEditor();
    const blocks = extractPastedBlocks(editor, makeDataTransfer({ "text/plain": "\n\n\nonly\n\n\n" }));
    expect(blocks).toHaveLength(1);
  });

  it("returns an empty array when neither text/html nor text/plain has content", () => {
    const editor = makeEditor();
    const blocks = extractPastedBlocks(editor, makeDataTransfer({}));
    expect(blocks).toEqual([]);
  });
});
