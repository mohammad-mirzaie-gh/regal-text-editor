import type { EditorDocument, EditorNode, ElementNode, TextNode } from "../model/types";
import { addMark, getNodeAtPath, removeMark } from "../model/node";
import type { Operation } from "../transaction/operations";

type Container = EditorDocument | ElementNode;

/** Rebuilds only the nodes along `path`, reusing every sibling subtree by
 * reference (structural sharing) so unrelated parts of a large document
 * never get re-allocated on every keystroke. */
function updateChildren(
  container: Container,
  path: number[],
  updater: (children: EditorNode[]) => EditorNode[]
): Container {
  if (path.length === 0) {
    return { ...container, children: updater(container.children as EditorNode[]) } as Container;
  }
  const [index, ...rest] = path as [number, ...number[]];
  const children = container.children as EditorNode[];
  const target = children[index];
  if (!target || target.object !== "element") {
    throw new Error(`Cannot descend into non-element at path index ${index}`);
  }
  const updatedChild = updateChildren(target, rest, updater) as ElementNode;
  const newChildren = children.slice();
  newChildren[index] = updatedChild;
  return { ...container, children: newChildren } as Container;
}

function replaceLeaf(doc: EditorDocument, path: number[], updater: (node: TextNode) => TextNode): EditorDocument {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  if (index === undefined) throw new Error("Path must address a leaf inside a parent");
  return updateChildren(doc, parentPath, (children) => {
    const target = children[index];
    if (!target || target.object !== "text") throw new Error(`No text node at path [${path.join(",")}]`);
    const newChildren = children.slice();
    newChildren[index] = updater(target);
    return newChildren;
  }) as EditorDocument;
}

export function applyOperation(doc: EditorDocument, op: Operation): EditorDocument {
  switch (op.type) {
    case "insertText": {
      return replaceLeaf(doc, op.path, (node) => ({
        ...node,
        text: node.text.slice(0, op.offset) + op.text + node.text.slice(op.offset)
      }));
    }

    case "removeText": {
      return replaceLeaf(doc, op.path, (node) => ({
        ...node,
        text: node.text.slice(0, op.offset) + node.text.slice(op.offset + op.length)
      }));
    }

    case "setMark": {
      return replaceLeaf(doc, op.path, (node) => ({ ...node, marks: addMark(node.marks, op.mark) }));
    }

    case "removeMark": {
      return replaceLeaf(doc, op.path, (node) => ({ ...node, marks: removeMark(node.marks, op.markType) }));
    }

    case "splitText": {
      const parentPath = op.path.slice(0, -1);
      const index = op.path[op.path.length - 1];
      if (index === undefined) throw new Error("splitText path must address a leaf");
      return updateChildren(doc, parentPath, (children) => {
        const target = children[index];
        if (!target || target.object !== "text") throw new Error(`No text node at path [${op.path.join(",")}]`);
        const before: TextNode = { ...target, text: target.text.slice(0, op.offset) };
        const after: TextNode = { ...target, text: target.text.slice(op.offset) };
        const newChildren = children.slice();
        newChildren.splice(index, 1, before, after);
        return newChildren;
      }) as EditorDocument;
    }

    case "insertNode": {
      const parentPath = op.path.slice(0, -1);
      const index = op.path[op.path.length - 1];
      if (index === undefined) throw new Error("insertNode path must address a slot");
      return updateChildren(doc, parentPath, (children) => {
        const newChildren = children.slice();
        newChildren.splice(index, 0, op.node);
        return newChildren;
      }) as EditorDocument;
    }

    case "removeNode": {
      const parentPath = op.path.slice(0, -1);
      const index = op.path[op.path.length - 1];
      if (index === undefined) throw new Error("removeNode path must address a node");
      return updateChildren(doc, parentPath, (children) => {
        const newChildren = children.slice();
        newChildren.splice(index, 1);
        return newChildren;
      }) as EditorDocument;
    }

    case "setNodeAttribute": {
      const parentPath = op.path.slice(0, -1);
      const index = op.path[op.path.length - 1];
      if (index === undefined) throw new Error("setNodeAttribute path must address a node");
      return updateChildren(doc, parentPath, (children) => {
        const target = children[index];
        if (!target || target.object !== "element") throw new Error(`No element at path [${op.path.join(",")}]`);
        const newChildren = children.slice();
        newChildren[index] = { ...target, attrs: { ...target.attrs, ...op.attrs } };
        return newChildren;
      }) as EditorDocument;
    }

    case "mergeNodes": {
      const parentPath = op.path.slice(0, -1);
      const index = op.path[op.path.length - 1];
      if (index === undefined || index === 0) {
        throw new Error("mergeNodes requires a preceding sibling to merge into");
      }
      return updateChildren(doc, parentPath, (children) => {
        const previous = children[index - 1];
        const current = children[index];
        if (!previous || !current) throw new Error(`No sibling pair at path [${op.path.join(",")}]`);
        let merged: EditorNode;
        if (previous.object === "text" && current.object === "text") {
          merged = { ...previous, text: previous.text + current.text };
        } else if (previous.object === "element" && current.object === "element") {
          merged = { ...previous, children: [...previous.children, ...current.children] };
        } else {
          throw new Error("mergeNodes requires two text nodes or two element nodes");
        }
        const newChildren = children.slice();
        newChildren.splice(index - 1, 2, merged);
        return newChildren;
      }) as EditorDocument;
    }

    case "moveNode": {
      const fromParent = op.from.slice(0, -1);
      const fromIndex = op.from[op.from.length - 1];
      if (fromIndex === undefined) throw new Error("moveNode.from must address a node");
      const node = getNodeAtPath(doc, op.from) as EditorNode;
      const afterRemoval = updateChildren(doc, fromParent, (children) => {
        const newChildren = children.slice();
        newChildren.splice(fromIndex, 1);
        return newChildren;
      }) as EditorDocument;

      const toParent = op.to.slice(0, -1);
      const toIndex = op.to[op.to.length - 1];
      if (toIndex === undefined) throw new Error("moveNode.to must address a slot");
      return updateChildren(afterRemoval, toParent, (children) => {
        const newChildren = children.slice();
        newChildren.splice(toIndex, 0, node);
        return newChildren;
      }) as EditorDocument;
    }

    default: {
      const exhaustive: never = op;
      throw new Error(`Unknown operation: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function applyOperations(doc: EditorDocument, ops: Operation[]): EditorDocument {
  return ops.reduce((current, op) => applyOperation(current, op), doc);
}
