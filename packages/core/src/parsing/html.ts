import { createElement, createText } from "../model/node";
import type { EditorDocument, EditorNode, ElementNode, Mark } from "../model/types";
import type { Schema } from "../schema/schema";
import { isDangerousTag, isEventHandlerAttribute, sanitizeUrl } from "../utils/sanitize";

export interface HtmlParseContext {
  parseInline: (el: Element) => EditorNode[];
  parseBlocks: (el: Element) => ElementNode[];
}

export type BlockHtmlParser = (el: Element, ctx: HtmlParseContext) => ElementNode | ElementNode[] | null;
export type MarkHtmlParser = (el: Element) => Mark | null;

export class HtmlParserRegistry {
  private readonly blockParsers = new Map<string, BlockHtmlParser>();
  private readonly markParsers = new Map<string, MarkHtmlParser>();

  registerBlock(tag: string, parser: BlockHtmlParser): void {
    this.blockParsers.set(tag.toLowerCase(), parser);
  }

  registerMark(tag: string, parser: MarkHtmlParser): void {
    this.markParsers.set(tag.toLowerCase(), parser);
  }

  getBlock(tag: string): BlockHtmlParser | undefined {
    return this.blockParsers.get(tag.toLowerCase());
  }

  getMark(tag: string): MarkHtmlParser | undefined {
    return this.markParsers.get(tag.toLowerCase());
  }
}

/** Reads an attribute value with URL-scheme sanitization applied — the one
 * function every block/mark parser should use to read href/src attributes. */
export function safeAttr(el: Element, name: string): string {
  const value = el.getAttribute(name) ?? "";
  return sanitizeUrl(value);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

function parseInlineInto(node: Node, registry: HtmlParserRegistry, marks: Mark[], out: EditorNode[]): void {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const text = collapseWhitespace(node.textContent ?? "");
    if (text.length > 0) out.push(createText(text, marks));
    return;
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (isDangerousTag(tag)) return;

  if (tag === "br") {
    out.push(createText("\n", marks));
    return;
  }

  const markParser = registry.getMark(tag);
  const parsedMark = markParser ? markParser(el) : null;
  const nextMarks = parsedMark ? [...marks, parsedMark] : marks;

  for (const child of Array.from(el.childNodes)) {
    parseInlineInto(child, registry, nextMarks, out);
  }
}

function parseInline(el: Element, registry: HtmlParserRegistry): EditorNode[] {
  const out: EditorNode[] = [];
  for (const child of Array.from(el.childNodes)) parseInlineInto(child, registry, [], out);
  return out;
}

function isWhitespaceOnly(text: string): boolean {
  return /^\s*$/.test(text);
}

function parseBlocks(el: Element, registry: HtmlParserRegistry, schema: Schema, ctx: HtmlParseContext): ElementNode[] {
  const result: ElementNode[] = [];
  let pendingInline: EditorNode[] = [];

  const flushPendingInline = (): void => {
    if (pendingInline.length === 0) return;
    result.push(createElement(schema.defaultBlockType, {}, pendingInline));
    pendingInline = [];
  };

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      const text = child.textContent ?? "";
      if (!isWhitespaceOnly(text)) pendingInline.push(createText(collapseWhitespace(text)));
      continue;
    }
    if (child.nodeType !== 1) continue;

    const childEl = child as Element;
    const tag = childEl.tagName.toLowerCase();
    if (isDangerousTag(tag)) continue;

    const blockParser = registry.getBlock(tag);
    if (blockParser) {
      flushPendingInline();
      const parsed = blockParser(childEl, ctx);
      if (Array.isArray(parsed)) result.push(...parsed);
      else if (parsed) result.push(parsed);
      continue;
    }

    // Unrecognized element: treat as a transparent container and recurse
    // into it for nested blocks, unless it only carries inline content.
    const nestedBlocks = parseBlocks(childEl, registry, schema, ctx);
    if (nestedBlocks.length > 0) {
      flushPendingInline();
      result.push(...nestedBlocks);
    } else {
      pendingInline.push(...parseInline(childEl, registry));
    }
  }

  flushPendingInline();
  return result;
}

function stripDangerousAttributes(root: Element): void {
  const all = root.querySelectorAll("*");
  const elements = [root, ...Array.from(all)];
  for (const el of elements) {
    for (const attr of Array.from(el.attributes)) {
      if (isEventHandlerAttribute(attr.name)) el.removeAttribute(attr.name);
    }
    if (el.tagName.toLowerCase() === "a" || el.tagName.toLowerCase() === "img") {
      const urlAttr = el.tagName.toLowerCase() === "a" ? "href" : "src";
      const value = el.getAttribute(urlAttr);
      if (value !== null) el.setAttribute(urlAttr, sanitizeUrl(value));
    }
  }
  for (const dangerous of Array.from(root.querySelectorAll("script, style, iframe, object, embed, link, meta, base, form"))) {
    dangerous.remove();
  }
}

/** Parses untrusted HTML (paste, source mode, import) into the document
 * model. Requires a DOMParser-compatible global (available in browsers and
 * in jsdom test environments) — the one place core intentionally leans on
 * a DOM API rather than staying purely data-structural, because there is
 * no reasonable way to parse real-world HTML without one. */
export function parseHTML(schema: Schema, html: string, registry: HtmlParserRegistry): EditorDocument {
  if (typeof DOMParser === "undefined") {
    throw new Error("parseHTML requires a DOMParser-compatible global (browser or jsdom environment)");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  stripDangerousAttributes(doc.body);

  const ctx: HtmlParseContext = {
    parseInline: (el) => parseInline(el, registry),
    parseBlocks: (el) => parseBlocks(el, registry, schema, ctx)
  };

  const blocks = parseBlocks(doc.body, registry, schema, ctx);
  return { object: "document", id: `doc_${Date.now().toString(36)}`, children: blocks };
}
