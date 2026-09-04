import {
  applyMarkToRange,
  blockTextOffset,
  comparePoints,
  escapeHtml,
  findTextBlockPath,
  isEqualPath,
  isMarkActiveAcrossRange,
  marksAtPoint,
  normalizeDocument,
  normalizeSelection,
  pointFromBlockTextOffset,
  removeMarkFromRange,
  safeAttr,
  sanitizeUrl,
  textNodes,
  type Command,
  type Editor,
  type Mark,
  type NormalizedRange,
  type Plugin,
  type RangeSelection,
  type Transaction
} from "@rte/core";

const MARK_TYPE = "link";

/** Resolves a selection restored via block-relative text offsets against
 * `tx.doc` *as normalization will leave it*, not `tx.doc` as the
 * transaction's own operations left it. Removing a mark can make two
 * adjacent leaves identical (same, now-empty, mark set), which
 * normalization then merges into one — a merge the transaction itself
 * never records as an operation, so a point resolved against the
 * pre-merge `tx.doc` can reference a leaf index that won't exist by the
 * time `editor.dispatch` normalizes and validates the selection.
 * Normalizing here mirrors exactly what `dispatch` is about to do
 * (same function, same inputs), so the resolved path is guaranteed valid. */
function restoreRangeAfterMarkChange(
  editor: Editor,
  tx: Transaction,
  startBlockPath: number[],
  startOffset: number,
  endOffset: number,
  isBackward: boolean
): RangeSelection {
  const normalized = normalizeDocument(editor.schema, tx.doc);
  const newStart = pointFromBlockTextOffset(normalized, startBlockPath, startOffset);
  const newEnd = pointFromBlockTextOffset(normalized, startBlockPath, endOffset);
  return { type: "range", anchor: isBackward ? newEnd : newStart, focus: isBackward ? newStart : newEnd };
}

/** Applies (or replaces) a link over the current selection. Requires a
 * non-collapsed selection — unlike a toggle-mark (bold, italic, ...), a
 * link with no text to carry it isn't meaningful, so this is a dedicated
 * `href` argument rather than the toggle-at-a-collapsed-cursor pattern
 * `plugin-basic-marks` uses. Re-running this over text that already
 * carries a link replaces its href rather than stacking a second mark
 * (`addMark` already dedupes by mark type). */
const setLinkCommand: Command = {
  execute(editor: Editor, ...args: unknown[]) {
    const rawHref = args[0];
    if (typeof rawHref !== "string" || rawHref.length === 0) return false;
    // Sanitized here, at the point of entry into the model, rather than
    // only on HTML export/import — a command-driven href (typed into a UI
    // popover) never passes through the HTML parser's own sanitization, and
    // markHtmlSerializers below writes it straight into real DOM via
    // `innerHTML`, so an unsanitized "javascript:" href would be a live XSS
    // vector the moment the document re-renders.
    const href = sanitizeUrl(rawHref);
    if (href.length === 0) return false;
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    if (range.isCollapsed) return false;

    const startBlockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
    const endBlockPath = findTextBlockPath(editor.doc, editor.schema, range.end.path);
    const sameBlock = isEqualPath(startBlockPath, endBlockPath);
    const startOffset = sameBlock ? blockTextOffset(editor.doc, startBlockPath, range.start) : null;
    const endOffset = sameBlock ? blockTextOffset(editor.doc, startBlockPath, range.end) : null;

    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    applyMarkToRange(tx, range, { type: MARK_TYPE, attrs: { href } });

    if (sameBlock && startOffset !== null && endOffset !== null) {
      tx.setSelection(restoreRangeAfterMarkChange(editor, tx, startBlockPath, startOffset, endOffset, range.isBackward));
    } else {
      tx.setSelection(selection);
    }
    editor.dispatch(tx);
    return true;
  },
  canExecute(editor: Editor) {
    const selection = editor.getSelection();
    return selection !== null && !normalizeSelection(selection).isCollapsed;
  },
  isActive(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    if (range.isCollapsed) return marksAtPoint(editor.doc, range.start).some((mark) => mark.type === MARK_TYPE);
    return isMarkActiveAcrossRange(editor.doc, range, MARK_TYPE) === "active";
  }
};

const unsetLinkCommand: Command = {
  execute(editor: Editor) {
    const selection = editor.getSelection();
    if (!selection) return false;
    const range = normalizeSelection(selection);
    if (range.isCollapsed) return false;

    // Same block-relative restoration as setLinkCommand above, and for the
    // same reason: removing a mark can merge the now-identically-marked
    // leaf back into its neighbor during normalization, which would leave
    // a selection built from pre-transaction paths pointing at a leaf that
    // no longer exists — clampSelection would then throw trying to resolve
    // it (caught by Editor, but silently drops the selection to null).
    const startBlockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
    const endBlockPath = findTextBlockPath(editor.doc, editor.schema, range.end.path);
    const sameBlock = isEqualPath(startBlockPath, endBlockPath);
    const startOffset = sameBlock ? blockTextOffset(editor.doc, startBlockPath, range.start) : null;
    const endOffset = sameBlock ? blockTextOffset(editor.doc, startBlockPath, range.end) : null;

    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    removeMarkFromRange(tx, range, MARK_TYPE);

    if (sameBlock && startOffset !== null && endOffset !== null) {
      tx.setSelection(restoreRangeAfterMarkChange(editor, tx, startBlockPath, startOffset, endOffset, range.isBackward));
    } else {
      tx.setSelection(selection);
    }
    editor.dispatch(tx);
    return true;
  },
  canExecute(editor: Editor) {
    return setLinkCommand.isActive!(editor) === true;
  }
};

/** The marks of the first text leaf that genuinely overlaps `range` (same
 * interval-overlap test `isMarkActiveAcrossRange` uses). Needed instead of
 * just reading `range.start`'s own leaf directly: `pointFromBlockTextOffset`
 * (used to restore a selection after a structural edit) resolves an offset
 * that lands exactly on a leaf boundary to the *end of the previous* leaf,
 * not the start of the next — so immediately after applying a link over an
 * exact selection, `range.start.path` can legitimately address the
 * unmarked leaf just before it. An overlap test is robust to which side of
 * the boundary a point happens to resolve to. */
function firstOverlappingLeafMarks(editor: Editor, range: NormalizedRange): Mark[] {
  for (const entry of textNodes(editor.doc)) {
    const leafStart = { path: entry.path, offset: 0 };
    const leafEnd = { path: entry.path, offset: entry.node.text.length };
    if (comparePoints(leafStart, range.end) < 0 && comparePoints(leafEnd, range.start) > 0) {
      return entry.node.marks;
    }
  }
  return [];
}

/** Reads the href of the link at a collapsed cursor or covering a selection
 * (the first leaf's href when the selection isn't uniformly linked) — for a
 * link-editing UI to pre-fill its URL field with. Returns `null` when there
 * is no link at the current selection. */
export function getActiveLinkHref(editor: Editor): string | null {
  const selection = editor.getSelection();
  if (!selection) return null;
  const range = normalizeSelection(selection);
  const marks = range.isCollapsed ? marksAtPoint(editor.doc, range.start) : firstOverlappingLeafMarks(editor, range);
  const link = marks.find((mark) => mark.type === MARK_TYPE);
  return typeof link?.attrs.href === "string" ? link.attrs.href : null;
}

/** Link mark: schema (href/title attrs), `setLink`/`unsetLink` commands,
 * and HTML/Markdown import/export. There is no default keyboard shortcut —
 * inserting a link needs a URL from the user, which only a UI (see
 * `@rte/ui`'s link popover) can collect. */
export function LinkPlugin(): Plugin {
  return {
    name: "link",
    schema: {
      marks: [{ name: MARK_TYPE, attrs: { href: { default: "" }, title: { default: null } } }]
    },
    commands: () => ({
      setLink: setLinkCommand,
      unsetLink: unsetLinkCommand
    }),
    markHtmlSerializers: {
      [MARK_TYPE]: (mark, content) => {
        const href = escapeHtml(sanitizeUrl(typeof mark.attrs.href === "string" ? mark.attrs.href : ""));
        const title = typeof mark.attrs.title === "string" ? ` title="${escapeHtml(mark.attrs.title)}"` : "";
        return `<a href="${href}"${title} rel="noopener noreferrer">${content}</a>`;
      }
    },
    markMarkdownSerializers: {
      [MARK_TYPE]: (mark, content) => {
        const href = sanitizeUrl(typeof mark.attrs.href === "string" ? mark.attrs.href : "");
        return `[${content}](${href})`;
      }
    },
    htmlParsers: (registry) => {
      registry.registerMark("a", (el) => ({
        type: MARK_TYPE,
        attrs: { href: safeAttr(el, "href"), title: el.getAttribute("title") }
      }));
    }
  };
}
