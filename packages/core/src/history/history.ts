import type { EditorDocument } from "../model/types";
import type { Selection } from "../selection/types";
import type { HistoryGroup } from "../transaction/operations";

export interface HistoryConfig {
  /** Consecutive "typing" transactions within this window (ms) merge into one undo step. */
  typingDelay: number;
  maxEntries: number;
}

export const defaultHistoryConfig: HistoryConfig = { typingDelay: 500, maxEntries: 1000 };

interface HistoryEntry {
  docBefore: EditorDocument;
  selectionBefore: Selection | null;
  docAfter: EditorDocument;
  selectionAfter: Selection | null;
}

export interface HistoryStep {
  doc: EditorDocument;
  selection: Selection | null;
}

/**
 * History is snapshot-based rather than built on inverting individual
 * operations: each entry keeps a reference to the document immediately
 * before and after the change. Because the document is a persistent,
 * structurally-shared immutable tree (see transforms/apply.ts), holding
 * both snapshots costs a couple of object references, not a deep copy —
 * so this stays cheap while sidestepping an entire class of bugs that
 * come from deriving a generic inverse for structural operations like
 * element merges. A future collaborative-editing phase that needs a full
 * invertible op log can be layered on without changing this entry shape.
 */
export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private lastGroup: HistoryGroup | null = null;
  private lastTimestamp = 0;

  constructor(private config: HistoryConfig = defaultHistoryConfig) {}

  record(
    group: HistoryGroup,
    timestamp: number,
    docBefore: EditorDocument,
    selectionBefore: Selection | null,
    docAfter: EditorDocument,
    selectionAfter: Selection | null
  ): void {
    if (group === "none") return;
    this.redoStack = [];

    const top = this.undoStack[this.undoStack.length - 1];
    const canMerge =
      group === "typing" &&
      this.lastGroup === "typing" &&
      top !== undefined &&
      timestamp - this.lastTimestamp < this.config.typingDelay;

    if (canMerge && top) {
      top.docAfter = docAfter;
      top.selectionAfter = selectionAfter;
    } else {
      this.undoStack.push({ docBefore, selectionBefore, docAfter, selectionAfter });
      if (this.undoStack.length > this.config.maxEntries) this.undoStack.shift();
    }

    this.lastGroup = group;
    this.lastTimestamp = timestamp;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): HistoryStep | undefined {
    const entry = this.undoStack.pop();
    if (!entry) return undefined;
    this.redoStack.push(entry);
    this.lastGroup = null;
    return { doc: entry.docBefore, selection: entry.selectionBefore };
  }

  redo(): HistoryStep | undefined {
    const entry = this.redoStack.pop();
    if (!entry) return undefined;
    this.undoStack.push(entry);
    this.lastGroup = null;
    return { doc: entry.docAfter, selection: entry.selectionAfter };
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.lastGroup = null;
  }
}
