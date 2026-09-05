import { describe, expect, it } from "vitest";
import { createDocument, createElement, createText } from "../model/node";
import { clampSelection, cursor, isCollapsed, normalizeSelection, range } from "../selection/selection";

describe("cursor / range", () => {
  it("cursor wraps a point as a cursor selection", () => {
    expect(cursor({ path: [0, 0], offset: 2 })).toEqual({ type: "cursor", position: { path: [0, 0], offset: 2 } });
  });

  it("range collapses to a cursor selection when anchor and focus are equal", () => {
    const point = { path: [0, 0], offset: 2 };
    expect(range(point, point)).toEqual({ type: "cursor", position: point });
  });

  it("range stays a range selection when anchor and focus differ", () => {
    const anchor = { path: [0, 0], offset: 0 };
    const focus = { path: [0, 0], offset: 5 };
    expect(range(anchor, focus)).toEqual({ type: "range", anchor, focus });
  });
});

describe("normalizeSelection", () => {
  it("treats a cursor selection's single point as both anchor and focus", () => {
    const position = { path: [0, 0], offset: 3 };
    const normalized = normalizeSelection(cursor(position));
    expect(normalized).toMatchObject({ anchor: position, focus: position, isBackward: false, isCollapsed: true });
    expect(normalized.start).toEqual(position);
    expect(normalized.end).toEqual(position);
  });

  it("keeps start/end in document order for a forward range", () => {
    const anchor = { path: [0, 0], offset: 0 };
    const focus = { path: [0, 0], offset: 5 };
    const normalized = normalizeSelection({ type: "range", anchor, focus });
    expect(normalized.isBackward).toBe(false);
    expect(normalized.start).toEqual(anchor);
    expect(normalized.end).toEqual(focus);
  });

  it("swaps start/end for a backward range and reports isBackward", () => {
    const anchor = { path: [0, 0], offset: 5 };
    const focus = { path: [0, 0], offset: 0 };
    const normalized = normalizeSelection({ type: "range", anchor, focus });
    expect(normalized.isBackward).toBe(true);
    expect(normalized.start).toEqual(focus);
    expect(normalized.end).toEqual(anchor);
  });

  it("reports isCollapsed for a zero-length range", () => {
    const point = { path: [0, 0], offset: 3 };
    const normalized = normalizeSelection({ type: "range", anchor: point, focus: point });
    expect(normalized.isCollapsed).toBe(true);
  });
});

describe("isCollapsed", () => {
  it("is always true for a cursor selection", () => {
    expect(isCollapsed(cursor({ path: [0, 0], offset: 0 }))).toBe(true);
  });

  it("is true for a range whose anchor equals its focus", () => {
    const point = { path: [0, 0], offset: 3 };
    expect(isCollapsed({ type: "range", anchor: point, focus: point })).toBe(true);
  });

  it("is false for a non-collapsed range", () => {
    expect(
      isCollapsed({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } })
    ).toBe(false);
  });
});

describe("clampSelection", () => {
  it("clamps a cursor selection's offset into the leaf's bounds", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    expect(clampSelection(doc, cursor({ path: [0, 0], offset: 999 }))).toEqual(cursor({ path: [0, 0], offset: 5 }));
  });

  it("clamps a range's anchor and focus independently, collapsing to a cursor if they become equal", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hi")])]);
    const clamped = clampSelection(doc, { type: "range", anchor: { path: [0, 0], offset: 999 }, focus: { path: [0, 0], offset: 999 } });
    expect(clamped).toEqual(cursor({ path: [0, 0], offset: 2 }));
  });

  it("clamps a range's anchor and focus to different in-bounds offsets, keeping it a range", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    const clamped = clampSelection(doc, { type: "range", anchor: { path: [0, 0], offset: -3 }, focus: { path: [0, 0], offset: 3 } });
    expect(clamped).toEqual({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 3 } });
  });
});
