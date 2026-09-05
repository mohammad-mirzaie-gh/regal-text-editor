# Regal Text Editor

A framework-independent rich text editing engine, a browser DOM adapter, a React binding, a plugin system, and a default toolbar UI — built as a pnpm monorepo of small, independently publishable packages.

This is **not** a wrapper around ProseMirror/Slate/Lexical/TipTap/CKEditor. The document model, transaction system, selection model, schema, history, HTML/Markdown serialization, and the DOM adapter are all implemented from scratch in this repository.

## Status

This is a working foundation covering phases 1–10 of the project plan (core engine → transactions/selection/commands → browser adapter → basic formatting → lists/headings/blockquotes → toolbar UI) plus a second pass adding links, images, code blocks, find & replace, and a richer UI layer (dropdowns, a selection-following bubble toolbar, link/image popovers), backed by 462 passing tests across 35 test files at ~93% statement coverage (dedicated unit tests for every package — core's model/schema/transforms/search/serialization/parsing, the browser adapter, every plugin, the React binding, and the `@regal-text-editor/ui` components — plus jsdom integration tests that exercise real keyboard, IME composition, clipboard, selection-mapping, and React/UI behavior end to end). It is **not** a complete implementation of every feature described in the original brief — see [Self-audit](#self-audit) below for an honest, per-category breakdown of what's implemented, partial, or not started. Treat this as a solid, tested base to keep building on rather than a finished product.

## Architecture

```
packages/
  core/                  Layer 1 — engine: model, schema, selection, transactions,
                          transforms, history, commands, plugins, serialization, parsing.
                          Zero DOM/React dependency (HTML parsing is the one pragmatic
                          exception — it needs a DOMParser-compatible global, available
                          in browsers and in jsdom test environments).
  browser/               Layer 2 — DOM adapter: renders the model to HTML, maps
                          DOM Selection <-> model Point, handles keyboard/beforeinput/
                          composition/clipboard/drag-drop events.
  react/                 Layer 5 — <RichTextEditor>, useEditor, useEditorSelector,
                          useCommand. The engine has no dependency on this package.
  ui/                    Layer 3 — <Toolbar> and friends, built only on @regal-text-editor/react's
                          public hooks (nothing here reaches into engine internals).
  plugin-basic-marks/    Layer 4 — bold, italic, underline, strikethrough, inline code.
  plugin-basic-blocks/   Layer 4 — paragraph, heading, blockquote, horizontal rule, text align.
  plugin-lists/          Layer 4 — bullet/ordered/task lists, indent/outdent, Enter/Tab.
  plugin-link/           Layer 4 — link mark (setLink/unsetLink), sanitized href.
  plugin-image/          Layer 4 — block-level image node, insertImage command.
  plugin-code-block/     Layer 4 — preformatted code block (Enter inserts a line break,
                          not a split — see the `code` NodeSpec flag).
  plugin-history/        Layer 4 — undo/redo commands and shortcuts.
  _integration-tests/    Private package exercising the full stack together
                          (core + all plugins + browser adapter + React binding).
```

Every package other than `core` and `browser` is optional — `core` never imports React or touches the DOM, `browser` never imports React, and `ui` only reaches the engine through `@regal-text-editor/react`'s public hooks. A consumer can use the engine completely headless (`new Editor({...})`, no UI at all), pair it with a custom DOM adapter, or use the provided React binding and swap the toolbar for a custom one.

## Getting started

```bash
pnpm install
pnpm -r --filter=./packages/** run build   # build every package (tsup, ESM + .d.ts)
pnpm test                                   # run the full test suite (vitest, jsdom)
```

Each package builds independently with `tsup` to ESM + type declarations (`pnpm --filter @regal-text-editor/core run build`, etc). There is no CommonJS output — this is an ESM-only set of packages, per the "avoid unnecessary CJS" guidance.

## Quick usage

```tsx
import { createBaseSchema } from "@regal-text-editor/core";
import { EditorProvider, RichTextEditor, useEditor } from "@regal-text-editor/react";
import { Toolbar, defaultToolbarItems } from "@regal-text-editor/ui";
import "@regal-text-editor/ui/styles.css";
import { BasicBlocksPlugin } from "@regal-text-editor/plugin-basic-blocks";
import { BasicMarksPlugin } from "@regal-text-editor/plugin-basic-marks";
import { ListsPlugin } from "@regal-text-editor/plugin-lists";
import { HistoryPlugin } from "@regal-text-editor/plugin-history";

function Editor() {
  const editor = useEditor({
    schema: createBaseSchema(),
    plugins: [BasicBlocksPlugin(), BasicMarksPlugin(), ListsPlugin(), HistoryPlugin()]
  });

  // <Toolbar> reads the ambient editor via context. <RichTextEditor> alone
  // provides that context to its own children — since the toolbar here
  // renders as a *sibling*, not nested inside <RichTextEditor>, wrap both
  // in <EditorProvider editor={editor}> to share the same instance.
  return (
    <EditorProvider editor={editor}>
      <Toolbar items={defaultToolbarItems} />
      <RichTextEditor editor={editor} placeholder="Start writing..." onChange={(doc) => console.log(doc)} />
    </EditorProvider>
  );
}
```

Headless, no React:

```ts
import { Editor, createBaseSchema, cursor } from "@regal-text-editor/core";
import { EditorView } from "@regal-text-editor/browser";
import { BasicMarksPlugin } from "@regal-text-editor/plugin-basic-marks";

const editor = new Editor({ schema: createBaseSchema(), plugins: [BasicMarksPlugin()] });
const view = new EditorView({ editor, container: document.getElementById("editor")! });

editor.commands.execute(editor, "toggleBold");
console.log(editor.getHTML(), editor.getMarkdown(), editor.getJSON());
```

`@regal-text-editor/ui` also exports a few more pieces beyond `<Toolbar>`: `<BubbleToolbar items={...} />` (a small formatting toolbar that follows the current selection, Medium/Notion-style), `<LinkButton />` / `<ImageButton />` (self-contained popovers that collect a URL and call `@regal-text-editor/plugin-link`'s `setLink`/`unsetLink` or `@regal-text-editor/plugin-image`'s `insertImage` — unlike a plain `<Toolbar>` item, these are coupled to that specific plugin's command names, documented on each component), `<FindReplacePanel />` (find/replace driven by `@regal-text-editor/core`'s `findMatches`/`replaceMatch`/`replaceAllMatches`), and `ToolbarItem`'s `"dropdown"` variant (a native `<select>` for grouping related commands like heading levels or text alignment — see `defaultToolbarItems` for a working example of all of these together). The example app wires all of them up.

## Core concepts

- **Document model** (`EditorDocument` / `ElementNode` / `TextNode`, `packages/core/src/model`): a plain, JSON-serializable tree. Never HTML. Every element carries a stable `id` (`packages/core/src/utils/id.ts`) that survives normal transactions and structural moves, for future comments/collaboration/revision features to key off.
- **Schema** (`packages/core/src/schema`): plugins register `NodeSpec`/`MarkSpec` with a simplified content-expression grammar (`"inline*"`, `"block+"`, …). `schema.validate(doc)` returns structured errors (`ValidationError[]`), matching `editor.validate()`.
- **Position/selection** (`packages/core/src/position`, `.../selection`): a `Point` is `{ path, offset }` addressing a text leaf; `Selection` is a `CursorSelection | RangeSelection` discriminated union, normalized via `normalizeSelection` into `{ anchor, focus, start, end, isBackward, isCollapsed }` for transform code.
- **Operations & transactions** (`packages/core/src/transaction`, `.../transforms`): every edit decomposes into primitive `Operation`s (`insertText`, `splitText`, `mergeNodes`, `moveNode`, …) applied through an immutable, structurally-shared reducer (`applyOperation`). Higher-level transforms (`deleteRange`, `splitBlock`, `mergeBlockBackward`, `applyMarkToRange`, `wrapBlocks`/`unwrapBlocks`, `indentListItem`/`outdentListItem`, `insertBlocksAtSelection`, `sliceDocument`) compose those primitives and are unit-tested directly.
- **Normalization** (`packages/core/src/normalization`): a single deterministic bottom-up pass after every transaction — merges adjacent equal-mark text, guarantees every text block has ≥1 leaf, drops containers that no longer satisfy their content requirement, guarantees the document itself is never empty.
- **History** (`packages/core/src/history`): snapshot-based (keeps `{docBefore, docAfter}` object references, cheap thanks to structural sharing) rather than built on inverting individual operations — a deliberate simplification documented in `history.ts`. Typing transactions merge into one undo step within a configurable delay.
- **Commands & plugins** (`packages/core/src/commands`, `.../plugins`): a `Command` exposes `execute`/`canExecute`/`isActive`. A `Plugin` can register schema nodes/marks, commands, a keymap (`"Mod-b" -> "toggleBold"`), HTML/Markdown (de)serializers, and HTML parsers — see any `packages/plugin-*/src/index.ts` for the pattern.
- **Serialization** (`packages/core/src/serialization`, `.../parsing`): `toJSON`/`toHTML`/`toMarkdown`/`toPlainText` and `parseHTML` are all generic engines driven entirely by what plugins register — core has no built-in knowledge of "heading" or "bold".

## Security

- `parseHTML` (used for paste, drop, and `setContent({ html })`) always strips `<script>/<style>/<iframe>/<object>/<embed>/<link>/<meta>/<base>/<form>`, strips every `on*` event-handler attribute, and passes every `href`/`src` through `sanitizeUrl` (`packages/core/src/utils/sanitize.ts`), which allow-lists `http:`, `https:`, `mailto:`, `tel:`, and scheme-less relative URLs — `javascript:`, `data:`, `vbscript:` and anything else is rejected.
- HTML export escapes all text content (`escapeHtml`); the DOM is only ever written to via `container.innerHTML = toHTML(editor.doc, ...)`, i.e. always our own serializer output from the validated model, never raw external HTML.
- See [Self-audit](#self-audit) for what security work has **not** been done yet (there is no image/embed plugin at all yet, so upload/MIME validation and iframe-embed allow-listing don't apply to anything shipped in this state).

## Self-audit

Honest status per category (IMPLEMENTED / PARTIALLY IMPLEMENTED / NOT IMPLEMENTED), not a claim of completeness:

| Category | Status | Notes |
|---|---|---|
| Architecture (5 layers, plugin system) | IMPLEMENTED | Core has no DOM/React dependency; browser has no React dependency; ui only touches react's public hooks. |
| Document model | IMPLEMENTED | Plain JSON tree, stable element ids. |
| Schema | PARTIALLY | Simplified sequential content-expression matcher (documented), not a full regular content-expression/NFA engine. |
| Normalization | PARTIALLY | Single deterministic pass covering the common repairs (empty blocks/containers, adjacent text merge, empty-document guarantee); does not auto-repair arbitrary invalid nesting. |
| Transactions / operations | IMPLEMENTED | 10 primitive ops, structural sharing, tested. |
| Selection / position | IMPLEMENTED | Path+offset points, block-relative-by-id and block-text-offset helpers specifically to survive structural transforms and mark-splitting. |
| Commands | IMPLEMENTED | `execute`/`canExecute`/`isActive`, central registry. |
| History (undo/redo) | PARTIALLY | Snapshot-based (not invertible-op-based); typing coalescing works; no visual "history debug" panel. |
| Keyboard shortcuts | PARTIALLY | Mod-normalized shortcut matching, platform detection, keymap-driven; no on-screen shortcuts-help dialog yet. |
| Clipboard (copy/cut/paste) | PARTIALLY | Real HTML+plain-text read/write via the same sanitizing parser as import; no explicit Word/Google-Docs-specific cleanup, no "paste as plain text" shortcut. |
| Drag & drop | PARTIALLY | Dropping HTML/text content works via the same insertion path as paste; no drag-to-move-a-block and no visual drop-indicator. |
| Formatting (marks) | IMPLEMENTED | bold/italic/underline/strike/inline code/link; collapsed-cursor "stored marks" for continuing to type in a toggled style. |
| Headings / paragraph / blockquote / hr | IMPLEMENTED | Configurable heading levels; single-block wrap/unwrap scope (documented). |
| Text alignment | IMPLEMENTED | Logical `start`/`center`/`end`/`justify` on paragraph/heading (`setTextAlign`), not physical left/right — stays correct under `dir="rtl"`. Rendered as an inline `style`; import maps physical `left`/`right` from pasted content to `start`/`end` (LTR-source assumption, documented). |
| Lists (bullet/ordered/task, nesting, indent/outdent) | IMPLEMENTED | Enter-to-split/exit, Tab/Shift-Tab; ordered-list custom start numbers; multi-item toggle-off is a documented simplification. |
| Tables | NOT IMPLEMENTED | |
| Images | IMPLEMENTED | Block-level only (own line, like `horizontalRule`), not an inline atom inside a line of text — the document model has no inline-void/NodeSelection concept yet, so this is a deliberate scope decision, not an oversight. URL-only (`insertImage(src, alt)`); no upload adapter. |
| Links | IMPLEMENTED | `setLink(href)`/`unsetLink` mark commands, href sanitized at the command boundary (not just on HTML import/export, since a command-driven href never passes through the parser). `<LinkButton>` in `@regal-text-editor/ui` provides the URL-collecting popover. |
| Code blocks | IMPLEMENTED | Preformatted block (`toggleCodeBlock`); Enter inserts a literal line break instead of splitting, via a generic `code: true` NodeSpec flag the browser adapter reads (no per-plugin keymap collision). No syntax highlighting — `language` is recorded as an attribute for a future highlighter to key off, but nothing renders one yet. |
| Mentions / bookmarks | NOT IMPLEMENTED | |
| Markdown import/export | PARTIALLY | Export is real (generic registry-driven engine, GFM-ish output, tested for bold/italic/headings/lists/blockquote/task-items/links/images/code-fences); no Markdown *import* parser or markdown-shortcut autoformatting yet. |
| HTML import/export | IMPLEMENTED | Generic registry-driven parser/serializer; sanitized; tested. |
| Source-code mode | NOT IMPLEMENTED | |
| Find & replace | IMPLEMENTED | `findMatches`/`replaceMatch`/`replaceAllMatches` in `@regal-text-editor/core` (plain substring search, case-insensitive by default, never matches across a block boundary) plus `<FindReplacePanel>` in `@regal-text-editor/ui`. Only the *current* match is visibly highlighted (via the editor's own selection) — there's no decoration layer yet for highlighting every match at once, the same way a browser's own Ctrl+F bar behaves without page-side highlighting. |
| Autosave | NOT IMPLEMENTED | (`editor.subscribe`/`editor.on("change", ...)` are the hooks a debounced-save integration would use.) |
| Word/character count | PARTIALLY | Demonstrated in the example app via `editor.getText()`; no built-in limit-enforcement plugin. |
| Read-only / disabled mode | IMPLEMENTED | `editor.setEditable`, reflected by the browser adapter and `<RichTextEditor editable={...}>`. |
| Placeholder | IMPLEMENTED | `data-is-empty`/`data-placeholder` + CSS, with a brief fade-in transition. |
| Toolbar UI | IMPLEMENTED | Button/separator/dropdown items driven entirely by data (`ToolbarItem[]`), plus a selection-following `<BubbleToolbar>`. The dropdown is a native `<select>` (full keyboard/a11y support for free) rather than a custom menu — the one trade-off is it can't `preventDefault` on open the way a button can, so the visual selection highlight blinks off while it's open (the underlying model selection is unaffected). |
| Theming / visual customization | IMPLEMENTED | Every color/radius/shadow in `@regal-text-editor/ui`'s `styles.css` is a CSS custom property, overridable per-app by redefining it on any ancestor. Two alternate presets ship as a working example of that (`data-rte-theme="notion"`, a warm paper-like palette; `data-rte-theme="midnight"`, a forced-dark moody palette distinct from the automatic `prefers-color-scheme` dark variant) — toggleable in the example app's header. |
| Accessibility | PARTIALLY | `role="textbox"`, `aria-multiline`, toolbar `role="toolbar"` + `aria-pressed`/`aria-label` per button, focus-visible styles (including a focus ring on the editable surface itself now), selection preserved across toolbar clicks (mousedown prevented). No shortcuts-help panel, not independently audited against WCAG 2.2 AA. |
| RTL | PARTIALLY | CSS uses logical properties (`border-inline-start`, `padding-inline-start`) so it inherits `dir` correctly; text alignment uses logical `start`/`end` for the same reason. No dedicated RTL example/locale, no bidi cursor-movement testing. |
| Localization | NOT IMPLEMENTED | UI strings (toolbar `label`s) are plain English constants, not yet routed through a locale table. |
| Plugin architecture | IMPLEMENTED | Schema/commands/keymap/serializers/parsers all plugin-registered; 7 real plugins built on it. |
| Slash commands / command palette | NOT IMPLEMENTED | |
| Table of contents / auto-linking / smart typography / spellcheck integration | NOT IMPLEMENTED | (`spellcheck` is enabled on the editable root, which is the one integration point that exists.) |
| React integration | IMPLEMENTED | Controlled+uncontrolled, stable editor identity across re-renders, granular `useSyncExternalStore`-based subscriptions. |
| Testing | IMPLEMENTED for what exists | 462 tests across 35 files, ~93% statement coverage: dedicated unit tests per package (core's model/schema/content-matcher/transforms/normalization/history/editor/search/serialization/parsing/sanitize, every plugin, the browser adapter's positions/shortcuts/paste, the React hooks, the `@regal-text-editor/ui` components), plus jsdom integration tests for the full plugin stack, real keyboard/IME/clipboard/selection behavior, and React/UI end-to-end flows. No Playwright/real-browser suite, no fuzz testing, no accessibility-automation run. |
| Documentation | PARTIALLY | This README plus inline doc-comments on every public function/class; no generated API reference site, no per-package README. |

## Known architectural simplifications (by design, not oversights)

- **Content-expression matching** is a greedy sequential matcher, not a full regular-content-expression engine (`packages/core/src/schema/content-matcher.ts`).
- **History is snapshot-based**, not operation-inversion-based (`packages/core/src/history/history.ts`) — cheap because the document is a persistent, structurally-shared tree, and it sidesteps deriving a generic inverse for structural ops like element merges. A future collaborative-editing phase would introduce an invertible/OT op log separately.
- **Selection survival across structural transforms** uses two purpose-built techniques instead of manual path arithmetic per command: `toBlockRelativePoint`/`resolveBlockRelativePoint` (pairs a point with its block's stable id) for wrap/unwrap/indent/outdent, and `blockTextOffset`/`pointFromBlockTextOffset` (block-local character offsets) for mark-toggle's leaf-splitting. Both were added after integration tests caught real selection-corruption bugs from naive "reuse the old selection object" code — see git history if this repo is later placed under version control.
- **The browser adapter explicitly handles every text-editing `beforeinput` type** (not a "let native contentEditable edit happen, then diff the DOM" strategy) except during active IME composition, where native composition is allowed to proceed and is reconciled into the model on `compositionend` via a prefix/suffix text diff. This trades away some native autocorrect/spellcheck-replacement nuance for predictable, testable model updates.
- **Full-document HTML re-render on every change** (`EditorView.render()` calls `container.innerHTML = toHTML(...)`, short-circuited when the HTML string is unchanged). Correct and simple; does not scale to very large documents (section 78's 10,000-paragraph target) without incremental DOM patching, which is a documented future optimization, not implemented here.
- **Selection restoration after a mark change is resolved against the *normalized* doc, not the transaction's own `tx.doc`.** Removing a mark can leave two adjacent leaves with an identical (now empty) mark set, which normalization then merges into one — a merge the transaction itself never records as an operation. A point resolved via `pointFromBlockTextOffset(tx.doc, ...)` pre-merge can address a leaf index that won't exist once `editor.dispatch` normalizes and validates the selection. `plugin-basic-marks` and `plugin-link` both call `normalizeDocument(editor.schema, tx.doc)` before resolving the restoration point specifically to avoid this — found via an integration test that selected exactly a marked run (with plain-text neighbors on both sides) and toggled the mark off.
- **A block-level-only image node** (`plugin-image`), not an inline atom that can sit inside a line of text next to other text — the document model has no inline-void/NodeSelection concept (every inline child of a text block is assumed to be plain text, which is what the DOM<->model position mapping indexes 1:1). Extending to true inline images would need that concept added first.
- **A `code: true` NodeSpec flag**, read generically by the browser adapter, is how `plugin-code-block` gets Enter-inserts-a-line-break behavior without registering its own "Enter" keymap entry — the keymap is a flat `{shortcut: commandName}` map merged via `Object.assign` across plugins (last one wins per exact key), so two plugins both wanting to special-case Enter would silently fight over that one slot. Routing it through a schema flag instead avoids the collision entirely.
- **Find & replace highlights only the current match**, via the editor's own selection, not every match at once — there is no decoration/overlay rendering layer in this editor yet, so a "highlight all matches" UI would need one added first.
