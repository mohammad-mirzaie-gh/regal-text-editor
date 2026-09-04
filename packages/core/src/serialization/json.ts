import type { EditorDocument } from "../model/types";

/** The document model is already the canonical JSON representation — this
 * just returns a safe, detached deep copy so callers can't mutate editor
 * state by mutating the returned object. */
export function toJSON(doc: EditorDocument): EditorDocument {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as EditorDocument;
}

export function fromJSON(data: unknown): EditorDocument {
  if (
    typeof data !== "object" ||
    data === null ||
    (data as { object?: unknown }).object !== "document" ||
    !Array.isArray((data as { children?: unknown }).children)
  ) {
    throw new Error("Invalid document JSON: expected an object with object:\"document\" and a children array");
  }
  return toJSON(data as EditorDocument);
}
