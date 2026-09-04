import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor } from "@rte/core";
import { EditorView, domPointToModel } from "@rte/browser";
import { BasicMarksPlugin } from "@rte/plugin-basic-marks";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { ListsPlugin } from "@rte/plugin-lists";
import { HistoryPlugin } from "@rte/plugin-history";

function makeView(): { editor: Editor; view: EditorView; container: HTMLElement } {
  const editor = new Editor({
    schema: createBaseSchema(),
    plugins: [BasicBlocksPlugin(), BasicMarksPlugin(), ListsPlugin(), HistoryPlugin()]
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const view = new EditorView({ editor, container });
  return { editor, view, container };
}

function fireBeforeInput(container: HTMLElement, inputType: string, data: string | null = null): InputEvent {
  const event = new InputEvent("beforeinput", { inputType, data, cancelable: true, bubbles: true });
  container.dispatchEvent(event);
  return event;
}

function setCollapsedSelection(container: HTMLElement, textNode: Text, offset: number): void {
  const selection = document.getSelection()!;
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  void container;
}

describe("EditorView (jsdom)", () => {
  let ctx: { editor: Editor; view: EditorView; container: HTMLElement };

  beforeEach(() => {
    ctx = makeView();
  });

  afterEach(() => {
    ctx.view.destroy();
    ctx.container.remove();
  });

  it("renders the initial document to the container", () => {
    expect(ctx.container.innerHTML).toBe("<p><br></p>");
  });

  it("re-renders when the editor's document changes", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    expect(ctx.container.textContent).toBe("hello");
  });

  it("handles insertText via beforeinput", () => {
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    const event = fireBeforeInput(ctx.container, "insertText", "hi");
    expect(event.defaultPrevented).toBe(true);
    expect(ctx.editor.getText()).toBe("hi");
    expect(ctx.container.textContent).toBe("hi");
  });

  it("handles deleteContentBackward by removing one character", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    fireBeforeInput(ctx.container, "deleteContentBackward");
    expect(ctx.editor.getText()).toBe("hell");
  });

  it("merges the previous block on backspace at the start of a block", () => {
    ctx.editor.setContent({ html: "<p>hello</p><p>world</p>" });
    ctx.editor.setSelection(cursor({ path: [1, 0], offset: 0 }));
    fireBeforeInput(ctx.container, "deleteContentBackward");
    expect(ctx.editor.getText()).toBe("helloworld");
  });

  it("splits the block on insertParagraph (Enter)", () => {
    ctx.editor.setContent({ html: "<p>hello world</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    fireBeforeInput(ctx.container, "insertParagraph");
    expect(ctx.editor.getHTML()).toBe("<p>hello</p><p> world</p>");
  });

  it("places the DOM caret in the new (empty) second paragraph after Enter at the end of a line, not back at the document start", () => {
    // Regression test: pressing Enter at the end of a line produces a
    // trailing empty paragraph. An empty leaf renders with no DOM text
    // node, which used to make the model<->DOM position mapping fail,
    // leave the DOM selection dangling on the (just-removed) old node, and
    // have the browser reset the caret to the very start of the document.
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    fireBeforeInput(ctx.container, "insertParagraph");

    expect(ctx.editor.getHTML()).toBe("<p>hello</p><p><br></p>");
    expect(ctx.editor.getSelection()).toEqual(cursor({ path: [1, 0], offset: 0 }));

    const domSelection = document.getSelection()!;
    const paragraphs = ctx.container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    // The caret must anchor inside/at the second paragraph, never the first.
    expect(paragraphs[0]!.contains(domSelection.anchorNode)).toBe(false);
    expect(domSelection.anchorNode === paragraphs[1] || paragraphs[1]!.contains(domSelection.anchorNode)).toBe(true);

    // And typing immediately after must land in the new paragraph, not the first.
    fireBeforeInput(ctx.container, "insertText", "world");
    expect(ctx.editor.getHTML()).toBe("<p>hello</p><p>world</p>");
  });

  it("resolves a selection landing directly on/inside the <br> filler of an empty block (a real browser's hit-testing behavior jsdom's setBaseAndExtent doesn't reproduce, but selectionchange handling must still cope with)", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    fireBeforeInput(ctx.container, "insertParagraph");

    const secondParagraph = ctx.container.querySelectorAll("p")[1]!;
    const br = secondParagraph.querySelector("br")!;

    // Variant 1: the browser reports the <br> element itself as the anchor.
    expect(domPointToModel(ctx.editor, ctx.container, br, 0)).toEqual({ path: [1, 0], offset: 0 });

    // Variant 2: the browser reports the parent paragraph with an offset
    // that points past the <br> (i.e. "after" it, still an empty line).
    expect(domPointToModel(ctx.editor, ctx.container, secondParagraph, 1)).toEqual({ path: [1, 0], offset: 0 });
  });

  it("stays correct through several consecutive Enter presses followed by typing", () => {
    // Regression test: each Enter press produces another empty block whose
    // <br> filler is exactly the case the previous test exercises directly
    // — this exercises it through the full keyboard-driven flow instead,
    // pressing Enter repeatedly the way a user actually would.
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));

    fireBeforeInput(ctx.container, "insertParagraph");
    fireBeforeInput(ctx.container, "insertParagraph");
    fireBeforeInput(ctx.container, "insertParagraph");

    expect(ctx.editor.getHTML()).toBe("<p>hello</p><p><br></p><p><br></p><p><br></p>");
    expect(ctx.editor.getSelection()).toEqual(cursor({ path: [3, 0], offset: 0 }));

    fireBeforeInput(ctx.container, "insertText", "end");
    expect(ctx.editor.getHTML()).toBe("<p>hello</p><p><br></p><p><br></p><p>end</p>");
  });

  it("round-trips an empty paragraph through HTML export/import without introducing a stray newline", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    fireBeforeInput(ctx.container, "insertParagraph");
    const html = ctx.editor.getHTML();

    ctx.editor.setContent({ html });
    expect(ctx.editor.getHTML()).toBe(html);
    expect(ctx.editor.getText()).toBe("hello\n\n");
  });

  it("maps DOM selection changes back to the model via selectionchange", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    const textNode = ctx.container.querySelector("p")!.firstChild as Text;
    setCollapsedSelection(ctx.container, textNode, 3);
    document.dispatchEvent(new Event("selectionchange"));
    expect(ctx.editor.getSelection()).toEqual(cursor({ path: [0, 0], offset: 3 }));
  });

  it("restores DOM selection from the model after a render", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    const domSelection = document.getSelection()!;
    expect(domSelection.anchorOffset).toBe(2);
    expect(domSelection.anchorNode?.textContent).toBe("hello");
  });

  it("executes a Mod-b keydown shortcut through the plugin keymap", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection({
      type: "range",
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 5 }
    });
    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, metaKey: true, cancelable: true, bubbles: true });
    ctx.container.dispatchEvent(event);
    expect(ctx.editor.getHTML()).toBe("<p><strong>hello</strong></p>");
  });

  it("writes plain text and HTML to the clipboard on copy", () => {
    ctx.editor.setContent({ html: "<p>hello world</p>" });
    ctx.editor.setSelection({
      type: "range",
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 5 }
    });
    const data = new Map<string, string>();
    const clipboardData = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? ""
    } as unknown as DataTransfer;
    const event = new Event("copy", { cancelable: true, bubbles: true }) as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    ctx.container.dispatchEvent(event);
    expect(data.get("text/plain")).toBe("hello");
    expect(data.get("text/html")).toBe("<p>hello</p>");
  });

  it("reconciles IME composition text on compositionend", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.container.dispatchEvent(new CompositionEvent("compositionstart"));
    const textNode = ctx.container.querySelector("p")!.firstChild as Text;
    textNode.data = "hello世界"; // simulate IME inserting characters natively into the DOM
    setCollapsedSelection(ctx.container, textNode, textNode.data.length);
    ctx.container.dispatchEvent(new CompositionEvent("compositionend", { data: "世界" }));
    expect(ctx.editor.getText()).toBe("hello世界");
  });
});
