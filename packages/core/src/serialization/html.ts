import type { EditorDocument, ElementNode, Mark, TextNode } from "../model/types";
import { escapeHtml } from "../utils/sanitize";
import type { SerializerRegistry } from "./registry";

function serializeMarks(text: TextNode, registry: SerializerRegistry): string {
  const content = escapeHtml(text.text).replace(/\n/g, "<br>");
  const sortedMarks = [...text.marks].sort((a, b) => a.type.localeCompare(b.type));
  return sortedMarks.reduce((html, mark: Mark) => {
    const serializer = registry.mark(mark.type);
    return serializer ? serializer(mark, html) : html;
  }, content);
}

function serializeElement(node: ElementNode, registry: SerializerRegistry): string {
  const childrenHtml = node.children.map((child) =>
    child.object === "text" ? serializeMarks(child, registry) : serializeElement(child, registry)
  );
  const serializer = registry.node(node.type);
  if (serializer) return serializer(node, childrenHtml);
  return `<div data-node-type="${node.type}">${childrenHtml.join("")}</div>`;
}

/** Produces clean semantic HTML by delegating every node/mark type to the
 * serializer functions plugins registered — the core engine has no
 * built-in knowledge of what a "heading" or "bold" mark should render as. */
export function toHTML(doc: EditorDocument, registry: SerializerRegistry): string {
  return doc.children.map((child) => serializeElement(child, registry)).join("");
}
