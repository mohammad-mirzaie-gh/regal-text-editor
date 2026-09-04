import type { Attrs, EditorDocument, EditorNode, Mark } from "../model/types";
import { applyOperation } from "../transforms/apply";
import type { Selection } from "../selection/types";
import type { Operation, TransactionMeta } from "./operations";

export interface TransactionResult {
  doc: EditorDocument;
  operations: Operation[];
  selectionBefore: Selection | null;
  selectionAfter: Selection | null;
  meta: TransactionMeta;
}

/**
 * Chainable builder for a batch of operations. Each call applies its
 * operation immediately to the transaction's working document so that
 * later calls compute paths against up-to-date state, then records the
 * operation so the whole batch can be replayed, undone, or (in the future)
 * shipped to remote peers.
 */
export class Transaction {
  doc: EditorDocument;
  readonly operations: Operation[] = [];
  selectionBefore: Selection | null;
  selectionAfter: Selection | null;
  meta: TransactionMeta;

  constructor(doc: EditorDocument, selection: Selection | null, meta: Partial<TransactionMeta> = {}) {
    this.doc = doc;
    this.selectionBefore = selection;
    this.selectionAfter = selection;
    this.meta = {
      origin: meta.origin ?? "command",
      timestamp: meta.timestamp ?? Date.now(),
      historyGroup: meta.historyGroup ?? "structural",
      ...meta
    };
  }

  private push(op: Operation): this {
    this.doc = applyOperation(this.doc, op);
    this.operations.push(op);
    return this;
  }

  insertText(path: number[], offset: number, text: string): this {
    return this.push({ type: "insertText", path, offset, text });
  }

  removeText(path: number[], offset: number, length: number): this {
    return this.push({ type: "removeText", path, offset, length });
  }

  insertNode(path: number[], node: EditorNode): this {
    return this.push({ type: "insertNode", path, node });
  }

  removeNode(path: number[]): this {
    return this.push({ type: "removeNode", path });
  }

  setNodeAttribute(path: number[], attrs: Attrs): this {
    return this.push({ type: "setNodeAttribute", path, attrs });
  }

  setMark(path: number[], mark: Mark): this {
    return this.push({ type: "setMark", path, mark });
  }

  removeMark(path: number[], markType: string): this {
    return this.push({ type: "removeMark", path, markType });
  }

  splitText(path: number[], offset: number): this {
    return this.push({ type: "splitText", path, offset });
  }

  mergeNodes(path: number[]): this {
    return this.push({ type: "mergeNodes", path });
  }

  moveNode(from: number[], to: number[]): this {
    return this.push({ type: "moveNode", from, to });
  }

  setSelection(selection: Selection | null): this {
    this.selectionAfter = selection;
    return this;
  }

  setMeta(meta: Partial<TransactionMeta>): this {
    this.meta = { ...this.meta, ...meta };
    return this;
  }

  isEmpty(): boolean {
    return this.operations.length === 0;
  }

  build(): TransactionResult {
    return {
      doc: this.doc,
      operations: this.operations,
      selectionBefore: this.selectionBefore,
      selectionAfter: this.selectionAfter,
      meta: this.meta
    };
  }
}
