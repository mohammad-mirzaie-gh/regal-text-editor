import { createElement, createText, marksEqual } from "../model/node";
import type { EditorDocument, EditorNode, ElementNode } from "../model/types";
import type { Schema } from "../schema/schema";

function mergeAdjacentText(children: EditorNode[]): EditorNode[] {
  const result: EditorNode[] = [];
  for (const child of children) {
    const previous = result[result.length - 1];
    if (child.object === "text" && previous && previous.object === "text" && marksEqual(previous.marks, child.marks)) {
      result[result.length - 1] = { ...previous, text: previous.text + child.text };
    } else {
      result.push(child);
    }
  }
  return result;
}

function dropEmptyTextExceptSole(children: EditorNode[]): EditorNode[] {
  const nonEmpty = children.filter((child) => !(child.object === "text" && child.text.length === 0));
  return nonEmpty.length > 0 ? nonEmpty : children.slice(0, 1);
}

/** Normalizes a single element bottom-up: children are normalized first,
 * then this node repairs its own child list (merging text, dropping empty
 * containers that require 1+ children, guaranteeing textblocks have at
 * least one text leaf). Returns null when the node itself must be removed
 * because it can no longer satisfy its own content requirement. */
function normalizeElement(schema: Schema, element: ElementNode): ElementNode | null {
  const spec = schema.nodes.get(element.type);
  if (!spec || spec.void) return element;

  const normalizedChildren: EditorNode[] = [];
  for (const child of element.children) {
    if (child.object === "text") {
      normalizedChildren.push(child);
      continue;
    }
    const normalized = normalizeElement(schema, child);
    if (normalized) normalizedChildren.push(normalized);
  }

  let children = mergeAdjacentText(normalizedChildren);

  if (spec.isTextBlock) {
    children = children.length > 0 ? dropEmptyTextExceptSole(children) : [createText("")];
  } else if (spec.content && /\+\s*$/.test(spec.content) && children.length === 0) {
    return null;
  }

  return { ...element, children };
}

/** Runs a single deterministic bottom-up repair pass and guarantees the
 * document is never left with zero block children. */
export function normalizeDocument(schema: Schema, doc: EditorDocument): EditorDocument {
  const children = doc.children
    .map((child) => normalizeElement(schema, child))
    .filter((child): child is ElementNode => child !== null);

  if (children.length === 0) {
    return { ...doc, children: [createElement(schema.defaultBlockType, {}, [createText("")])] };
  }
  return { ...doc, children };
}
