import { createElement, getNodeAtPath } from "../model/node";
import type { ElementNode } from "../model/types";
import type { Transaction } from "../transaction/transaction";

/** Indents a list item by moving it into a new or existing nested sublist
 * at the end of its preceding sibling item. Returns false (no-op) if there
 * is no preceding sibling to nest under. */
export function indentListItem(tx: Transaction, listItemPath: number[], listType: string): boolean {
  const index = listItemPath[listItemPath.length - 1];
  if (index === undefined || index === 0) return false;
  const parentListPath = listItemPath.slice(0, -1);
  const previousItemPath = [...parentListPath, index - 1];
  const previousItem = getNodeAtPath(tx.doc, previousItemPath) as ElementNode;
  const lastChild = previousItem.children[previousItem.children.length - 1];

  let sublistPath: number[];
  if (lastChild && lastChild.object === "element" && lastChild.type === listType) {
    sublistPath = [...previousItemPath, previousItem.children.length - 1];
  } else {
    sublistPath = [...previousItemPath, previousItem.children.length];
    tx.insertNode(sublistPath, createElement(listType, {}, []));
  }

  const targetLen = (getNodeAtPath(tx.doc, sublistPath) as ElementNode).children.length;
  tx.moveNode(listItemPath, [...sublistPath, targetLen]);
  return true;
}

/** Outdents a nested list item to become a sibling of the item that
 * contains its list, one level up. Returns false if the item is already at
 * the top level (its list's parent is not itself a list item). */
export function outdentListItem(tx: Transaction, listItemPath: number[]): boolean {
  const listPath = listItemPath.slice(0, -1);
  const listParentPath = listPath.slice(0, -1);
  if (listParentPath.length === 0) return false;
  const listParentNode = getNodeAtPath(tx.doc, listParentPath);
  if (listParentNode.object !== "element" || listParentNode.type !== "listItem") return false;

  const parentItemIndex = listParentPath[listParentPath.length - 1] as number;
  const outerListPath = listParentPath.slice(0, -1);
  tx.moveNode(listItemPath, [...outerListPath, parentItemIndex + 1]);
  return true;
}
