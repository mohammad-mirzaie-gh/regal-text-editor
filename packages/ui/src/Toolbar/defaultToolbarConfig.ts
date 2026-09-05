import type { ToolbarItem } from "./types";

/** Default toolbar wired to the commands the standard plugin set
 * (@regal-text-editor/plugin-history, plugin-basic-blocks, plugin-basic-marks,
 * plugin-lists, plugin-code-block) registers. Purely data — pass your own
 * array of `ToolbarItem` to `<Toolbar items={...} />` to customize or omit
 * anything. Link and image aren't here: they need a URL from the user, so
 * they're the dedicated `<LinkButton>`/`<ImageButton>` components instead
 * — render those alongside `<Toolbar>` when using `@regal-text-editor/plugin-link`/
 * `@regal-text-editor/plugin-image`. */
export const defaultToolbarItems: ToolbarItem[] = [
  { type: "button", command: "undo", icon: "undo", label: "Undo", shortcut: "Mod-z" },
  { type: "button", command: "redo", icon: "redo", label: "Redo", shortcut: "Mod-Shift-z" },
  { type: "separator" },
  {
    type: "dropdown",
    label: "Paragraph style",
    placeholder: "Style",
    icon: "paragraph",
    showLabel: true,
    options: [
      { command: "setParagraph", label: "Paragraph", icon: "paragraph" },
      { command: "setHeading1", label: "Heading 1", icon: "heading1" },
      { command: "setHeading2", label: "Heading 2", icon: "heading2" },
      { command: "setHeading3", label: "Heading 3", icon: "heading3" }
    ]
  },
  {
    type: "dropdown",
    label: "Text align",
    placeholder: "Align",
    icon: "alignStart",
    options: [
      { command: "setTextAlign", args: ["start"], label: "Align start", icon: "alignStart" },
      { command: "setTextAlign", args: ["center"], label: "Align center", icon: "alignCenter" },
      { command: "setTextAlign", args: ["end"], label: "Align end", icon: "alignEnd" },
      { command: "setTextAlign", args: ["justify"], label: "Justify", icon: "alignJustify" }
    ]
  },
  { type: "separator" },
  { type: "button", command: "toggleBold", icon: "bold", label: "Bold", shortcut: "Mod-b" },
  { type: "button", command: "toggleItalic", icon: "italic", label: "Italic", shortcut: "Mod-i" },
  { type: "button", command: "toggleUnderline", icon: "underline", label: "Underline", shortcut: "Mod-u" },
  { type: "button", command: "toggleStrikethrough", icon: "strikethrough", label: "Strikethrough", shortcut: "Mod-Shift-x" },
  { type: "button", command: "toggleInlineCode", icon: "code", label: "Inline code", shortcut: "Mod-e" },
  { type: "separator" },
  { type: "button", command: "toggleBlockquote", icon: "quote", label: "Quote" },
  { type: "button", command: "toggleCodeBlock", icon: "codeBlock", label: "Code block", shortcut: "Mod-Alt-c" },
  { type: "button", command: "toggleBulletList", icon: "bulletList", label: "Bullet list" },
  { type: "button", command: "toggleOrderedList", icon: "orderedList", label: "Numbered list" },
  { type: "separator" },
  { type: "button", command: "insertHorizontalRule", icon: "horizontalRule", label: "Divider" }
];
