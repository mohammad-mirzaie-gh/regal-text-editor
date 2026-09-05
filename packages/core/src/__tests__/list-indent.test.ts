import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText, getNodeAtPath } from "../model/node";
import type { ElementNode } from "../model/types";
import { Transaction } from "../transaction/transaction";
import { indentListItem, outdentListItem } from "../transforms/list-indent";

function listItem(text: string, children: ElementNode[] = []): ElementNode {
  return createElement("listItem", {}, [createElement("paragraph", {}, [createText(text)]), ...children]);
}

describe("indentListItem", () => {
  it("returns false and does nothing for the first item in a list (no preceding sibling)", () => {
    const doc = createDocument([createElement("bulletList", {}, [listItem("one"), listItem("two")])]);
    const tx = new Transaction(doc, null);
    expect(indentListItem(tx, [0, 0], "bulletList")).toBe(false);
    expect((getNodeAtPath(tx.doc, [0]) as ElementNode).children).toHaveLength(2);
  });

  it("creates a new nested sublist under the preceding sibling when none exists yet", () => {
    const doc = createDocument([createElement("bulletList", {}, [listItem("one"), listItem("two")])]);
    const tx = new Transaction(doc, null);
    expect(indentListItem(tx, [0, 1], "bulletList")).toBe(true);
    const topList = getNodeAtPath(tx.doc, [0]) as ElementNode;
    expect(topList.children).toHaveLength(1);
    const firstItem = topList.children[0] as ElementNode;
    const sublist = firstItem.children[1] as ElementNode;
    expect(sublist.type).toBe("bulletList");
    expect(sublist.children).toHaveLength(1);
  });

  it("nests into the preceding sibling's existing sublist instead of creating a second one", () => {
    const nestedList = createElement("bulletList", {}, [listItem("nested-one")]);
    const doc = createDocument([
      createElement("bulletList", {}, [listItem("one", [nestedList]), listItem("two"), listItem("three")])
    ]);
    const tx = new Transaction(doc, null);
    expect(indentListItem(tx, [0, 1], "bulletList")).toBe(true);
    const topList = getNodeAtPath(tx.doc, [0]) as ElementNode;
    expect(topList.children).toHaveLength(2); // "one" (with its sublist) and "three"
    const firstItem = topList.children[0] as ElementNode;
    const sublist = firstItem.children[1] as ElementNode;
    expect(sublist.children).toHaveLength(2); // nested-one, then the newly indented "two"
  });

  it("does not reuse a trailing child of a different type as the sublist", () => {
    const doc = createDocument([
      createElement("bulletList", {}, [listItem("one"), listItem("two")])
    ]);
    const tx = new Transaction(doc, null);
    indentListItem(tx, [0, 1], "orderedList");
    const topList = getNodeAtPath(tx.doc, [0]) as ElementNode;
    const firstItem = topList.children[0] as ElementNode;
    const sublist = firstItem.children[1] as ElementNode;
    expect(sublist.type).toBe("orderedList");
  });
});

describe("outdentListItem", () => {
  it("returns false when the list is already at the top level", () => {
    const doc = createDocument([createElement("bulletList", {}, [listItem("one")])]);
    const tx = new Transaction(doc, null);
    expect(outdentListItem(tx, [0, 0])).toBe(false);
  });

  it("returns false when the list's parent element is not a listItem", () => {
    // A list directly inside a blockquote (not a listItem) has nowhere
    // meaningful to outdent to.
    const doc = createDocument([createElement("blockquote", {}, [createElement("bulletList", {}, [listItem("one")])])]);
    const tx = new Transaction(doc, null);
    expect(outdentListItem(tx, [0, 0, 0])).toBe(false);
  });

  it("moves a nested item out to become a sibling of its parent item", () => {
    const doc = createDocument([
      createElement("bulletList", {}, [
        listItem("one", [createElement("bulletList", {}, [listItem("nested")])]),
        listItem("two")
      ])
    ]);
    const tx = new Transaction(doc, null);
    expect(outdentListItem(tx, [0, 0, 1, 0])).toBe(true);
    const topList = getNodeAtPath(tx.doc, [0]) as ElementNode;
    expect(topList.children).toHaveLength(3);
    const secondItem = topList.children[1] as ElementNode;
    const secondItemParagraph = secondItem.children[0] as ElementNode;
    expect((secondItemParagraph.children[0] as { text: string }).text).toBe("nested");
  });
});
