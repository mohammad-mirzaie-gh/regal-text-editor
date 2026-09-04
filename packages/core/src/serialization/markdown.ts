import type { EditorDocument, ElementNode, Mark, TextNode } from "../model/types";
import type { SerializerRegistry } from "./registry";

function serializeMarks(text: TextNode, registry: SerializerRegistry): string {
  const sortedMarks = [...text.marks].sort((a, b) => a.type.localeCompare(b.type));
  return sortedMarks.reduce((content, mark: Mark) => {
    const serializer = registry.mark(mark.type);
    return serializer ? serializer(mark, content) : content;
  }, text.text);
}

function serializeElement(node: ElementNode, registry: SerializerRegistry): string {
  const childrenText = node.children.map((child) =>
    child.object === "text" ? serializeMarks(child, registry) : serializeElement(child, registry)
  );
  const serializer = registry.node(node.type);
  if (serializer) return serializer(node, childrenText);
  const hasElementChild = node.children.some((child) => child.object === "element");
  return childrenText.join(hasElementChild ? "\n\n" : "");
}

/** Generic Markdown export: identical shape to html.ts's walker, delegating
 * every node/mark to plugin-registered serializers. Each node's serializer
 * receives its children as an array of already-serialized strings (not one
 * joined string) so, e.g., a list can prefix each item with its own marker. */
export function toMarkdown(doc: EditorDocument, registry: SerializerRegistry): string {
  return doc.children
    .map((child) => serializeElement(child, registry))
    .join("\n\n")
    .trim();
}
