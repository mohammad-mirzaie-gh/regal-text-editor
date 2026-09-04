import { isEqualPath, textNodes } from "../model/node";
import type { EditorDocument } from "../model/types";
import type { Point } from "../position/point";
import type { Schema } from "../schema/schema";
import type { Transaction } from "../transaction/transaction";
import { deleteRange } from "../transforms/delete";

export interface SearchMatch {
  start: Point;
  end: Point;
}

export interface SearchOptions {
  caseSensitive?: boolean;
}

interface FlatEntry {
  path: number[];
  start: number;
  length: number;
}

interface FlatIndex {
  text: string;
  entries: FlatEntry[];
}

/** Concatenates every text leaf's content in document order into one
 * searchable string, joining leaves from *different* text blocks with a
 * "\n" separator. Leaves within the same block (e.g. split across a mark
 * boundary like "hello **world**") are joined with nothing, since they are
 * genuinely contiguous text a query should be able to match across. The
 * separator between blocks exists specifically so a query can never match
 * across a block boundary by accident (e.g. "cat" at the end of one
 * paragraph plus "erpillar" at the start of the next reading as
 * "caterpillar") — real find/replace queries don't contain newlines, so
 * this never costs a legitimate match. */
function buildFlatIndex(doc: EditorDocument): FlatIndex {
  let text = "";
  const entries: FlatEntry[] = [];
  let previousBlockPath: number[] | null = null;
  for (const { node, path } of textNodes(doc)) {
    const blockPath = path.slice(0, -1);
    if (previousBlockPath && !isEqualPath(previousBlockPath, blockPath)) {
      text += "\n";
    }
    entries.push({ path, start: text.length, length: node.text.length });
    text += node.text;
    previousBlockPath = blockPath;
  }
  return { text, entries };
}

function pointFromFlatOffset(index: FlatIndex, offset: number): Point | undefined {
  for (const entry of index.entries) {
    if (offset >= entry.start && offset <= entry.start + entry.length) {
      return { path: entry.path, offset: offset - entry.start };
    }
  }
  return undefined;
}

/** Finds every occurrence of `query` in the document's text, in document
 * order. Matching is plain substring search (no regex), case-insensitive
 * by default. */
export function findMatches(doc: EditorDocument, query: string, options: SearchOptions = {}): SearchMatch[] {
  if (query.length === 0) return [];
  const index = buildFlatIndex(doc);
  const haystack = options.caseSensitive ? index.text : index.text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();

  const matches: SearchMatch[] = [];
  let fromIndex = 0;
  while (fromIndex <= haystack.length) {
    const foundAt = haystack.indexOf(needle, fromIndex);
    if (foundAt === -1) break;
    const spansBlockBoundary = index.text.slice(foundAt, foundAt + needle.length).includes("\n");
    if (!spansBlockBoundary) {
      const start = pointFromFlatOffset(index, foundAt);
      const end = pointFromFlatOffset(index, foundAt + needle.length);
      if (start && end) matches.push({ start, end });
    }
    fromIndex = foundAt + 1;
  }
  return matches;
}

/** Replaces the text spanned by `match` with `replacement`, returning the
 * cursor position immediately after the inserted text. */
export function replaceMatch(tx: Transaction, schema: Schema, match: SearchMatch, replacement: string): Point {
  const point = deleteRange(tx, schema, match.start, match.end);
  if (replacement.length > 0) tx.insertText(point.path, point.offset, replacement);
  return { path: point.path, offset: point.offset + replacement.length };
}

/** Replaces every match with `replacement` in a single transaction. Matches
 * are applied last-to-first: replacing a later match never shifts the path
 * of an earlier, not-yet-processed one, so `matches` can safely be computed
 * once up front (same reasoning as unwrapBlocks' last-to-first extraction). */
export function replaceAllMatches(tx: Transaction, schema: Schema, matches: SearchMatch[], replacement: string): number {
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    replaceMatch(tx, schema, matches[i]!, replacement);
  }
  return matches.length;
}
