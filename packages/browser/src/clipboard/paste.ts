import { createElement, createText, parseHTML, type Editor, type ElementNode } from "@regal-text-editor/core";

function plainTextToBlocks(editor: Editor, text: string): ElementNode[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paragraphs = normalized.split(/\n{2,}/);
  return paragraphs
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => createElement(editor.schema.defaultBlockType, {}, [createText(paragraph)]));
}

/**
 * Extracts document blocks from a paste/drop payload: HTML when the
 * clipboard offers it (parsed and sanitized through the same `parseHTML`
 * pipeline used for source-mode/import — see core/src/parsing/html.ts),
 * falling back to plain text split into paragraphs. Word/Google-Docs HTML
 * is not special-cased; it is handled the same as any other pasted HTML by
 * the generic recognized/unrecognized-tag fallback rules in the parser.
 */
export function extractPastedBlocks(editor: Editor, data: DataTransfer): ElementNode[] {
  const html = data.getData("text/html");
  if (html && html.trim().length > 0) {
    const doc = parseHTML(editor.schema, html, editor.htmlParserRegistry);
    if (doc.children.length > 0) return doc.children;
  }
  const text = data.getData("text/plain");
  if (text.length > 0) return plainTextToBlocks(editor, text);
  return [];
}
