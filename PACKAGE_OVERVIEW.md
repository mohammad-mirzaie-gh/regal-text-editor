# Product & Package Overview

This document is a complete, verified reference for the project — written as source material for building a marketing/docs website, not as user-facing package documentation (that's the [README](./README.md)). Every fact below was checked directly against the current source and test run, not carried over from an earlier description.

---

## 1. What this is

**Regal Text Editor** (npm scope `@regal-text-editor/*`) is a rich text editing engine and toolkit for the web, built from scratch — not a wrapper around ProseMirror, Slate, Lexical, TipTap, or CKEditor. The document model, transaction system, selection model, schema engine, undo/redo history, HTML/Markdown serialization, and the browser DOM adapter are all original implementations in this repository.

It ships as **11 independently-versioned, independently-installable npm packages** under the `@regal-text-editor/` scope, structured in layers so a consumer only takes what they need: a headless engine with zero DOM/React dependency, an optional browser adapter, an optional React binding, an optional pre-built toolbar UI, and seven optional feature plugins.

**One-line pitch:** a small, fully-owned, framework-honest rich text editor core — headless by default, React-ready out of the box, and extensible through a real plugin system rather than a fixed feature set.

---

## 2. Key differentiators

- **Built from scratch, not a wrapper.** No dependency on any existing rich-text-editor engine. The whole document model, schema, transaction/operation system, selection model, normalization pass, undo/redo history, and HTML/Markdown/JSON/plain-text serialization are original code.
- **Headless-first.** `@regal-text-editor/core` has no DOM and no React dependency at all — it can run in Node for server-side document manipulation, validation, or format conversion, with no browser required.
- **Real plugin architecture, not a config object.** A plugin registers schema nodes/marks, commands, a keymap, HTML/Markdown serializers, and HTML parsers, all through the same typed interface every shipped feature (including every "built-in" formatting option) also goes through. There is no privileged, non-pluggable core feature set.
- **CSS-custom-property theming.** Every color, radius, and shadow in the default UI is a CSS variable, overridable from any ancestor element — no CSS-in-JS, no build-step theming requirement. Ships with two ready-made alternate presets (`notion`, `midnight`) as a live demonstration.
- **RTL-correct by construction.** Logical CSS properties and logical alignment values (`start`/`end`, never `left`/`right`) throughout, so the UI and text alignment behave correctly under `dir="rtl"` without a separate RTL mode.
- **Security-conscious by default.** Every URL (link `href`, image `src`) is passed through an allow-list sanitizer (`http:`, `https:`, `mailto:`, `tel:`, scheme-less relative — everything else, including `javascript:` and `data:`, rejected) at every entry point: HTML paste/import *and* direct command calls. HTML export escapes all text content and the DOM is only ever written from the editor's own serializer output.
- **Honest, itemized status.** The README carries a category-by-category self-audit (IMPLEMENTED / PARTIALLY / NOT IMPLEMENTED) rather than a blanket feature list — see §7 for the current state.

---

## 3. Architecture

Five layers, each package only depending on the layer(s) below it:

```
Layer 1  @regal-text-editor/core            Document model, schema, selection, transactions, transforms,
                               history, commands, plugin system, HTML/Markdown/JSON serialization.
                               Zero DOM, zero React. (HTML parsing is the one exception: it needs
                               a DOMParser-compatible global — a real browser or jsdom.)

Layer 2  @regal-text-editor/browser          DOM adapter: renders the model to HTML, maps DOM Selection <-> model
                               Point, handles keyboard / beforeinput / IME composition / clipboard /
                               drag-drop. No React dependency.

Layer 3  @regal-text-editor/ui                Pre-built toolbar UI (<Toolbar>, <BubbleToolbar>, <LinkButton>,
                               <ImageButton>, <FindReplacePanel>, dropdowns). Built only on
                               @regal-text-editor/react's public hooks — never reaches into engine internals.

Layer 4  plugin-*              Seven feature plugins (see §5), each independent and optional.

Layer 5  @regal-text-editor/react            <RichTextEditor>, useEditor, useEditorSelector, useCommand.
                               The engine (@regal-text-editor/core, @regal-text-editor/browser) has no dependency on this layer.
```

A consumer can use the engine fully headless with no UI at all (`new Editor({...})`), pair the core with a custom DOM adapter instead of `@regal-text-editor/browser`, or use the React binding with a completely custom toolbar instead of `@regal-text-editor/ui`.

---

## 4. Package table

| Package | What it provides | Depends on | Peer deps | Unpacked size (JS, unminified) |
|---|---|---|---|---|
| `@regal-text-editor/core` | Document model, schema, transactions, selection, commands, history, plugin system, HTML/Markdown/JSON/text serialization, HTML parsing + sanitization | — | — | 58.4 KB |
| `@regal-text-editor/browser` | DOM rendering, DOM↔model selection mapping, keyboard/IME/clipboard/drag-drop handling | `@regal-text-editor/core` | — | 22.8 KB |
| `@regal-text-editor/react` | `<RichTextEditor>`, `useEditor`, `useEditorSelector`, `useCommand` | `@regal-text-editor/core`, `@regal-text-editor/browser` | `react` ≥18, `react-dom` ≥18 | 4.3 KB |
| `@regal-text-editor/ui` | Default toolbar UI: `<Toolbar>`, `<BubbleToolbar>`, `<LinkButton>`, `<ImageButton>`, `<FindReplacePanel>`, dropdown items, icon set, theming CSS | `@regal-text-editor/core`, `@regal-text-editor/browser`, `@regal-text-editor/react`, `@regal-text-editor/plugin-link` | `react` ≥18, `react-dom` ≥18 | 19.1 KB JS + 13.0 KB CSS |
| `@regal-text-editor/plugin-basic-marks` | Bold, italic, underline, strikethrough, inline code | `@regal-text-editor/core` | — | 4.5 KB |
| `@regal-text-editor/plugin-basic-blocks` | Paragraph, heading (configurable levels), blockquote, horizontal rule, text alignment | `@regal-text-editor/core` | — | 9.4 KB |
| `@regal-text-editor/plugin-lists` | Bullet / ordered / task lists, nesting, indent/outdent | `@regal-text-editor/core` | — | 9.7 KB |
| `@regal-text-editor/plugin-link` | Link mark: `setLink` / `unsetLink`, sanitized href | `@regal-text-editor/core` | — | 5.5 KB |
| `@regal-text-editor/plugin-image` | Block-level image node, `insertImage` | `@regal-text-editor/core` | — | 2.5 KB |
| `@regal-text-editor/plugin-code-block` | Preformatted code block, Enter-inserts-newline behavior | `@regal-text-editor/core` | — | 2.5 KB |
| `@regal-text-editor/plugin-history` | Undo/redo commands and keyboard shortcuts | `@regal-text-editor/core` | — | 0.5 KB |

All figures are the unminified ESM bundle only (excludes `.d.ts` and `.map` files); a consumer's own bundler will typically minify further, and only the parts of each package actually imported are kept thanks to `sideEffects: false`.

All packages: version `0.1.0`, MIT-licensed, ESM-only (`"type": "module"`, no CommonJS build — a consumer using CommonJS needs a bundler or Node's own ESM interop), ship `.d.ts` type declarations and sourcemaps, and are marked `sideEffects: false` (except `@regal-text-editor/ui`'s CSS) so a bundler can tree-shake unused exports. Scoped-public (`publishConfig.access: "public"`), so publishing to npm needs no special org setup.

---

## 5. Feature plugins in detail

### `@regal-text-editor/plugin-basic-marks` — inline formatting

| Command | Keyboard shortcut | HTML tags recognized on import | Markdown output |
|---|---|---|---|
| `toggleBold` | `Mod-B` | `<strong>`, `<b>` | `**text**` |
| `toggleItalic` | `Mod-I` | `<em>`, `<i>` | `_text_` |
| `toggleUnderline` | `Mod-U` | `<u>` | (no Markdown equivalent — exported as plain text) |
| `toggleStrikethrough` | `Mod-Shift-X` | `<s>`, `<strike>`, `<del>` | `~~text~~` |
| `toggleInlineCode` | `Mod-E` | `<code>` | `` `text` `` |

(`Mod` = ⌘ on macOS, Ctrl elsewhere, resolved automatically.) Supports "stored marks" — toggling a mark at a collapsed cursor affects the *next* typed character, matching every mainstream editor's behavior.

### `@regal-text-editor/plugin-basic-blocks` — block types & alignment

- **Paragraph** (`setParagraph`, `Mod-Alt-0`).
- **Heading**, configurable levels (defaults to 1–6): `setHeading1`…`setHeading6`, bound to `Mod-Alt-1`…`Mod-Alt-6`.
- **Blockquote**: `toggleBlockquote` (no default shortcut — toolbar/bubble-toolbar only). Multi-paragraph blockquotes wrap/unwrap as a unit; a blockquote nested around a list correctly finds and unwraps the actual blockquote ancestor, not just the immediate parent.
- **Horizontal rule**: `insertHorizontalRule`.
- **Text alignment**: `setTextAlign(align)` where `align` is `"start" | "center" | "end" | "justify"` — logical values, not physical `left`/`right`, so alignment stays correct under `dir="rtl"`. Rendered as an inline style; HTML import maps physical `left`/`right` from pasted content back to logical `start`/`end` (assumes LTR-authored source, documented).

### `@regal-text-editor/plugin-lists` — bullet, ordered & task lists

- `toggleBulletList`, `toggleOrderedList` (ordered lists support a custom start number via the `start` attribute, reflected in HTML export as `<ol start="N">`).
- `toggleTaskListItem` — a `checked` attribute on a list item, rendered with a real SVG checkmark in the default UI.
- **Enter** (`listEnter`): splits the current item, or exits the list entirely from an empty item.
- **Tab / Shift-Tab**: `listIndent` / `listOutdent` — nests the current item one level deeper/shallower.
- Toggling a multi-item list off unwraps every item correctly (a bug present in an earlier iteration — clicking repeatedly used to be able to produce corrupted/duplicated structure — is fixed and covered by regression tests).

### `@regal-text-editor/plugin-link` — links

- `setLink(href)` — applies a link mark to the current (non-collapsed) selection; re-running it over already-linked text replaces the href rather than stacking a second mark.
- `unsetLink()` — removes the link mark from the selection.
- `getActiveLinkHref(editor)` — reads the href at the current selection/cursor, used by `<LinkButton>` to pre-fill its edit popover.
- `href` is sanitized at the command boundary itself (not only on HTML import/export), because a command-driven href typed into a UI popover never passes through the HTML parser's own sanitization pass.
- Exported HTML always carries `rel="noopener noreferrer"`.

### `@regal-text-editor/plugin-image` — images

- `insertImage(src, alt?)` — inserts a **block-level** image (its own line, like a horizontal rule), not an inline element that can sit inside a run of text. This is a deliberate, documented scope decision: the document model doesn't yet have an inline-void/"node selection" concept, and adding true inline images needs that built first.
- URL-only — there is no built-in file upload adapter; `src` is whatever URL the caller (typically a UI popover) supplies, sanitized the same way link hrefs are.
- Exports to both HTML (`<img src alt width?>`) and Markdown (`![alt](src)`).

### `@regal-text-editor/plugin-code-block` — preformatted code

- `toggleCodeBlock` (`Mod-Alt-C`) — converts the current block to/from a preformatted `codeBlock` node (no marks allowed inside it, monospace by convention in the default CSS).
- **Enter inserts a literal line break** instead of splitting into a new block — implemented via a generic `code: true` schema flag the browser adapter reads directly, specifically so it doesn't collide with `plugin-lists`' own Enter-key handling (the keymap merge model is "last plugin registered wins" per exact key, so two plugins can't both claim "Enter" safely).
- Records a `language` attribute per code block for a future syntax highlighter to key off — no highlighting renders today.
- HTML import recognizes `<pre>` (including `<pre><code>`) and preserves the exact whitespace/line breaks of the original content.

### `@regal-text-editor/plugin-history` — undo / redo

- `undo` (`Mod-Z`), `redo` (`Mod-Shift-Z` and `Mod-Y`, covering both common conventions).
- Snapshot-based (keeps document-reference pairs rather than inverting individual operations — cheap because the document is a persistent, structurally-shared tree). Rapid typing coalesces into a single undo step within a configurable delay.

### Find & Replace (core + UI, not a separate plugin package)

`findMatches` / `replaceMatch` / `replaceAllMatches` live directly in `@regal-text-editor/core` (case-insensitive by default, never matches across a block boundary even when adjacent blocks' text would otherwise read as contiguous), paired with `<FindReplacePanel>` in `@regal-text-editor/ui`. Only the current match is highlighted via the real editor selection — there's no separate "highlight every match at once" decoration layer yet.

---

## 6. `@regal-text-editor/ui` component reference

| Export | Purpose |
|---|---|
| `<Toolbar items={ToolbarItem[]} />` | Data-driven toolbar; items are `button`, `separator`, or `dropdown` (rendered as a styled native `<select>`, for full built-in keyboard/screen-reader support). `defaultToolbarItems` provides a ready-made complete set. |
| `<BubbleToolbar items={...} />` | A small formatting toolbar that appears next to the current text selection (Medium/Notion-style "floating toolbar"), built on the `useSelectionRect` hook. |
| `<LinkButton />` | Self-contained popover that collects a URL and calls `@regal-text-editor/plugin-link`'s `setLink`/`unsetLink`; pre-fills the current link's href when editing an existing one. |
| `<ImageButton />` | Self-contained popover that collects an image URL + alt text and calls `@regal-text-editor/plugin-image`'s `insertImage`. |
| `<FindReplacePanel />` | Find/replace UI driven by `@regal-text-editor/core`'s search functions; Enter/Shift+Enter step forward/backward, Escape closes. |
| `Icon` / `availableIconNames` | The built-in dependency-free SVG icon set (24 icons) used by every other component; swappable per toolbar item via a custom `render`. |
| `ToolbarButton`, `ToolbarSeparator`, `ToolbarDropdown` | The individual pieces `<Toolbar>` composes, exported for building fully custom toolbar layouts. |

**Theming**: import `@regal-text-editor/ui/styles.css` once; every visual token is a CSS custom property on `:root` (colors, radii, shadows, spacing). Two alternate presets ship out of the box, toggled by an attribute on any ancestor element:

```html
<div data-rte-theme="notion">...</div>   <!-- warm, paper-like palette -->
<div data-rte-theme="midnight">...</div> <!-- forced dark, independent of OS dark mode -->
```

A host application can override any subset of the same variables to build its own theme without touching the package's CSS file at all.

---

## 7. Feature status (honest, per category)

Full detail lives in the README's self-audit table; summarized here:

**Fully implemented:** document model & schema, transactions/operations, selection/position tracking, command system, formatting marks (bold/italic/underline/strike/inline-code/link), headings/paragraph/blockquote/hr, logical text alignment, lists (bullet/ordered/task, nesting, indent/outdent), block-level images, links, code blocks (no syntax highlighting), find & replace, HTML import/export, read-only mode, placeholder/empty state, the full toolbar UI including the bubble toolbar, CSS-custom-property theming, and the React integration (controlled + uncontrolled, `useSyncExternalStore`-based subscriptions).

**Partially implemented:** schema content-matching (simplified sequential matcher, not a full regular-content-expression engine), undo/redo (snapshot-based, not operation-inversion-based), clipboard (real HTML/text round-trip, no Word/Google-Docs-specific cleanup), drag & drop (content insertion works, no drag-to-reorder-a-block), Markdown (export is complete and tested; there is no Markdown *import* parser yet), accessibility (ARIA roles/labels present, not independently audited against WCAG), RTL (logical CSS throughout, no dedicated RTL example or bidi cursor testing).

**Not implemented:** tables, mentions/bookmarks, a source-code/raw-HTML edit mode, autosave (the necessary `editor.subscribe`/change hooks exist for a host app to build one), slash-commands / command palette, table of contents, auto-linking, smart typography, spellcheck integration beyond the browser's native `spellcheck` attribute, and localization of the UI's (currently English-only) labels.

---

## 8. Quality & testing

- **462 automated tests** across **35 test files**, **~93% statement coverage** (measured via `@vitest/coverage-v8`).
- Every package has dedicated unit tests, not just indirect coverage through integration tests — including the browser adapter, the React hooks, and every `@regal-text-editor/ui` component.
- Integration tests exercise the full stack together: real keyboard events, IME composition, clipboard paste/copy, DOM selection mapping, and end-to-end React/UI flows (jsdom).
- No Playwright/real-browser suite, no fuzz testing, no automated accessibility audit yet.
- Verified to install and run correctly via plain `npm install` (packed with `pnpm pack`, installed into an isolated project with plain `npm`, and exercised with a plain-Node script) — confirming the published packages work outside the pnpm-workspace development environment they're authored in.

---

## 9. Installation & quick start

```bash
npm install @regal-text-editor/core @regal-text-editor/browser @regal-text-editor/react @regal-text-editor/ui \
  @regal-text-editor/plugin-basic-blocks @regal-text-editor/plugin-basic-marks @regal-text-editor/plugin-lists @regal-text-editor/plugin-history
```

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

  return (
    <EditorProvider editor={editor}>
      <Toolbar items={defaultToolbarItems} />
      <RichTextEditor editor={editor} placeholder="Start writing..." onChange={(doc) => console.log(doc)} />
    </EditorProvider>
  );
}
```

Headless (no React, no UI — e.g. for server-side document processing or a fully custom frontend):

```ts
import { Editor, createBaseSchema } from "@regal-text-editor/core";
import { BasicMarksPlugin } from "@regal-text-editor/plugin-basic-marks";

const editor = new Editor({ schema: createBaseSchema(), plugins: [BasicMarksPlugin()] });
editor.commands.execute(editor, "toggleBold");
console.log(editor.getHTML(), editor.getMarkdown(), editor.getJSON());
```

---

## 10. Requirements & compatibility

- **Node** ≥ 18.18 for building/developing the monorepo itself; consumers of the published packages just need any modern bundler or Node ≥ 18 for ESM support.
- **React** ≥ 18 for `@regal-text-editor/react` and `@regal-text-editor/ui` (peer dependency — not bundled, so it's never duplicated in a consumer's bundle). `@regal-text-editor/core` and `@regal-text-editor/browser` have no React dependency at all.
- **Module format**: ESM only, no CommonJS build.
- **Browser**: any evergreen browser with `contentEditable` and standard Selection/Range APIs; HTML import (`parseHTML`, used for paste/drop/`setContent({html})`) needs a `DOMParser`-compatible global, present in every browser and in jsdom test environments, but not in plain Node.
- **License**: MIT, on every published package.

---

## 11. Security posture

- All URLs (link hrefs, image sources) pass through an allow-list sanitizer accepting only `http:`, `https:`, `mailto:`, `tel:`, and scheme-less relative URLs — `javascript:`, `data:`, `vbscript:`, and any other scheme are rejected outright. This applies both when importing HTML and when a command sets a URL directly (e.g. from a UI popover), so there is no bypass via the programmatic API.
- HTML parsing strips `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<base>`, and `<form>` tags outright, and strips every `on*` event-handler attribute from every element.
- HTML export escapes all text content; the only DOM writes the editor ever performs are its own serializer's output applied to a validated in-memory document — never arbitrary external HTML written directly to `innerHTML`.
