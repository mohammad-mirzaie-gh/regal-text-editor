import { useMemo, useState, type CSSProperties } from "react";
import { createBaseSchema } from "@rte/core";
import { EditorProvider, RichTextEditor, useEditor, useEditorSelector } from "@rte/react";
import { Toolbar, BubbleToolbar, LinkButton, ImageButton, FindReplacePanel, Icon, defaultToolbarItems } from "@rte/ui";
import "@rte/ui/styles.css";
import { BasicBlocksPlugin } from "@rte/plugin-basic-blocks";
import { BasicMarksPlugin } from "@rte/plugin-basic-marks";
import { ListsPlugin } from "@rte/plugin-lists";
import { LinkPlugin } from "@rte/plugin-link";
import { ImagePlugin } from "@rte/plugin-image";
import { CodeBlockPlugin } from "@rte/plugin-code-block";
import { HistoryPlugin } from "@rte/plugin-history";

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

// A smaller item set for the bubble toolbar that follows the selection —
// link isn't here because collecting a URL needs <LinkButton>'s own
// popover, which (unlike a plain command button) isn't expressible as a
// declarative ToolbarItem yet.
const bubbleToolbarItems = defaultToolbarItems.filter(
  (item) => item.type === "button" && ["toggleBold", "toggleItalic", "toggleUnderline", "toggleInlineCode"].includes(item.command)
);

const THEMES = [
  { id: "default", label: "Default" },
  { id: "notion", label: "Notion" },
  { id: "midnight", label: "Midnight" }
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

const secondaryButtonStyle: CSSProperties = {
  height: 30,
  padding: "0 12px",
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 8,
  border: "1px solid var(--editor-border)",
  background: "transparent",
  color: "var(--editor-text)",
  cursor: "pointer",
  transition: "background-color 120ms ease"
};

export function App(): JSX.Element {
  const plugins = useMemo(
    () => [
      BasicBlocksPlugin(),
      BasicMarksPlugin(),
      ListsPlugin(),
      LinkPlugin(),
      ImagePlugin(),
      CodeBlockPlugin(),
      HistoryPlugin()
    ],
    []
  );
  const editor = useEditor({ schema: createBaseSchema(), plugins });

  const [editable, setEditable] = useState(true);
  const [previewMode, setPreviewMode] = useState<"none" | "html" | "markdown" | "json">("none");
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("default");

  const text = useEditorSelector(editor, (e) => e.getText());
  const wordCount = countWords(text);
  const charCount = text.length;

  const previewContent = useEditorSelector(editor, (e) => {
    if (previewMode === "html") return e.getHTML();
    if (previewMode === "markdown") return e.getMarkdown();
    if (previewMode === "json") return JSON.stringify(e.getJSON(), null, 2);
    return "";
  });

  return (
    <div
      data-rte-theme={theme === "default" ? undefined : theme}
      style={{ minHeight: "100vh", background: "var(--editor-bg)", color: "var(--editor-text)", transition: "background-color 150ms ease" }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px", fontFamily: "var(--editor-font, sans-serif)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Rich Text Editor</h1>
            <p style={{ color: "var(--editor-text-secondary)", margin: "6px 0 0", fontSize: 14 }}>
              A demo of every plugin: formatting, lists, links, images, code blocks, find &amp; replace.
            </p>
          </div>
          <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "var(--editor-toolbar-bg)", border: "1px solid var(--editor-border)", borderRadius: 10 }}>
            {THEMES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                style={{
                  height: 28,
                  padding: "0 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: theme === option.id ? "var(--editor-active)" : "transparent",
                  color: theme === option.id ? "var(--editor-active-text)" : "var(--editor-text-secondary)"
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <EditorProvider editor={editor}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <Toolbar items={defaultToolbarItems} className="rte-toolbar-grow" />
            <LinkButton />
            <ImageButton />
            <button
              type="button"
              className="rte-toolbar-button"
              aria-label="Find and replace"
              aria-pressed={showFindReplace}
              data-active={showFindReplace ? "true" : "false"}
              title="Find and replace"
              onClick={() => setShowFindReplace((wasOpen) => !wasOpen)}
            >
              <Icon name="search" />
            </button>
          </div>
          {showFindReplace && (
            <div style={{ marginTop: 8 }}>
              <FindReplacePanel onClose={() => setShowFindReplace(false)} />
            </div>
          )}
          <BubbleToolbar items={bubbleToolbarItems} />
          <RichTextEditor editor={editor} editable={editable} placeholder="Start writing..." autoFocus />
        </EditorProvider>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--editor-text-secondary)",
            marginTop: 10
          }}
        >
          <span>
            {wordCount} words · {charCount} characters
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={!editable} onChange={(event) => setEditable(!event.target.checked)} />
            Read-only
          </label>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["none", "html", "markdown", "json"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPreviewMode(mode)}
                style={{
                  ...secondaryButtonStyle,
                  background: previewMode === mode ? "var(--editor-active)" : "transparent",
                  color: previewMode === mode ? "var(--editor-active-text)" : "var(--editor-text)",
                  borderColor: previewMode === mode ? "transparent" : "var(--editor-border)"
                }}
              >
                {mode === "none" ? "Hide preview" : mode.toUpperCase()}
              </button>
            ))}
          </div>
          {previewMode !== "none" && (
            <pre
              style={{
                marginTop: 10,
                padding: 14,
                background: "var(--editor-code-bg)",
                border: "1px solid var(--editor-border)",
                borderRadius: 10,
                fontSize: 12,
                color: "var(--editor-text)",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}
            >
              {previewContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
