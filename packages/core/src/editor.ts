import { createDocument, createElement, createText } from "./model/node";
import type { EditorDocument, Mark } from "./model/types";
import { normalizeDocument } from "./normalization/normalize";
import { HtmlParserRegistry, parseHTML } from "./parsing/html";
import { Schema } from "./schema/schema";
import { clampSelection } from "./selection/selection";
import type { Selection } from "./selection/types";
import { CommandRegistry } from "./commands/registry";
import { defaultHistoryConfig, HistoryManager, type HistoryConfig } from "./history/history";
import type { Plugin } from "./plugins/types";
import { SerializerRegistry } from "./serialization/registry";
import { toHTML } from "./serialization/html";
import { toMarkdown } from "./serialization/markdown";
import { toJSON, fromJSON } from "./serialization/json";
import { toPlainText } from "./serialization/text";
import { Transaction } from "./transaction/transaction";
import type { TransactionMeta } from "./transaction/operations";
import type { ValidationError } from "./schema/types";

export interface EditorConfig {
  schema: Schema;
  plugins?: Plugin[];
  initialDoc?: EditorDocument;
  initialHTML?: string;
  history?: Partial<HistoryConfig>;
  editable?: boolean;
  onError?: (error: unknown) => void;
}

export interface EditorEventMap {
  beforeChange: { tx: ReturnType<Transaction["build"]> };
  change: { doc: EditorDocument };
  selectionChange: { selection: Selection | null };
  focus: Record<string, never>;
  blur: Record<string, never>;
  undo: Record<string, never>;
  redo: Record<string, never>;
  destroy: Record<string, never>;
}

type Listener<T> = (payload: T) => void;

function positionOf(selection: Selection | null): unknown {
  if (!selection) return null;
  return selection.type === "cursor" ? selection.position : [selection.anchor, selection.focus];
}

/**
 * The framework-independent editor engine (Layer 1). Owns the document,
 * selection, schema, history, command registry and plugin lifecycle. Has
 * no dependency on the DOM or React — the browser adapter and React
 * bindings are separate packages built on top of this public API.
 */
export class Editor {
  schema: Schema;
  doc: EditorDocument;
  selection: Selection | null = null;
  editable: boolean;

  readonly commands = new CommandRegistry();
  /** Merged "shortcut string -> command name" map from every plugin's keymap;
   * consumed by the browser adapter to translate keydown events into commands. */
  readonly keymap: Record<string, string> = {};
  readonly history: HistoryManager;
  readonly plugins: Plugin[];
  readonly htmlRegistry = new SerializerRegistry();
  readonly markdownRegistry = new SerializerRegistry();
  readonly htmlParserRegistry = new HtmlParserRegistry();

  private storedMarks: Mark[] | null = null;
  private focused = false;
  private destroyed = false;
  private readonly listeners = new Map<keyof EditorEventMap, Set<Listener<unknown>>>();
  private readonly subscribers = new Set<() => void>();
  private readonly onErrorHandler: (error: unknown) => void;

  constructor(config: EditorConfig) {
    this.schema = config.plugins?.length
      ? config.plugins.reduce(
          (schema, plugin) =>
            plugin.schema ? schema.extend({ nodes: plugin.schema.nodes ?? [], marks: plugin.schema.marks ?? [] }) : schema,
          config.schema
        )
      : config.schema;

    this.plugins = config.plugins ?? [];
    this.history = new HistoryManager({ ...defaultHistoryConfig, ...config.history });
    this.editable = config.editable ?? true;
    this.onErrorHandler =
      config.onError ??
      ((error) => {
        console.error("[editor] plugin/command error", error);
      });

    for (const plugin of this.plugins) {
      if (plugin.commands) {
        for (const [name, command] of Object.entries(plugin.commands(this))) {
          this.commands.register(name, command);
        }
      }
      if (plugin.keymap) {
        Object.assign(this.keymap, plugin.keymap(this));
      }
      if (plugin.htmlSerializers) {
        for (const [type, serializer] of Object.entries(plugin.htmlSerializers)) {
          this.htmlRegistry.registerNode(type, serializer);
        }
      }
      if (plugin.markHtmlSerializers) {
        for (const [type, serializer] of Object.entries(plugin.markHtmlSerializers)) {
          this.htmlRegistry.registerMark(type, serializer);
        }
      }
      if (plugin.markdownSerializers) {
        for (const [type, serializer] of Object.entries(plugin.markdownSerializers)) {
          this.markdownRegistry.registerNode(type, serializer);
        }
      }
      if (plugin.markMarkdownSerializers) {
        for (const [type, serializer] of Object.entries(plugin.markMarkdownSerializers)) {
          this.markdownRegistry.registerMark(type, serializer);
        }
      }
      plugin.htmlParsers?.(this.htmlParserRegistry);
    }

    let initial: EditorDocument;
    if (config.initialHTML) {
      initial = parseHTML(this.schema, config.initialHTML, this.htmlParserRegistry);
    } else {
      initial =
        config.initialDoc ??
        createDocument([createElement(this.schema.defaultBlockType, {}, [createText("")])]);
    }
    this.doc = normalizeDocument(this.schema, initial);

    for (const plugin of this.plugins) plugin.onInit?.(this);
  }

  // ---- transactions -------------------------------------------------

  createTransaction(meta: Partial<TransactionMeta> = {}): Transaction {
    return new Transaction(this.doc, this.selection, meta);
  }

  dispatch(tx: Transaction): void {
    try {
      this.performDispatch(tx);
    } catch (error) {
      this.onErrorHandler(error);
    }
  }

  private performDispatch(tx: Transaction): void {
    if (this.destroyed) return;
    if (!this.editable && tx.meta.origin !== "system" && tx.meta.origin !== "history") return;

    const result = tx.build();
    const noOpChange = result.operations.length === 0 && result.doc === this.doc;
    const noOpSelection = positionOf(result.selectionAfter) === positionOf(result.selectionBefore);
    if (noOpChange && noOpSelection) return;

    this.emit("beforeChange", { tx: result });

    const docBefore = this.doc;
    const selectionBefore = this.selection;
    const normalizedDoc = normalizeDocument(this.schema, result.doc);
    this.doc = normalizedDoc;
    // A selection carried over from before the transform can reference a
    // path the transform invalidated (e.g. a command reusing a stale
    // point). Falling back to null keeps doc/selection consistent instead
    // of silently leaving a dangling selection that corrupts later commands.
    this.selection = null;
    if (result.selectionAfter) {
      try {
        this.selection = clampSelection(normalizedDoc, result.selectionAfter);
      } catch (error) {
        this.onErrorHandler(error);
      }
    }

    if (result.operations.length > 0 && result.meta.origin !== "history") {
      this.history.record(
        result.meta.historyGroup,
        result.meta.timestamp,
        docBefore,
        selectionBefore,
        normalizedDoc,
        this.selection
      );
    }

    if (positionOf(this.selection) !== positionOf(selectionBefore)) {
      this.storedMarks = null;
    }

    if (result.operations.length > 0) this.emit("change", { doc: this.doc });
    this.emit("selectionChange", { selection: this.selection });
    this.notifySubscribers();
  }

  // ---- history --------------------------------------------------------

  undo(): boolean {
    const step = this.history.undo();
    if (!step) return false;
    this.doc = step.doc;
    this.selection = step.selection;
    this.storedMarks = null;
    this.emit("undo", {});
    this.emit("change", { doc: this.doc });
    this.emit("selectionChange", { selection: this.selection });
    this.notifySubscribers();
    return true;
  }

  redo(): boolean {
    const step = this.history.redo();
    if (!step) return false;
    this.doc = step.doc;
    this.selection = step.selection;
    this.storedMarks = null;
    this.emit("redo", {});
    this.emit("change", { doc: this.doc });
    this.emit("selectionChange", { selection: this.selection });
    this.notifySubscribers();
    return true;
  }

  // ---- selection / stored marks ---------------------------------------

  getSelection(): Selection | null {
    return this.selection;
  }

  setSelection(selection: Selection | null): void {
    if (positionOf(selection) === positionOf(this.selection)) return;
    this.selection = selection ? clampSelection(this.doc, selection) : null;
    this.storedMarks = null;
    this.emit("selectionChange", { selection: this.selection });
    this.notifySubscribers();
  }

  getStoredMarks(): Mark[] | null {
    return this.storedMarks;
  }

  setStoredMarks(marks: Mark[] | null): void {
    this.storedMarks = marks;
    // Stored marks change what toggle commands report via isActive() (e.g.
    // a toolbar button's pressed state) without touching doc/selection, so
    // UI subscribed via `subscribe()`/`useEditorSelector` still needs a nudge.
    this.notifySubscribers();
  }

  // ---- focus ------------------------------------------------------------

  isFocused(): boolean {
    return this.focused;
  }

  focus(): void {
    this.emit("focus", {});
  }

  blur(): void {
    this.emit("blur", {});
  }

  /** Called by the browser adapter when native DOM focus/blur actually happens. */
  setFocused(focused: boolean): void {
    this.focused = focused;
  }

  // ---- editable / readonly ----------------------------------------------

  setEditable(editable: boolean): void {
    this.editable = editable;
    this.notifySubscribers();
  }

  isEmpty(): boolean {
    if (this.doc.children.length !== 1) return false;
    const only = this.doc.children[0];
    return !!only && only.children.length === 1 && only.children[0]?.object === "text" && only.children[0].text === "";
  }

  isDirty(): boolean {
    return this.history.canUndo();
  }

  // ---- content getters/setters -------------------------------------------

  getJSON(): EditorDocument {
    return toJSON(this.doc);
  }

  getHTML(): string {
    return toHTML(this.doc, this.htmlRegistry);
  }

  getMarkdown(): string {
    return toMarkdown(this.doc, this.markdownRegistry);
  }

  getText(): string {
    return toPlainText(this.schema, this.doc);
  }

  setContent(content: EditorDocument | { html: string }): void {
    const doc = "html" in content ? parseHTML(this.schema, content.html, this.htmlParserRegistry) : fromJSON(content);
    const normalized = normalizeDocument(this.schema, doc);
    const tx = this.createTransaction({ origin: "system", historyGroup: "none" });
    tx.doc = normalized;
    tx.setSelection(null);
    this.dispatch(tx);
    this.history.clear();
  }

  clear(): void {
    this.setContent(createDocument([createElement(this.schema.defaultBlockType, {}, [createText("")])]));
  }

  validate(): ValidationError[] {
    return this.schema.validate(this.doc);
  }

  // ---- events -------------------------------------------------------------

  on<K extends keyof EditorEventMap>(event: K, listener: Listener<EditorEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => set!.delete(listener as Listener<unknown>);
  }

  private emit<K extends keyof EditorEventMap>(event: K, payload: EditorEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  /** Coarse "something changed" subscription, convenient for framework
   * bindings (React's useSyncExternalStore and similar patterns). */
  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((listener) => listener());
  }

  destroy(): void {
    if (this.destroyed) return;
    for (const plugin of this.plugins) plugin.onDestroy?.(this);
    this.emit("destroy", {});
    this.listeners.clear();
    this.subscribers.clear();
    this.destroyed = true;
  }
}
