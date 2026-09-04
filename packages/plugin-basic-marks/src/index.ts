import {
  addMark,
  applyMarkToRange,
  blockTextOffset,
  findTextBlockPath,
  isEqualPath,
  isMarkActiveAcrossRange,
  marksAtPoint,
  normalizeDocument,
  normalizeSelection,
  pointFromBlockTextOffset,
  removeMark,
  removeMarkFromRange,
  type Command,
  type Editor,
  type Mark,
  type Plugin,
  type RangeSelection
} from "@rte/core";

export interface MarkDefinition {
  /** Node/mark type name used in the document model. */
  type: string;
  /** Command name registered as `toggle<Name>`, e.g. "toggleBold". */
  commandName: string;
  keymap?: string;
  toHtml: (contentHtml: string) => string;
  htmlTags: string[];
  toMarkdown?: (contentMarkdown: string) => string;
}

function toggleMarkCommand(markType: string): Command {
  return {
    execute(editor: Editor) {
      const selection = editor.getSelection();
      if (!selection) return false;
      const range = normalizeSelection(selection);

      if (range.isCollapsed) {
        const current = editor.getStoredMarks() ?? marksAtPoint(editor.doc, range.start);
        const active = current.some((mark) => mark.type === markType);
        editor.setStoredMarks(active ? removeMark(current, markType) : addMark(current, { type: markType, attrs: {} }));
        return true;
      }

      // Applying/removing a mark splits text leaves at the range boundaries,
      // which invalidates the original {path, offset} endpoints even though
      // the block itself doesn't move. Re-express them as block-local
      // character offsets first so they can be resolved back correctly
      // after the split (see position/point.ts for why paths alone don't survive this).
      const startBlockPath = findTextBlockPath(editor.doc, editor.schema, range.start.path);
      const endBlockPath = findTextBlockPath(editor.doc, editor.schema, range.end.path);
      const sameBlock = isEqualPath(startBlockPath, endBlockPath);
      const startOffset = sameBlock ? blockTextOffset(editor.doc, startBlockPath, range.start) : null;
      const endOffset = sameBlock ? blockTextOffset(editor.doc, startBlockPath, range.end) : null;

      const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
      const active = isMarkActiveAcrossRange(editor.doc, range, markType) === "active";
      if (active) removeMarkFromRange(tx, range, markType);
      else applyMarkToRange(tx, range, { type: markType, attrs: {} });

      if (sameBlock && startOffset !== null && endOffset !== null) {
        // Resolved against the *normalized* doc, not tx.doc as the
        // transaction's own operations left it: removing a mark can leave
        // two adjacent leaves with identical (now empty) mark sets, which
        // normalization then merges into one — a merge the transaction
        // itself never records as an operation. A point resolved against
        // the pre-merge tx.doc can address a leaf index that won't exist
        // by the time `editor.dispatch` normalizes and validates the
        // selection (e.g. toggling bold off over exactly a bolded run with
        // plain-text neighbors on both sides). Normalizing here mirrors
        // exactly what dispatch is about to do, so the path is guaranteed
        // to resolve.
        const normalized = normalizeDocument(editor.schema, tx.doc);
        const newStart = pointFromBlockTextOffset(normalized, startBlockPath, startOffset);
        const newEnd = pointFromBlockTextOffset(normalized, startBlockPath, endOffset);
        const restored: RangeSelection = {
          type: "range",
          anchor: range.isBackward ? newEnd : newStart,
          focus: range.isBackward ? newStart : newEnd
        };
        tx.setSelection(restored);
      } else {
        tx.setSelection(selection);
      }
      editor.dispatch(tx);
      return true;
    },
    canExecute(editor: Editor) {
      return editor.getSelection() !== null;
    },
    isActive(editor: Editor) {
      const selection = editor.getSelection();
      if (!selection) return false;
      const range = normalizeSelection(selection);
      if (range.isCollapsed) {
        const marks: Mark[] = editor.getStoredMarks() ?? marksAtPoint(editor.doc, range.start);
        return marks.some((mark) => mark.type === markType);
      }
      return isMarkActiveAcrossRange(editor.doc, range, markType) === "active";
    }
  };
}

const definitions: MarkDefinition[] = [
  { type: "bold", commandName: "toggleBold", keymap: "Mod-b", htmlTags: ["strong", "b"], toHtml: (c) => `<strong>${c}</strong>`, toMarkdown: (c) => `**${c}**` },
  { type: "italic", commandName: "toggleItalic", keymap: "Mod-i", htmlTags: ["em", "i"], toHtml: (c) => `<em>${c}</em>`, toMarkdown: (c) => `_${c}_` },
  { type: "underline", commandName: "toggleUnderline", keymap: "Mod-u", htmlTags: ["u"], toHtml: (c) => `<u>${c}</u>` },
  { type: "strikethrough", commandName: "toggleStrikethrough", keymap: "Mod-Shift-x", htmlTags: ["s", "strike", "del"], toHtml: (c) => `<s>${c}</s>`, toMarkdown: (c) => `~~${c}~~` },
  { type: "inlineCode", commandName: "toggleInlineCode", keymap: "Mod-e", htmlTags: ["code"], toHtml: (c) => `<code>${c}</code>`, toMarkdown: (c) => `\`${c}\`` }
];

/** Bold, italic, underline, strikethrough and inline code marks: schema,
 * toggle commands, keyboard shortcuts, and HTML/Markdown import/export. */
export function BasicMarksPlugin(): Plugin {
  const htmlSerializers: Record<string, (mark: Mark, content: string) => string> = {};
  const markdownSerializers: Record<string, (mark: Mark, content: string) => string> = {};
  const keymap: Record<string, string> = {};

  for (const def of definitions) {
    htmlSerializers[def.type] = (_mark, content) => def.toHtml(content);
    if (def.toMarkdown) markdownSerializers[def.type] = (_mark, content) => def.toMarkdown!(content);
    if (def.keymap) keymap[def.keymap] = def.commandName;
  }

  return {
    name: "basic-marks",
    schema: { marks: definitions.map((def) => ({ name: def.type })) },
    commands: () => Object.fromEntries(definitions.map((def) => [def.commandName, toggleMarkCommand(def.type)])),
    keymap: () => keymap,
    markHtmlSerializers: htmlSerializers,
    markMarkdownSerializers: markdownSerializers,
    htmlParsers: (registry) => {
      for (const def of definitions) {
        for (const tag of def.htmlTags) {
          registry.registerMark(tag, () => ({ type: def.type, attrs: {} }));
        }
      }
    }
  };
}

export const markDefinitions = definitions;
