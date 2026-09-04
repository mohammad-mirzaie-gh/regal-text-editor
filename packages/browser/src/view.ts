import {
  createText,
  cursor,
  deleteRange,
  endOfDocument,
  findTextBlockPath,
  getNodeAtPath,
  insertBlocksAtSelection,
  insertTextAtSelection,
  isCollapsed,
  mergeBlockBackward,
  normalizeSelection,
  sliceDocument,
  splitBlock,
  toHTML,
  toPlainText,
  type Editor,
  type Point,
  type Selection
} from "@rte/core";
import { collectDomTextNodes, domPointToModel, modelPointToDom } from "./dom/positions";
import { shortcutCandidates } from "./keyboard/shortcuts";
import { extractPastedBlocks } from "./clipboard/paste";

export interface EditorViewOptions {
  editor: Editor;
  container: HTMLElement;
  /** When true, renders read-only decorations without making the container editable. */
  autoFocus?: boolean;
}

function wordBackwardLength(text: string, offset: number): number {
  let i = offset;
  while (i > 0 && /\s/.test(text[i - 1]!)) i -= 1;
  while (i > 0 && !/\s/.test(text[i - 1]!)) i -= 1;
  return offset - i;
}

function wordForwardLength(text: string, offset: number): number {
  let i = offset;
  while (i < text.length && /\s/.test(text[i]!)) i += 1;
  while (i < text.length && !/\s/.test(text[i]!)) i += 1;
  return i - offset;
}

/**
 * Layer 2: renders the model to the DOM and translates browser input
 * (keyboard, composition, clipboard, selection) into editor transactions.
 * The DOM is always a *rendering target* here — `render()` regenerates it
 * from `editor.getHTML()` and the model never reads structure back out of
 * the DOM except to map a browser Selection onto a model Point.
 */
export class EditorView {
  readonly editor: Editor;
  readonly container: HTMLElement;

  private composing = false;
  private lastRenderedHtml: string | null = null;
  private readonly unsubscribe: () => void;
  private destroyed = false;

  constructor(options: EditorViewOptions) {
    this.editor = options.editor;
    this.container = options.container;

    this.container.setAttribute("contenteditable", this.editor.editable ? "true" : "false");
    this.container.setAttribute("role", "textbox");
    this.container.setAttribute("aria-multiline", "true");
    this.container.style.whiteSpace = "pre-wrap";
    this.container.spellcheck = true;

    this.attachEvents();
    this.render();
    if (options.autoFocus) this.container.focus();

    this.unsubscribe = this.editor.subscribe(() => this.render());
    this.editor.on("focus", () => this.container.focus());
    this.editor.on("blur", () => this.container.blur());
  }

  // ---- rendering ----------------------------------------------------

  private render(): void {
    if (this.composing) return;
    this.container.setAttribute("contenteditable", this.editor.editable ? "true" : "false");
    const html = toHTML(this.editor.doc, this.editor.htmlRegistry);
    if (html !== this.lastRenderedHtml) {
      this.container.innerHTML = html;
      this.lastRenderedHtml = html;
    }
    this.restoreSelection();
  }

  private restoreSelection(): void {
    const selection = this.editor.getSelection();
    const domSelection = document.getSelection();
    if (!domSelection) return;
    if (!selection) {
      if (domSelection.rangeCount > 0 && this.container.contains(domSelection.anchorNode)) {
        domSelection.removeAllRanges();
      }
      return;
    }
    const range = normalizeSelection(selection);
    const anchorDom = modelPointToDom(this.editor, this.container, range.isBackward ? range.end : range.start);
    const focusDom = modelPointToDom(this.editor, this.container, range.isBackward ? range.start : range.end);
    if (!anchorDom || !focusDom) return;
    domSelection.setBaseAndExtent(anchorDom.node, anchorDom.offset, focusDom.node, focusDom.offset);
  }

  // ---- event wiring ---------------------------------------------------

  private attachEvents(): void {
    this.container.addEventListener("beforeinput", this.onBeforeInput);
    this.container.addEventListener("keydown", this.onKeyDown);
    this.container.addEventListener("compositionstart", this.onCompositionStart);
    this.container.addEventListener("compositionend", this.onCompositionEnd);
    this.container.addEventListener("focus", this.onFocus);
    this.container.addEventListener("blur", this.onBlur);
    this.container.addEventListener("copy", this.onCopy);
    this.container.addEventListener("cut", this.onCut);
    this.container.addEventListener("paste", this.onPaste);
    this.container.addEventListener("drop", this.onDrop);
    this.container.addEventListener("dragover", this.onDragOver);
    document.addEventListener("selectionchange", this.onSelectionChange);
  }

  private detachEvents(): void {
    this.container.removeEventListener("beforeinput", this.onBeforeInput);
    this.container.removeEventListener("keydown", this.onKeyDown);
    this.container.removeEventListener("compositionstart", this.onCompositionStart);
    this.container.removeEventListener("compositionend", this.onCompositionEnd);
    this.container.removeEventListener("focus", this.onFocus);
    this.container.removeEventListener("blur", this.onBlur);
    this.container.removeEventListener("copy", this.onCopy);
    this.container.removeEventListener("cut", this.onCut);
    this.container.removeEventListener("paste", this.onPaste);
    this.container.removeEventListener("drop", this.onDrop);
    this.container.removeEventListener("dragover", this.onDragOver);
    document.removeEventListener("selectionchange", this.onSelectionChange);
  }

  // ---- selection sync -------------------------------------------------

  private onSelectionChange = (): void => {
    if (this.composing || this.destroyed) return;
    const domSelection = document.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) return;
    if (!this.container.contains(domSelection.anchorNode)) return;

    const anchor = domPointToModel(this.editor, this.container, domSelection.anchorNode!, domSelection.anchorOffset);
    const focus = domPointToModel(this.editor, this.container, domSelection.focusNode!, domSelection.focusOffset);
    if (!anchor || !focus) return;
    this.editor.setSelection(
      anchor.path.join(",") === focus.path.join(",") && anchor.offset === focus.offset
        ? cursor(anchor)
        : { type: "range", anchor, focus }
    );
  };

  private onFocus = (): void => this.editor.setFocused(true);
  private onBlur = (): void => this.editor.setFocused(false);

  // ---- keyboard ---------------------------------------------------------

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.composing || !this.editor.editable) return;

    for (const candidate of shortcutCandidates(event)) {
      const commandName = this.editor.keymap[candidate];
      if (commandName && this.editor.commands.execute(this.editor, commandName)) {
        event.preventDefault();
        return;
      }
    }

    if (event.key === "Tab") event.preventDefault();
  };

  // ---- beforeinput (structural text editing) ---------------------------

  private onBeforeInput = (event: InputEvent): void => {
    if (this.composing) return;
    if (!this.editor.editable) {
      event.preventDefault();
      return;
    }

    switch (event.inputType) {
      case "insertText":
      case "insertReplacementText": {
        event.preventDefault();
        const data = event.data ?? "";
        if (data.length > 0) this.insertText(data, "typing");
        return;
      }
      case "insertParagraph": {
        event.preventDefault();
        this.handleEnter();
        return;
      }
      case "insertLineBreak": {
        event.preventDefault();
        this.insertText("\n", "typing");
        return;
      }
      case "deleteContentBackward":
      case "deleteWordBackward":
      case "deleteSoftLineBackward":
      case "deleteHardLineBackward": {
        event.preventDefault();
        this.handleBackspace(event.inputType);
        return;
      }
      case "deleteContentForward":
      case "deleteWordForward":
      case "deleteSoftLineForward":
      case "deleteHardLineForward": {
        event.preventDefault();
        this.handleDeleteForward(event.inputType);
        return;
      }
      default: {
        // insertFromPaste/insertFromDrop are handled by dedicated paste/drop
        // listeners; anything else unrecognized is blocked rather than risking
        // a DOM edit the model can't reconcile.
        event.preventDefault();
        return;
      }
    }
  };

  /** Falls back to the end of the document when there is no model
   * selection yet — mirrors a real browser, where clicking/focusing always
   * establishes a native selection before any beforeinput can fire, so
   * typing right after focus never has to special-case "nothing selected". */
  private currentSelection(): Selection {
    return this.editor.getSelection() ?? cursor(endOfDocument(this.editor.doc));
  }

  private insertText(text: string, historyGroup: "typing" | "structural"): void {
    const range = normalizeSelection(this.currentSelection());
    const tx = this.editor.createTransaction({ origin: "keyboard", historyGroup });
    const storedMarks = this.editor.getStoredMarks();

    if (range.isCollapsed && storedMarks) {
      // Stored marks (set by a mark-toggle command at a collapsed cursor)
      // must land only on the newly typed text, not retroactively on
      // whatever the existing leaf already contained — so split off a
      // fresh leaf for it instead of appending into the current one.
      const point = range.start;
      tx.splitText(point.path, point.offset);
      const leafIndex = point.path[point.path.length - 1] as number;
      const newLeafPath = [...point.path.slice(0, -1), leafIndex + 1];
      tx.insertNode(newLeafPath, createText(text, storedMarks));
      const end: Point = { path: newLeafPath, offset: text.length };
      tx.setSelection(cursor(end));
      this.editor.dispatch(tx);
      return;
    }

    const end = insertTextAtSelection(tx, this.editor.schema, range, text);
    tx.setSelection(cursor(end));
    this.editor.dispatch(tx);
  }

  private handleEnter(): void {
    const handled = this.editor.keymap.Enter && this.editor.commands.execute(this.editor, this.editor.keymap.Enter);
    if (handled) return;

    const range = normalizeSelection(this.currentSelection());

    // A "code" text block (see Schema.isCode) never splits on Enter — it
    // gets a literal line break within the same block instead, exactly
    // like Shift+Enter's insertLineBreak elsewhere.
    const blockPath = findTextBlockPath(this.editor.doc, this.editor.schema, range.start.path);
    const blockNode = getNodeAtPath(this.editor.doc, blockPath);
    if (blockNode.object === "element" && this.editor.schema.isCode(blockNode.type)) {
      this.insertText("\n", "typing");
      return;
    }

    const tx = this.editor.createTransaction({ origin: "keyboard", historyGroup: "structural" });
    const point = range.isCollapsed ? range.start : deleteRange(tx, this.editor.schema, range.start, range.end);
    const result = splitBlock(tx, this.editor.schema, point);
    tx.setSelection(cursor(result.cursor));
    this.editor.dispatch(tx);
  }

  private handleBackspace(inputType: string): void {
    const range = normalizeSelection(this.currentSelection());
    const tx = this.editor.createTransaction({ origin: "keyboard", historyGroup: "structural" });

    if (!range.isCollapsed) {
      const point = deleteRange(tx, this.editor.schema, range.start, range.end);
      tx.setSelection(cursor(point));
      this.editor.dispatch(tx);
      return;
    }

    if (range.start.offset > 0) {
      const leaf = this.currentLeafText(range.start.path);
      const length =
        inputType === "deleteWordBackward"
          ? wordBackwardLength(leaf, range.start.offset)
          : inputType === "deleteContentBackward"
            ? 1
            : range.start.offset; // soft/hard line backward: MVP treats as "to start of leaf"
      const from: Point = { path: range.start.path, offset: range.start.offset - length };
      const point = deleteRange(tx, this.editor.schema, from, range.start);
      tx.setSelection(cursor(point));
      this.editor.dispatch(tx);
      return;
    }

    const blockPath = findTextBlockPath(this.editor.doc, this.editor.schema, range.start.path);
    const joinPoint = mergeBlockBackward(tx, blockPath);
    if (!joinPoint) return;
    tx.setSelection(cursor(joinPoint));
    this.editor.dispatch(tx);
  }

  private handleDeleteForward(inputType: string): void {
    const range = normalizeSelection(this.currentSelection());
    const tx = this.editor.createTransaction({ origin: "keyboard", historyGroup: "structural" });

    if (!range.isCollapsed) {
      const point = deleteRange(tx, this.editor.schema, range.start, range.end);
      tx.setSelection(cursor(point));
      this.editor.dispatch(tx);
      return;
    }

    const leaf = this.currentLeafText(range.start.path);
    if (range.start.offset < leaf.length) {
      const length =
        inputType === "deleteWordForward" ? wordForwardLength(leaf, range.start.offset) : inputType === "deleteContentForward" ? 1 : leaf.length - range.start.offset;
      const to: Point = { path: range.start.path, offset: range.start.offset + length };
      deleteRange(tx, this.editor.schema, range.start, to);
      tx.setSelection(cursor(range.start));
      this.editor.dispatch(tx);
      return;
    }

    const blockPath = findTextBlockPath(this.editor.doc, this.editor.schema, range.start.path);
    const blockIndex = blockPath[blockPath.length - 1];
    if (blockIndex === undefined) return;
    const nextBlockPath = [...blockPath.slice(0, -1), blockIndex + 1];
    const joinPoint = mergeBlockBackward(tx, nextBlockPath);
    if (!joinPoint) return;
    tx.setSelection(cursor(range.start));
    this.editor.dispatch(tx);
  }

  private currentLeafText(path: number[]): string {
    let node: unknown = this.editor.doc;
    for (const index of path) {
      node = (node as { children: unknown[] }).children[index];
    }
    return (node as { text: string }).text;
  }

  // ---- composition (IME) -----------------------------------------------

  private onCompositionStart = (): void => {
    this.composing = true;
  };

  private onCompositionEnd = (event: CompositionEvent): void => {
    this.composing = false;
    const domSelection = document.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      this.render();
      return;
    }
    const focusNode = domSelection.focusNode;
    if (!focusNode) {
      this.render();
      return;
    }
    const newPoint = domPointToModel(this.editor, this.container, focusNode, domSelection.focusOffset);
    if (!newPoint) {
      this.render();
      return;
    }

    const domTextNodes = collectDomTextNodes(this.container);
    const leafIndex = focusNode.nodeType === Node.TEXT_NODE ? domTextNodes.indexOf(focusNode as Text) : -1;
    if (leafIndex === -1) {
      this.render();
      return;
    }
    const domText = domTextNodes[leafIndex]!.data;
    const oldLeafText = this.currentLeafText(newPoint.path);

    if (domText !== oldLeafText) {
      let prefix = 0;
      while (prefix < oldLeafText.length && prefix < domText.length && oldLeafText[prefix] === domText[prefix]) prefix += 1;
      let suffix = 0;
      while (
        suffix < oldLeafText.length - prefix &&
        suffix < domText.length - prefix &&
        oldLeafText[oldLeafText.length - 1 - suffix] === domText[domText.length - 1 - suffix]
      ) {
        suffix += 1;
      }
      const tx = this.editor.createTransaction({ origin: "keyboard", historyGroup: "typing" });
      const removedLength = oldLeafText.length - prefix - suffix;
      if (removedLength > 0) tx.removeText(newPoint.path, prefix, removedLength);
      const inserted = domText.slice(prefix, domText.length - suffix);
      if (inserted.length > 0) tx.insertText(newPoint.path, prefix, inserted);
      tx.setSelection(cursor(newPoint));
      this.editor.dispatch(tx);
      return;
    }

    void event;
    this.render();
  };

  // ---- clipboard ----------------------------------------------------------

  private sliceSelectionAsHtmlAndText(): { html: string; text: string } | null {
    const selection = this.editor.getSelection();
    if (!selection || isCollapsed(selection)) return null;
    const range = normalizeSelection(selection);
    const blocks = sliceDocument(this.editor.doc, this.editor.schema, range.start, range.end);
    const sliceDoc = { object: "document" as const, id: "clipboard-slice", children: blocks };
    return {
      html: toHTML(sliceDoc, this.editor.htmlRegistry),
      text: toPlainText(this.editor.schema, sliceDoc)
    };
  }

  private onCopy = (event: ClipboardEvent): void => {
    const slice = this.sliceSelectionAsHtmlAndText();
    if (!slice || !event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", slice.text);
    event.clipboardData.setData("text/html", slice.html);
  };

  private onCut = (event: ClipboardEvent): void => {
    const slice = this.sliceSelectionAsHtmlAndText();
    if (!slice || !event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", slice.text);
    event.clipboardData.setData("text/html", slice.html);

    const selection = this.editor.getSelection();
    if (!selection) return;
    const range = normalizeSelection(selection);
    const tx = this.editor.createTransaction({ origin: "keyboard", historyGroup: "structural" });
    const point = deleteRange(tx, this.editor.schema, range.start, range.end);
    tx.setSelection(cursor(point));
    this.editor.dispatch(tx);
  };

  private onPaste = (event: ClipboardEvent): void => {
    if (!this.editor.editable || !event.clipboardData) return;
    event.preventDefault();
    const blocks = extractPastedBlocks(this.editor, event.clipboardData);
    if (blocks.length === 0) return;
    const range = normalizeSelection(this.currentSelection());
    const tx = this.editor.createTransaction({ origin: "paste", historyGroup: "structural" });
    const point = insertBlocksAtSelection(tx, this.editor.schema, range, blocks);
    tx.setSelection(cursor(point));
    this.editor.dispatch(tx);
  };

  private onDrop = (event: DragEvent): void => {
    if (!this.editor.editable || !event.dataTransfer) return;
    event.preventDefault();
    const blocks = extractPastedBlocks(this.editor, event.dataTransfer);
    if (blocks.length === 0) return;
    const range = normalizeSelection(this.currentSelection());
    const tx = this.editor.createTransaction({ origin: "drop", historyGroup: "structural" });
    const point = insertBlocksAtSelection(tx, this.editor.schema, range, blocks);
    tx.setSelection(cursor(point));
    this.editor.dispatch(tx);
  };

  private onDragOver = (event: DragEvent): void => {
    event.preventDefault();
  };

  // ---- lifecycle ----------------------------------------------------------

  focus(): void {
    this.container.focus();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detachEvents();
    this.unsubscribe();
  }
}
