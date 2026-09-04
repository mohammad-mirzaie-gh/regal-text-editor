import type { ElementNode, Mark } from "../model/types";

/** Receives each child already serialized (one string per child, in order)
 * rather than one pre-joined string, so a node can control how its
 * children combine — e.g. a list adding a "1. "/"- " marker and indenting
 * continuation lines per item, something a single joined string can't
 * support since the per-child boundaries would already be lost. */
export type NodeSerializer = (node: ElementNode, children: string[]) => string;
export type MarkSerializer = (mark: Mark, serializedContent: string) => string;

export type NodeSerializers = Record<string, NodeSerializer>;
export type MarkSerializers = Record<string, MarkSerializer>;

/** Holds the per-node-type and per-mark-type serializer functions plugins
 * contribute for one output format (HTML, Markdown, ...). The generic
 * export walker in html.ts/markdown.ts looks nodes up here instead of
 * hard-coding knowledge of any specific node/mark type. */
export class SerializerRegistry {
  private readonly nodeSerializers = new Map<string, NodeSerializer>();
  private readonly markSerializers = new Map<string, MarkSerializer>();

  registerNode(type: string, serializer: NodeSerializer): void {
    this.nodeSerializers.set(type, serializer);
  }

  registerMark(type: string, serializer: MarkSerializer): void {
    this.markSerializers.set(type, serializer);
  }

  node(type: string): NodeSerializer | undefined {
    return this.nodeSerializers.get(type);
  }

  mark(type: string): MarkSerializer | undefined {
    return this.markSerializers.get(type);
  }
}
