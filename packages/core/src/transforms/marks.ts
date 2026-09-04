import { isEqualPath, textNodes } from "../model/node";
import type { Mark } from "../model/types";
import { comparePoints } from "../position/point";
import type { NormalizedRange } from "../selection/selection";
import type { Transaction } from "../transaction/transaction";

/**
 * Splits text leaves at the range boundaries (if needed) so the range's
 * content lines up exactly with whole leaves, then invokes `apply` on the
 * path of every leaf fully inside the range. Works uniformly whether the
 * range sits inside one leaf, spans several inline leaves in one block, or
 * spans multiple blocks, by tracking leaves as integer positions in
 * document order rather than by structural path arithmetic.
 */
function withLeavesInRange(tx: Transaction, range: NormalizedRange, apply: (path: number[]) => void): void {
  if (range.isCollapsed) return;

  const leaves = [...textNodes(tx.doc)];
  const seqStart = leaves.findIndex((entry) => isEqualPath(entry.path, range.start.path));
  const seqEnd = leaves.findIndex((entry) => isEqualPath(entry.path, range.end.path));
  if (seqStart === -1 || seqEnd === -1) throw new Error("Range endpoints must address existing text leaves");

  const endLeaf = leaves[seqEnd];
  if (endLeaf && range.end.offset < endLeaf.node.text.length) {
    tx.splitText(range.end.path, range.end.offset);
  }

  let markStart = seqStart;
  let markEnd = seqEnd;
  if (range.start.offset > 0) {
    tx.splitText(range.start.path, range.start.offset);
    markStart = seqStart + 1;
    markEnd = seqEnd + 1;
  }

  const finalLeaves = [...textNodes(tx.doc)];
  for (let i = markStart; i <= markEnd; i += 1) {
    const entry = finalLeaves[i];
    if (entry) apply(entry.path);
  }
}

export function applyMarkToRange(tx: Transaction, range: NormalizedRange, mark: Mark): void {
  withLeavesInRange(tx, range, (path) => tx.setMark(path, mark));
}

export function removeMarkFromRange(tx: Transaction, range: NormalizedRange, markType: string): void {
  withLeavesInRange(tx, range, (path) => tx.removeMark(path, markType));
}

/** True only if every leaf touched by the range already carries the mark
 * (used to decide whether a toolbar toggle should add or remove it, and to
 * report toolbar "active"/"mixed" state). */
export function isMarkActiveAcrossRange(
  doc: Parameters<typeof textNodes>[0],
  range: NormalizedRange,
  markType: string
): "active" | "inactive" | "mixed" {
  const leaves = [...textNodes(doc)].filter(
    (entry) =>
      comparePoints({ path: entry.path, offset: 0 }, { path: range.end.path, offset: range.end.offset }) < 0 &&
      comparePoints(
        { path: entry.path, offset: entry.node.text.length },
        { path: range.start.path, offset: range.start.offset }
      ) > 0
  );
  if (leaves.length === 0) return "inactive";
  const states = leaves.map((entry) => entry.node.marks.some((mark) => mark.type === markType));
  if (states.every(Boolean)) return "active";
  if (states.every((state) => !state)) return "inactive";
  return "mixed";
}
