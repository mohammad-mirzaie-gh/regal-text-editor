import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText } from "../model/node";
import { Transaction } from "../transaction/transaction";
import { cursor } from "../selection/selection";

describe("Transaction", () => {
  it("isEmpty() is true before any operation and false after one", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hi")])]);
    const tx = new Transaction(doc, null);
    expect(tx.isEmpty()).toBe(true);
    tx.insertText([0, 0], 2, "!");
    expect(tx.isEmpty()).toBe(false);
  });

  it("setMeta() merges new fields into the existing meta rather than replacing it", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hi")])]);
    const tx = new Transaction(doc, null, { origin: "keyboard", historyGroup: "typing" });
    tx.setMeta({ historyGroup: "structural" });
    const result = tx.build();
    expect(result.meta.origin).toBe("keyboard");
    expect(result.meta.historyGroup).toBe("structural");
  });

  it("setSelection() sets selectionAfter without touching selectionBefore", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hi")])]);
    const before = cursor({ path: [0, 0], offset: 0 });
    const tx = new Transaction(doc, before);
    tx.setSelection(cursor({ path: [0, 0], offset: 2 }));
    const result = tx.build();
    expect(result.selectionBefore).toEqual(before);
    expect(result.selectionAfter).toEqual(cursor({ path: [0, 0], offset: 2 }));
  });

  it("build() reflects every queued operation and the transaction's working document", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hi")])]);
    const tx = new Transaction(doc, null);
    tx.insertText([0, 0], 2, "!");
    tx.setNodeAttribute([0], { align: "center" });
    const result = tx.build();
    expect(result.operations).toHaveLength(2);
    expect(result.doc).toBe(tx.doc);
  });

  it("chains fluently since every builder method returns the transaction itself", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hi")])]);
    const tx = new Transaction(doc, null).insertText([0, 0], 2, "!").setSelection(cursor({ path: [0, 0], offset: 3 }));
    expect(tx).toBeInstanceOf(Transaction);
    expect(tx.build().selectionAfter).toEqual(cursor({ path: [0, 0], offset: 3 }));
  });
});
