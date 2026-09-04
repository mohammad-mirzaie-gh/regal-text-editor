import type { EditorDocument } from "../model/types";
import { clampPoint, comparePoints, isEqualPoint, type Point } from "../position/point";
import type { CursorSelection, RangeSelection, Selection } from "./types";

export function cursor(position: Point): CursorSelection {
  return { type: "cursor", position };
}

export function range(anchor: Point, focus: Point): Selection {
  if (isEqualPoint(anchor, focus)) return cursor(anchor);
  return { type: "range", anchor, focus };
}

export interface NormalizedRange {
  anchor: Point;
  focus: Point;
  start: Point;
  end: Point;
  isBackward: boolean;
  isCollapsed: boolean;
}

export function normalizeSelection(selection: Selection): NormalizedRange {
  const anchor = selection.type === "cursor" ? selection.position : selection.anchor;
  const focus = selection.type === "cursor" ? selection.position : selection.focus;
  const isBackward = comparePoints(anchor, focus) > 0;
  return {
    anchor,
    focus,
    start: isBackward ? focus : anchor,
    end: isBackward ? anchor : focus,
    isBackward,
    isCollapsed: isEqualPoint(anchor, focus)
  };
}

export function isCollapsed(selection: Selection): boolean {
  return selection.type === "cursor" || isEqualPoint(selection.anchor, selection.focus);
}

export function clampSelection(doc: EditorDocument, selection: Selection): Selection {
  if (selection.type === "cursor") {
    return cursor(clampPoint(doc, selection.position));
  }
  return range(clampPoint(doc, selection.anchor), clampPoint(doc, selection.focus)) as RangeSelection | CursorSelection;
}
