import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Editor, createBaseSchema, cursor } from "@rte/core";
import { EditorView } from "@rte/browser";
import { BasicMarksPlugin } from "@rte/plugin-basic-marks";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { HistoryPlugin } from "@rte/plugin-history";

function makeView(editable = true): { editor: Editor; view: EditorView; container: HTMLElement } {
  const editor = new Editor({
    schema: createBaseSchema(),
    plugins: [BasicBlocksPlugin(), BasicMarksPlugin(), HistoryPlugin()]
  });
  editor.setEditable(editable);
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

function makeClipboardEvent(type: string, data: Map<string, string>): ClipboardEvent {
  const clipboardData = {
    setData: (t: string, v: string) => data.set(t, v),
    getData: (t: string) => data.get(t) ?? ""
  } as unknown as DataTransfer;
  const event = new Event(type, { cancelable: true, bubbles: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  return event;
}

function makeDragEvent(type: string, data: Map<string, string>): DragEvent {
  const dataTransfer = {
    getData: (t: string) => data.get(t) ?? ""
  } as unknown as DataTransfer;
  const event = new Event(type, { cancelable: true, bubbles: true }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event;
}

describe("EditorView clipboard/lifecycle/edge cases (jsdom)", () => {
  let ctx: { editor: Editor; view: EditorView; container: HTMLElement };

  beforeEach(() => {
    ctx = makeView();
  });

  afterEach(() => {
    ctx.view.destroy();
    ctx.container.remove();
  });

  it("cuts the selection: writes clipboard data and removes the text", () => {
    ctx.editor.setContent({ html: "<p>hello world</p>" });
    ctx.editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    const data = new Map<string, string>();
    const event = makeClipboardEvent("cut", data);
    ctx.container.dispatchEvent(event);
    expect(data.get("text/plain")).toBe("hello");
    expect(ctx.editor.getText()).toBe(" world");
  });

  it("does nothing on cut when the selection is collapsed", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    const data = new Map<string, string>();
    ctx.container.dispatchEvent(makeClipboardEvent("cut", data));
    expect(data.size).toBe(0);
    expect(ctx.editor.getText()).toBe("hello");
  });

  it("pastes plain text at the cursor and restores the selection right after the pasted text", () => {
    // Regression test: the pasted leaf merges into the surrounding
    // same-marks text during normalization, which used to leave the
    // selection computed against a now-stale leaf index and silently drop
    // it to null instead of landing after " world".
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    const data = new Map([["text/plain", " world"]]);
    ctx.container.dispatchEvent(makeClipboardEvent("paste", data));
    expect(ctx.editor.getText()).toBe("hello world");
    expect(ctx.editor.getSelection()).toEqual(cursor({ path: [0, 0], offset: 11 }));
  });

  it("pastes HTML when offered, parsed through the registered block parsers", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    const data = new Map([
      ["text/html", "<p><strong>bold</strong></p>"],
      ["text/plain", "bold"]
    ]);
    ctx.container.dispatchEvent(makeClipboardEvent("paste", data));
    expect(ctx.editor.getHTML()).toContain("<strong>bold</strong>");
  });

  it("does nothing on paste when there is no usable clipboard content", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    ctx.container.dispatchEvent(makeClipboardEvent("paste", new Map()));
    expect(ctx.editor.getText()).toBe("hello");
  });

  it("ignores paste entirely when the editor is not editable", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setEditable(false);
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    const data = new Map([["text/plain", " world"]]);
    ctx.container.dispatchEvent(makeClipboardEvent("paste", data));
    expect(ctx.editor.getText()).toBe("hello");
  });

  it("drops text at the cursor like a paste, restoring the selection after the dropped text", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    const data = new Map([["text/plain", " dropped"]]);
    ctx.container.dispatchEvent(makeDragEvent("drop", data));
    expect(ctx.editor.getText()).toBe("hello dropped");
    expect(ctx.editor.getSelection()).toEqual(cursor({ path: [0, 0], offset: 13 }));
  });

  it("does nothing on drop when the editor is not editable", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setEditable(false);
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    ctx.container.dispatchEvent(makeDragEvent("drop", new Map([["text/plain", "x"]])));
    expect(ctx.editor.getText()).toBe("hello");
  });

  it("prevents the default browser drop-navigation behavior on dragover", () => {
    const event = new Event("dragover", { cancelable: true, bubbles: true });
    ctx.container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("focus() focuses the container", () => {
    ctx.container.blur();
    ctx.view.focus();
    expect(document.activeElement).toBe(ctx.container);
  });

  it("destroy() is idempotent and stops the view from reacting further", () => {
    ctx.view.destroy();
    expect(() => ctx.view.destroy()).not.toThrow();
    // After destroy, further document changes must not throw even though listeners are detached.
    expect(() => ctx.editor.setContent({ html: "<p>after destroy</p>" })).not.toThrow();
  });

  it("blocks beforeinput entirely when the editor is not editable", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setEditable(false);
    const event = fireBeforeInput(ctx.container, "insertText", "x");
    expect(event.defaultPrevented).toBe(true);
    expect(ctx.editor.getText()).toBe("hello");
  });

  it("ignores keydown shortcuts entirely when the editor is not editable", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    ctx.editor.setEditable(false);
    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, metaKey: true, cancelable: true, bubbles: true });
    ctx.container.dispatchEvent(event);
    expect(ctx.editor.getHTML()).toBe("<p>hello</p>");
  });

  it("prevents default on Tab even when no shortcut is registered for it", () => {
    const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true, bubbles: true });
    ctx.container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("deletes a whole word backward on deleteWordBackward", () => {
    ctx.editor.setContent({ html: "<p>hello world</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 11 }));
    fireBeforeInput(ctx.container, "deleteWordBackward");
    expect(ctx.editor.getText()).toBe("hello ");
  });

  it("deletes to the start of the line on deleteSoftLineBackward", () => {
    ctx.editor.setContent({ html: "<p>hello world</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 11 }));
    fireBeforeInput(ctx.container, "deleteSoftLineBackward");
    expect(ctx.editor.getText()).toBe("");
  });

  it("deletes one character forward on deleteContentForward", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    fireBeforeInput(ctx.container, "deleteContentForward");
    expect(ctx.editor.getText()).toBe("ello");
  });

  it("deletes a whole word forward on deleteWordForward", () => {
    ctx.editor.setContent({ html: "<p>hello world</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    fireBeforeInput(ctx.container, "deleteWordForward");
    expect(ctx.editor.getText()).toBe(" world");
  });

  it("deletes to the end of the line on deleteHardLineForward", () => {
    ctx.editor.setContent({ html: "<p>hello world</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 0 }));
    fireBeforeInput(ctx.container, "deleteHardLineForward");
    expect(ctx.editor.getText()).toBe("");
  });

  it("merges the next block forward when deleteContentForward is at the end of a block", () => {
    ctx.editor.setContent({ html: "<p>hello</p><p>world</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    fireBeforeInput(ctx.container, "deleteContentForward");
    expect(ctx.editor.getText()).toBe("helloworld");
  });

  it("deletes a non-collapsed range the same way regardless of the specific delete inputType", () => {
    ctx.editor.setContent({ html: "<p>hello world</p>" });
    ctx.editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    fireBeforeInput(ctx.container, "deleteContentForward");
    expect(ctx.editor.getText()).toBe(" world");
  });

  it("removes the DOM selection range when the model selection becomes null", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 2 }));
    expect(document.getSelection()!.rangeCount).toBeGreaterThan(0);
    ctx.editor.setSelection(null);
    expect(document.getSelection()!.rangeCount).toBe(0);
  });

  it("blocks unrecognized beforeinput types rather than letting the DOM edit through", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    const event = fireBeforeInput(ctx.container, "formatBold");
    expect(event.defaultPrevented).toBe(true);
    expect(ctx.editor.getText()).toBe("hello");
  });

  it("inserts a literal line break on insertLineBreak (Shift+Enter)", () => {
    ctx.editor.setContent({ html: "<p>hello</p>" });
    ctx.editor.setSelection(cursor({ path: [0, 0], offset: 5 }));
    fireBeforeInput(ctx.container, "insertLineBreak");
    expect(ctx.editor.getText()).toBe("hello\n");
  });
});

describe("EditorView constructed on an already-editable=false editor", () => {
  it("renders as non-editable from the start and ignores typing", () => {
    const editor = new Editor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin()] });
    editor.setEditable(false);
    editor.setContent({ html: "<p>hello</p>" });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const view = new EditorView({ editor, container });
    expect(container.getAttribute("contenteditable")).toBe("false");
    fireBeforeInput(container, "insertText", "x");
    expect(editor.getText()).toBe("hello");
    view.destroy();
    container.remove();
  });
});
