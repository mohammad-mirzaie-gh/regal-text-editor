import type { Editor, EditorConfig, EditorDocument } from "@rte/core";

export interface EditorHandle {
  editor: Editor;
  focus: () => void;
  blur: () => void;
  getJSON: () => EditorDocument;
  getHTML: () => string;
  getMarkdown: () => string;
  getText: () => string;
}

export interface RichTextEditorProps extends Partial<Pick<EditorConfig, "plugins" | "schema" | "history" | "onError">> {
  /** Use an externally-created (e.g. via `useEditor`) editor instead of letting this component own one. */
  editor?: Editor;
  /** Controlled document value. When provided together with `onChange`, keeps the editor in sync with external state. */
  value?: EditorDocument;
  /** Initial document for uncontrolled usage. Ignored if `editor` or `value` is provided. */
  defaultValue?: EditorDocument;
  onChange?: (doc: EditorDocument) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}
