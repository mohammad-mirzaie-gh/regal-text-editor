import type { Point } from "../position/point";

export interface CursorSelection {
  type: "cursor";
  position: Point;
}

export interface RangeSelection {
  type: "range";
  anchor: Point;
  focus: Point;
}

export type Selection = CursorSelection | RangeSelection;
