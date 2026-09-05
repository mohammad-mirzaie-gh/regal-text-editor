# 👑 Regal Text Editor

### A rich text editing engine built from scratch for the modern web.

<p align="center">
  <strong>Headless</strong> ·
  <strong>Extensible</strong> ·
  <strong>Framework-Independent</strong> ·
  <strong>React-Ready</strong> ·
  <strong>RTL-Aware</strong> ·
  <strong>Security-Conscious</strong>
</p>

<p align="center">
  <a href="https://regal-text-editor.vercel.app/">Live Demo</a>
  ·
  <a href="https://www.npmjs.com/">NPM</a>
  ·
  <a href="https://github.com/mohammad-mirzaie-gh/regal-text-editor">GitHub</a>
</p>

---

## ⚡ What is Regal?

**Regal Text Editor** is a modular rich text editing engine and toolkit for the web, built completely from scratch.

It provides a framework-independent editing core, browser DOM adapter, React bindings, customizable UI components, and a real plugin architecture — distributed as **11 independently installable npm packages**.

Regal is **not a wrapper around ProseMirror, Slate, Lexical, TipTap, or CKEditor**.

The document model, schema system, transactions, selections, commands, history, serialization, parsing, and browser adapter are all implemented inside this project.

> **Rich text, without the black box.**

### 🚀 Try it live

**[Open the Regal Text Editor Demo →](https://regal-text-editor.vercel.app/)**

The live demo runs the actual published-style React/UI stack in the browser, including the full plugin set.

---

## ✨ Why Regal?

Rich text editors often become tightly coupled systems where the editor engine, UI, framework, and features are difficult to separate.

Regal takes a different approach.

### 🧠 Built from scratch

No dependency on an existing rich-text editing engine.

Regal owns its:

* Document model
* Schema system
* Transactions & operations
* Selection model
* Position tracking
* Command system
* Normalization
* Undo / redo history
* HTML parsing
* HTML serialization
* Markdown serialization
* JSON serialization
* Plain-text serialization
* Browser DOM adapter

---

### 🎛️ Headless by default

The core engine does not depend on React or the DOM.

```ts
import { Editor, createBaseSchema } from "@regal-text-editor/core";

const editor = new Editor({
  schema: createBaseSchema(),
  plugins: [],
});
```

This makes the core suitable for:

* Server-side document processing
* Document validation
* Format conversion
* Custom editors
* Custom rendering environments
* Framework-independent applications

You can use the engine without rendering an editor at all.

---

### 🧩 A real plugin architecture

Regal does not treat extensibility as a giant configuration object.

Plugins can register:

* Nodes
* Marks
* Commands
* Keyboard shortcuts
* HTML parsers
* HTML serializers
* Markdown serializers
* Editor behavior

More importantly, **the built-in features use the same plugin architecture available to consumers**.

Bold, headings, lists, links, images, code blocks and history are not privileged features hidden inside the engine.

They're plugins.

---

### 🎨 Theme it without CSS-in-JS

The UI is built around CSS custom properties.

Every major visual token — including colors, spacing, radii and shadows — can be overridden by the host application.

No CSS-in-JS.

No build-time theme generator.

No need to modify package source.

Two built-in themes are included:

```html
<div data-rte-theme="notion">
  ...
</div>
```

```html
<div data-rte-theme="midnight">
  ...
</div>
```

Or create your own theme by overriding the same CSS variables.

---

### ↔️ RTL-aware by construction

RTL is not implemented as a separate visual mode.

Regal uses logical CSS properties and logical alignment values:

```ts
setTextAlign("start");
setTextAlign("center");
setTextAlign("end");
setTextAlign("justify");
```

rather than hard-coded physical directions such as `left` and `right`.

This allows the editor UI and text alignment to behave naturally under:

```html
<div dir="rtl">
```

> Dedicated bidi-cursor testing is still planned.

---

### 🔐 Security-conscious by default

Rich text editors process untrusted HTML and URLs.

Regal treats sanitization as an editing boundary concern.

URLs are validated through an allow-list that accepts:

```text
http:
https:
mailto:
tel:
relative URLs
```

while rejecting dangerous schemes such as:

```text
javascript:
data:
vbscript:
```

Sanitization happens both when importing HTML **and when URLs enter through programmatic commands**.

HTML parsing also removes dangerous elements and event-handler attributes.

Text content is escaped during HTML serialization.

The editor never directly injects arbitrary external HTML into the DOM.

---

## 🏗️ Architecture

Regal is organized into five conceptual layers.

```text
                         ┌──────────────────────────┐
                         │       Application        │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │     @regal-text-editor   │
                         │            /ui           │
                         │ Toolbar · Popovers · UI  │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │     @regal-text-editor   │
                         │           /react         │
                         │ Hooks · Components       │
                         └────────────┬─────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
        ┌────────▼─────────┐                     ┌─────────▼────────┐
        │     Plugins      │                     │     Browser      │
        │                  │                     │      Adapter     │
        │ Marks · Lists    │                     │ DOM · Selection  │
        │ Links · Images   │                     │ Keyboard · IME   │
        │ Code · History   │                     │ Clipboard · DnD  │
        └────────┬─────────┘                     └─────────┬────────┘
                 │                                         │
                 └──────────────────┬──────────────────────┘
                                    │
                         ┌──────────▼───────────┐
                         │       @regal-        │
                         │   text-editor/core   │
                         │                      │
                         │ Document Model       │
                         │ Schema               │
                         │ Transactions         │
                         │ Selection            │
                         │ Commands             │
                         │ History              │
                         │ Serialization        │
                         │ Parsing              │
                         │ Plugin System        │
                         └──────────────────────┘
```

### Dependency philosophy

```text
core
  ↓
browser
  ↓
react
  ↓
ui

plugins → core
```

The core never imports React.

The browser adapter never imports React.

The UI communicates with the editor through the public React API rather than reaching into engine internals.

This means you can replace individual layers without rewriting the entire editor.

---

# 📦 Package Ecosystem

Regal is currently distributed as **11 independent packages** under the `@regal-text-editor/*` scope.

| Package                                  | Description                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@regal-text-editor/core`                | Document model, schema, transactions, selection, commands, history, plugins, serialization, parsing & sanitization |
| `@regal-text-editor/browser`             | DOM rendering, selection mapping, keyboard, IME, clipboard & drag/drop                                             |
| `@regal-text-editor/react`               | React bindings, `<RichTextEditor />` and editor hooks                                                              |
| `@regal-text-editor/ui`                  | Toolbar, bubble toolbar, popovers, icons & theming                                                                 |
| `@regal-text-editor/plugin-basic-marks`  | Bold, italic, underline, strikethrough & inline code                                                               |
| `@regal-text-editor/plugin-basic-blocks` | Paragraphs, headings, blockquotes, HR & alignment                                                                  |
| `@regal-text-editor/plugin-lists`        | Bullet, ordered & task lists, nesting and indentation                                                              |
| `@regal-text-editor/plugin-link`         | Link marks and URL sanitization                                                                                    |
| `@regal-text-editor/plugin-image`        | Block-level images                                                                                                 |
| `@regal-text-editor/plugin-code-block`   | Preformatted code blocks                                                                                           |
| `@regal-text-editor/plugin-history`      | Undo / redo                                                                                                        |

All packages are currently published as **ESM**, include TypeScript declarations and source maps, and are designed for tree-shaking.

---

# 🧰 Features

## ✍️ Text Formatting

* Bold
* Italic
* Underline
* Strikethrough
* Inline code
* Links
* Stored marks

### Keyboard shortcuts

| Action        | Shortcut          |
| ------------- | ----------------- |
| Bold          | `Mod + B`         |
| Italic        | `Mod + I`         |
| Underline     | `Mod + U`         |
| Strikethrough | `Mod + Shift + X` |
| Inline Code   | `Mod + E`         |

`Mod` resolves to `⌘` on macOS and `Ctrl` elsewhere.

---

## 🧱 Block Content

* Paragraphs
* H1–H6
* Blockquotes
* Horizontal rules
* Logical text alignment

```ts
setTextAlign("start");
setTextAlign("center");
setTextAlign("end");
setTextAlign("justify");
```

---

## 📋 Lists

* Bullet lists
* Ordered lists
* Task lists
* Nested lists
* Indent / outdent
* Custom ordered-list start values

Keyboard behavior:

```text
Enter          → Split list item
Enter + empty  → Exit list
Tab            → Indent
Shift + Tab    → Outdent
```

---

## 🔗 Links

```ts
setLink(href);
unsetLink();
getActiveLinkHref(editor);
```

Links are sanitized at the command boundary and during HTML parsing.

Exported links include:

```html
rel="noopener noreferrer"
```

---

## 🖼️ Images

Images are currently represented as **block-level nodes**.

```ts
insertImage(src, alt?);
```

Images are URL-based and use the same URL sanitization rules as links.

Export formats:

* HTML
* Markdown

A built-in upload service is intentionally not included. Applications can connect their own upload infrastructure.

---

## 💻 Code Blocks

```ts
toggleCodeBlock();
```

Shortcut:

```text
Mod + Alt + C
```

Code blocks:

* Preserve whitespace
* Preserve line breaks
* Disable text marks
* Support a `language` attribute
* Import `<pre>` / `<pre><code>`
* Treat `Enter` as a literal line break

Syntax highlighting is not currently included.

---

## ↩️ Undo / Redo

```text
Mod + Z
Mod + Shift + Z
Mod + Y
```

History currently uses snapshots backed by Regal's persistent, structurally-shared document tree.

Rapid typing can be coalesced into a single undo step.

---

## 🔎 Find & Replace

Find & Replace is implemented directly in the core:

```ts
findMatches();
replaceMatch();
replaceAllMatches();
```

The UI is available through:

```tsx
<FindReplacePanel />
```

Search is case-insensitive by default and does not cross block boundaries.

---

# ⚛️ React

Regal provides first-class React bindings without coupling the engine itself to React.

```tsx
import {
  EditorProvider,
  RichTextEditor,
  useEditor,
} from "@regal-text-editor/react";
```

Available APIs include:

```text
<RichTextEditor />
<EditorProvider />
useEditor()
useEditorSelector()
useCommand()
```

Subscriptions are built around React's `useSyncExternalStore` model.

Both controlled and uncontrolled usage are supported.

---

# 🎛️ UI

The optional UI package provides:

```tsx
<Toolbar />
<BubbleToolbar />
<LinkButton />
<ImageButton />
<FindReplacePanel />
<ToolbarButton />
<ToolbarSeparator />
<ToolbarDropdown />
```

The toolbar is data-driven:

```tsx
<Toolbar items={defaultToolbarItems} />
```

You can also completely replace it with your own UI.

---

# 🧪 Quality

Regal currently has:

* **462 automated tests**
* **35 test files**
* **~93% statement coverage**
* Dedicated tests for every package
* Browser adapter tests
* React hook tests
* UI component tests
* Keyboard interaction tests
* IME composition tests
* Clipboard tests
* DOM selection mapping tests
* Full-stack jsdom integration tests

The published packages have also been verified outside the pnpm workspace using a normal `npm install` flow.

---

# 📊 Current Status

Regal is a **working, tested foundation**, not a claim of feature parity with mature editors.

The project intentionally documents its current limitations.

### ✅ Implemented

* Document model
* Schema
* Transactions
* Operations
* Selection & position tracking
* Commands
* Plugin architecture
* Bold / italic / underline / strike / inline code
* Links
* Paragraphs
* Headings
* Blockquotes
* Horizontal rules
* Logical text alignment
* Bullet / ordered / task lists
* List nesting
* Indent / outdent
* Block-level images
* Code blocks
* Undo / redo
* Find & replace
* HTML import/export
* JSON serialization
* Markdown export
* Plain-text serialization
* Read-only mode
* Placeholder / empty state
* Toolbar
* Bubble toolbar
* CSS-variable theming
* React integration

### 🟡 Partial

* Schema content matching
* Snapshot-based history
* Clipboard compatibility
* Drag & drop
* Markdown import
* Accessibility auditing
* Dedicated RTL / bidi cursor testing

### 🚧 Planned

* Tables
* Mentions / bookmarks
* Raw HTML editing
* Autosave helpers
* Slash commands
* Command palette
* Table of contents
* Auto-linking
* Smart typography
* Advanced spellcheck integration
* UI localization
* Syntax highlighting
* Block drag & drop

---

# 📥 Installation

## React

Install the packages you need:

```bash
npm install \
  @regal-text-editor/core \
  @regal-text-editor/browser \
  @regal-text-editor/react \
  @regal-text-editor/ui \
  @regal-text-editor/plugin-basic-blocks \
  @regal-text-editor/plugin-basic-marks \
  @regal-text-editor/plugin-lists \
  @regal-text-editor/plugin-history
```

---

# ⚡ Quick Start

```tsx
import { createBaseSchema } from "@regal-text-editor/core";

import {
  EditorProvider,
  RichTextEditor,
  useEditor,
} from "@regal-text-editor/react";

import {
  Toolbar,
  defaultToolbarItems,
} from "@regal-text-editor/ui";

import "@regal-text-editor/ui/styles.css";

import { BasicBlocksPlugin } from "@regal-text-editor/plugin-basic-blocks";
import { BasicMarksPlugin } from "@regal-text-editor/plugin-basic-marks";
import { ListsPlugin } from "@regal-text-editor/plugin-lists";
import { HistoryPlugin } from "@regal-text-editor/plugin-history";

function Editor() {
  const editor = useEditor({
    schema: createBaseSchema(),

    plugins: [
      BasicBlocksPlugin(),
      BasicMarksPlugin(),
      ListsPlugin(),
      HistoryPlugin(),
    ],
  });

  return (
    <EditorProvider editor={editor}>
      <Toolbar items={defaultToolbarItems} />

      <RichTextEditor
        editor={editor}
        placeholder="Start writing..."
        onChange={(doc) => {
          console.log(doc);
        }}
      />
    </EditorProvider>
  );
}
```

---

# 🧠 Headless Usage

You don't need React or the UI package.

```ts
import {
  Editor,
  createBaseSchema,
} from "@regal-text-editor/core";

import {
  BasicMarksPlugin,
} from "@regal-text-editor/plugin-basic-marks";

const editor = new Editor({
  schema: createBaseSchema(),

  plugins: [
    BasicMarksPlugin(),
  ],
});

editor.commands.execute(
  editor,
  "toggleBold"
);

console.log(editor.getHTML());
console.log(editor.getMarkdown());
console.log(editor.getJSON());
```

This is useful for server-side processing, document manipulation, validation, conversion, or custom editor implementations.

---

# 🔐 Security Model

Regal treats rich-text security as a first-class design concern.

### URL allow-list

Allowed:

```text
http:
https:
mailto:
tel:
relative URLs
```

Rejected:

```text
javascript:
data:
vbscript:
```

### Dangerous HTML

The parser removes dangerous elements such as:

```html
<script>
<style>
<iframe>
<object>
<embed>
<link>
<meta>
<base>
<form>
```

Event-handler attributes such as:

```html
onclick
onload
onerror
```

are removed as well.

### Safe serialization

Text content is escaped during HTML serialization.

The browser adapter only renders HTML produced by Regal's own serializer from its validated document model.

---

# 🌍 Compatibility

### Node.js

Node.js `18.18+` is required for developing and building the monorepo.

### React

React `18+` is required for:

```text
@regal-text-editor/react
@regal-text-editor/ui
```

React is a peer dependency and is not bundled.

### Browser

Regal targets modern evergreen browsers supporting:

* `contentEditable`
* Selection API
* Range API
* `beforeinput`
* Clipboard APIs
* IME composition

HTML parsing requires a `DOMParser`-compatible environment.

---

# 📦 Module Format

Regal is currently:

* ESM-only
* TypeScript typed
* Tree-shaking friendly
* `.d.ts` included
* Source maps included

There is currently **no CommonJS build**.

---

# 🗺️ Roadmap

Regal is being developed around a simple principle:

> **The editor should be extensible without becoming tightly coupled.**

Future development will focus on:

* More document primitives
* More powerful plugins
* Better browser behavior
* Accessibility
* Advanced collaboration primitives
* Better serialization
* Developer tooling
* More framework integrations
* Richer UI primitives

The roadmap will evolve alongside the architecture.

---

# 🤝 Contributing

Contributions are welcome.

Before opening a pull request:

1. Keep changes focused.
2. Add or update tests.
3. Preserve the package boundaries.
4. Keep public APIs strongly typed.
5. Avoid unnecessary dependencies.
6. Document user-facing behavior.
7. Run the complete test suite before submitting.

```bash
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

---

# 📄 License

Regal Text Editor is released under the **MIT License**.

---

<div align="center">

# 👑 Regal Text Editor

### Rich text, without the black box.

Built from scratch.
Designed to be extended.

[Live Demo](https://regal-text-editor.vercel.app/)

</div>
