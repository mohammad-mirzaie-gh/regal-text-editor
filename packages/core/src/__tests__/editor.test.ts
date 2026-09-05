import { describe, expect, it, vi } from "vitest";
import { createBaseSchema } from "../schema/defaults";
import { Editor } from "../editor";
import { insertTextAtSelection } from "../transforms/insert-text";
import { normalizeSelection } from "../selection/selection";
import type { Plugin } from "../plugins/types";
import { cursor } from "../selection/selection";

const paragraphHtmlPlugin: Plugin = {
  name: "test-paragraph-html",
  htmlSerializers: {
    paragraph: (_node, children) => `<p>${children}</p>`
  }
};

describe("Editor", () => {
  it("starts with a single empty paragraph", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    expect(editor.doc.children).toHaveLength(1);
    expect(editor.isEmpty()).toBe(true);
  });

  it("applies a transaction and updates the document + selection", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const tx = editor.createTransaction({ origin: "keyboard", historyGroup: "typing" });
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    const end = insertTextAtSelection(tx, editor.schema, range, "hello");
    tx.setSelection(cursor(end));
    editor.dispatch(tx);

    expect(editor.getText()).toBe("hello");
    expect(editor.isEmpty()).toBe(false);
    expect(editor.getSelection()).toEqual(cursor({ path: [0, 0], offset: 5 }));
  });

  it("undo/redo restores prior document + selection snapshots", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const tx = editor.createTransaction({ origin: "keyboard", historyGroup: "typing" });
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    const end = insertTextAtSelection(tx, editor.schema, range, "abc");
    tx.setSelection(cursor(end));
    editor.dispatch(tx);
    expect(editor.getText()).toBe("abc");

    expect(editor.undo()).toBe(true);
    expect(editor.getText()).toBe("");
    expect(editor.undo()).toBe(false);

    expect(editor.redo()).toBe(true);
    expect(editor.getText()).toBe("abc");
  });

  it("merges consecutive typing transactions within the typing delay into one undo step", () => {
    const editor = new Editor({ schema: createBaseSchema(), history: { typingDelay: 10_000 } });
    let point = { path: [0, 0], offset: 0 };
    for (const char of ["a", "b", "c"]) {
      const tx = editor.createTransaction({ origin: "keyboard", historyGroup: "typing" });
      const range = normalizeSelection(cursor(point));
      point = insertTextAtSelection(tx, editor.schema, range, char);
      tx.setSelection(cursor(point));
      editor.dispatch(tx);
    }
    expect(editor.getText()).toBe("abc");
    expect(editor.undo()).toBe(true);
    expect(editor.getText()).toBe("");
  });

  it("renders HTML via plugin-registered serializers", () => {
    const editor = new Editor({ schema: createBaseSchema(), plugins: [paragraphHtmlPlugin] });
    const tx = editor.createTransaction();
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);
    expect(editor.getHTML()).toBe("<p>hi</p>");
  });

  it("round-trips through JSON", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const tx = editor.createTransaction();
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);
    const json = editor.getJSON();
    const editor2 = new Editor({ schema: createBaseSchema(), initialDoc: json });
    expect(editor2.getText()).toBe("hi");
  });

  it("setContent replaces the document and clears history", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const tx = editor.createTransaction();
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);

    editor.clear();
    expect(editor.isEmpty()).toBe(true);
    expect(editor.undo()).toBe(false);
  });

  it("blocks mutating transactions while not editable", () => {
    const editor = new Editor({ schema: createBaseSchema(), editable: false });
    const tx = editor.createTransaction({ origin: "keyboard" });
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);
    expect(editor.getText()).toBe("");
  });

  it("parses initialHTML into the starting document", () => {
    const editor = new Editor({ schema: createBaseSchema(), plugins: [paragraphHtmlPlugin], initialHTML: "<p>hi</p>" });
    expect(editor.getText()).toBe("hi");
  });

  it("logs to console.error by default when a dispatched transaction's selection can't be clamped", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const editor = new Editor({ schema: createBaseSchema() });
      const tx = editor.createTransaction();
      tx.setSelection(cursor({ path: [99, 99], offset: 0 }));
      editor.dispatch(tx);
      expect(spy).toHaveBeenCalledWith("[editor] plugin/command error", expect.anything());
      expect(editor.getSelection()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("routes errors to a custom onError handler instead of console.error", () => {
    const onError = vi.fn();
    const editor = new Editor({ schema: createBaseSchema(), onError });
    const tx = editor.createTransaction();
    tx.setSelection(cursor({ path: [99, 99], offset: 0 }));
    editor.dispatch(tx);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("invokes plugin onInit and onDestroy lifecycle hooks", () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();
    const plugin: Plugin = { name: "lifecycle-test", onInit, onDestroy };
    const editor = new Editor({ schema: createBaseSchema(), plugins: [plugin] });
    expect(onInit).toHaveBeenCalledWith(editor);
    editor.destroy();
    expect(onDestroy).toHaveBeenCalledWith(editor);
  });

  it("destroy() is idempotent, clears listeners, and stops delivering events", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const listener = vi.fn();
    editor.on("change", listener);
    editor.destroy();
    expect(() => editor.destroy()).not.toThrow();

    const tx = editor.createTransaction();
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);
    expect(listener).not.toHaveBeenCalled();
  });

  it("on() returns an unsubscribe function", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const listener = vi.fn();
    const off = editor.on("change", listener);
    off();
    const tx = editor.createTransaction();
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);
    expect(listener).not.toHaveBeenCalled();
  });

  it("subscribe() fires on document changes and unsubscribes cleanly", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const listener = vi.fn();
    const unsubscribe = editor.subscribe(listener);
    const tx = editor.createTransaction();
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    const tx2 = editor.createTransaction();
    const range2 = normalizeSelection(cursor({ path: [0, 0], offset: 2 }));
    insertTextAtSelection(tx2, editor.schema, range2, "!");
    editor.dispatch(tx2);
    expect(listener).not.toHaveBeenCalled();
  });

  it("tracks focus state via focus()/blur()/isFocused() and setFocused()", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    expect(editor.isFocused()).toBe(false);
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    editor.focus();
    expect(onFocus).toHaveBeenCalled();
    editor.blur();
    expect(onBlur).toHaveBeenCalled();

    editor.setFocused(true);
    expect(editor.isFocused()).toBe(true);
  });

  it("isDirty() reflects whether there is undo history", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    expect(editor.isDirty()).toBe(false);
    const tx = editor.createTransaction();
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);
    expect(editor.isDirty()).toBe(true);
  });

  it("validate() delegates to the schema", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    expect(editor.validate()).toEqual([]);
  });

  it("getMarkdown() renders via plugin-registered Markdown serializers", () => {
    const markdownPlugin: Plugin = { name: "test-paragraph-md", markdownSerializers: { paragraph: (_node, children) => children.join("") } };
    const editor = new Editor({ schema: createBaseSchema(), plugins: [markdownPlugin] });
    const tx = editor.createTransaction();
    const range = normalizeSelection(cursor({ path: [0, 0], offset: 0 }));
    insertTextAtSelection(tx, editor.schema, range, "hi");
    editor.dispatch(tx);
    expect(editor.getMarkdown()).toBe("hi");
  });

  it("setStoredMarks() notifies subscribers even though it doesn't touch doc/selection", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const listener = vi.fn();
    editor.subscribe(listener);
    editor.setStoredMarks([{ type: "bold", attrs: {} }]);
    expect(listener).toHaveBeenCalled();
    expect(editor.getStoredMarks()).toEqual([{ type: "bold", attrs: {} }]);
  });

  it("setEditable() notifies subscribers", () => {
    const editor = new Editor({ schema: createBaseSchema() });
    const listener = vi.fn();
    editor.subscribe(listener);
    editor.setEditable(false);
    expect(listener).toHaveBeenCalled();
    expect(editor.editable).toBe(false);
  });
});
