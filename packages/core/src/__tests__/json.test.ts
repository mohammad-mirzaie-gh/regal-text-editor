import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocument, createElement, createText } from "../model/node";
import { fromJSON, toJSON } from "../serialization/json";

describe("toJSON", () => {
  it("returns a deep, detached copy that mutating the original doesn't affect", () => {
    const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
    const copy = toJSON(doc);
    expect(copy).toEqual(doc);
    expect(copy).not.toBe(doc);
    (doc.children[0] as { attrs: Record<string, unknown> }).attrs.mutated = true;
    expect((copy.children[0] as { attrs: Record<string, unknown> }).attrs.mutated).toBeUndefined();
  });

  it("falls back to JSON.parse/stringify when structuredClone is unavailable", () => {
    const original = globalThis.structuredClone;
    // @ts-expect-error simulating an environment without structuredClone
    delete globalThis.structuredClone;
    try {
      const doc = createDocument([createElement("paragraph", {}, [createText("hello")])]);
      const copy = toJSON(doc);
      expect(copy).toEqual(doc);
      expect(copy).not.toBe(doc);
    } finally {
      globalThis.structuredClone = original;
    }
  });
});

describe("fromJSON", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid document shape and returns a detached copy of it", () => {
    const raw = { object: "document", id: "d1", children: [{ object: "element", id: "e1", type: "paragraph", attrs: {}, children: [] }] };
    const result = fromJSON(raw);
    expect(result).toEqual(raw);
    expect(result).not.toBe(raw);
  });

  it("rejects null", () => {
    expect(() => fromJSON(null)).toThrow(/Invalid document JSON/);
  });

  it("rejects a non-object value", () => {
    expect(() => fromJSON("just a string")).toThrow(/Invalid document JSON/);
  });

  it("rejects an object missing object:\"document\"", () => {
    expect(() => fromJSON({ children: [] })).toThrow(/Invalid document JSON/);
  });

  it("rejects an object whose object field is the wrong value", () => {
    expect(() => fromJSON({ object: "element", children: [] })).toThrow(/Invalid document JSON/);
  });

  it("rejects an object with a non-array children field", () => {
    expect(() => fromJSON({ object: "document", children: "nope" })).toThrow(/Invalid document JSON/);
  });

  it("rejects an object missing children entirely", () => {
    expect(() => fromJSON({ object: "document" })).toThrow(/Invalid document JSON/);
  });
});
