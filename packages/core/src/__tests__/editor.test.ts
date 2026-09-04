import { describe, expect, it } from "vitest";
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
});
