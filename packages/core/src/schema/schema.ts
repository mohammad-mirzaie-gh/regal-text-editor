import type { EditorDocument, EditorNode, ElementNode } from "../model/types";
import { walk } from "../model/node";
import { isTextNode } from "../model/types";
import { matchesContentExpression } from "./content-matcher";
import type { MarkSpec, NodeSpec, ValidationError } from "./types";

export interface SchemaConfig {
  nodes: NodeSpec[];
  marks?: MarkSpec[];
  /** Node type used as the document's block-level root container, e.g. "paragraph". */
  defaultBlockType: string;
}

export class Schema {
  readonly nodes = new Map<string, NodeSpec>();
  readonly marks = new Map<string, MarkSpec>();
  readonly defaultBlockType: string;

  constructor(config: SchemaConfig) {
    for (const node of config.nodes) this.nodes.set(node.name, node);
    for (const mark of config.marks ?? []) this.marks.set(mark.name, mark);
    this.defaultBlockType = config.defaultBlockType;
    if (!this.nodes.has(this.defaultBlockType)) {
      throw new Error(`Schema defaultBlockType "${this.defaultBlockType}" is not a registered node`);
    }
  }

  extend(config: Partial<SchemaConfig>): Schema {
    return new Schema({
      nodes: [...this.nodes.values(), ...(config.nodes ?? [])],
      marks: [...this.marks.values(), ...(config.marks ?? [])],
      defaultBlockType: config.defaultBlockType ?? this.defaultBlockType
    });
  }

  isVoid(type: string): boolean {
    return this.nodes.get(type)?.void === true;
  }

  isCode(type: string): boolean {
    return this.nodes.get(type)?.code === true;
  }

  isInline(type: string): boolean {
    return this.nodes.get(type)?.group === "inline";
  }

  markAllowed(nodeType: string, markType: string): boolean {
    const spec = this.nodes.get(nodeType);
    const rule = spec?.marks ?? "_";
    if (rule === "_") return true;
    if (rule === false) return false;
    return rule.includes(markType);
  }

  private nodeMatchesToken(tokenName: string, childType: string): boolean {
    if (tokenName === "block" || tokenName === "inline") {
      return this.nodes.get(childType)?.group === tokenName;
    }
    return tokenName === childType;
  }

  private validateChildren(element: ElementNode, path: number[], errors: ValidationError[]): void {
    const spec = this.nodes.get(element.type);
    if (!spec) {
      errors.push({ path, code: "unknown-node-type", message: `Unknown node type "${element.type}"` });
      return;
    }
    if (spec.void) return;
    if (!spec.content) return;

    const childTypes = element.children.map((child) => (isTextNode(child) ? "text" : child.type));
    const ok = matchesContentExpression(spec.content, childTypes, (tokenName, childType) => {
      if (tokenName === "inline" && childType === "text") return true;
      return this.nodeMatchesToken(tokenName, childType);
    });
    if (!ok) {
      errors.push({
        path,
        code: "invalid-child",
        message: `Node "${element.type}" children [${childTypes.join(", ")}] do not satisfy content expression "${spec.content}"`
      });
    }
  }

  private validateNode(node: EditorNode, path: number[], errors: ValidationError[]): void {
    if (isTextNode(node)) {
      for (const mark of node.marks) {
        if (!this.marks.has(mark.type)) {
          errors.push({ path, code: "unknown-mark-type", message: `Unknown mark type "${mark.type}"` });
        }
      }
      return;
    }
    this.validateChildren(node, path, errors);
  }

  validate(doc: EditorDocument): ValidationError[] {
    const errors: ValidationError[] = [];
    if (doc.children.length === 0) {
      errors.push({ path: [], code: "empty-document", message: "Document must contain at least one block node" });
    } else {
      const topTypes = doc.children.map((child) => child.type);
      const topOk = matchesContentExpression("block+", topTypes, (tokenName, childType) =>
        this.nodeMatchesToken(tokenName, childType)
      );
      if (!topOk) {
        errors.push({
          path: [],
          code: "invalid-child",
          message: `Document root children [${topTypes.join(", ")}] must all belong to the "block" group`
        });
      }
    }
    for (const entry of walk(doc)) {
      this.validateNode(entry.node, entry.path, errors);
    }
    return errors;
  }
}
