import type { Attrs, EditorNode, Mark } from "../model/types";
import type { Selection } from "../selection/types";

/**
 * Operations are the smallest units of change the model supports. Every
 * higher-level edit (splitting a block, toggling a mark over a selection,
 * pasting content) decomposes into a sequence of these before it is applied
 * — this is what makes undo/redo, normalization and (eventually) remote/
 * collaborative operations possible on a single, uniform substrate.
 *
 * Path conventions:
 *  - `insertText` / `removeText` / `setMark` / `removeMark` / `splitText`: `path` addresses the text leaf itself.
 *  - `insertNode`: `path` addresses the slot the new node will occupy (parent = path.slice(0, -1), index = path.at(-1)).
 *  - `removeNode` / `setNodeAttribute`: `path` addresses the node being changed.
 *  - `mergeNodes`: `path` addresses the node that gets merged into its preceding sibling and removed.
 *  - `moveNode`: `from` addresses the node to move, `to` addresses its destination slot (evaluated after removal).
 */
export type Operation =
  | { type: "insertText"; path: number[]; offset: number; text: string }
  | { type: "removeText"; path: number[]; offset: number; length: number }
  | { type: "insertNode"; path: number[]; node: EditorNode }
  | { type: "removeNode"; path: number[] }
  | { type: "setNodeAttribute"; path: number[]; attrs: Attrs }
  | { type: "setMark"; path: number[]; mark: Mark }
  | { type: "removeMark"; path: number[]; markType: string }
  | { type: "splitText"; path: number[]; offset: number }
  | { type: "mergeNodes"; path: number[] }
  | { type: "moveNode"; from: number[]; to: number[] };

export type HistoryGroup = "typing" | "composition" | "structural" | "none";

export type TransactionOrigin =
  | "user"
  | "keyboard"
  | "paste"
  | "drop"
  | "command"
  | "history"
  | "remote"
  | "system";

export interface TransactionMeta {
  origin: TransactionOrigin;
  timestamp: number;
  historyGroup: HistoryGroup;
  /** Free-form metadata plugins can attach (e.g. author id for future collaboration). */
  [key: string]: unknown;
}

export interface AppliedTransaction {
  operations: Operation[];
  selectionBefore: Selection | null;
  selectionAfter: Selection | null;
  meta: TransactionMeta;
}
