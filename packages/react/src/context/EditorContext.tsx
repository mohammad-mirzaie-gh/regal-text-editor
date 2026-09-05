import { createContext, useContext, type ReactNode } from "react";
import type { Editor } from "@regal-text-editor/core";

export const EditorContext = createContext<Editor | null>(null);

/** Reads the ambient editor instance provided by an enclosing
 * `<RichTextEditor>` or `<EditorProvider>` — for toolbar buttons, menus and
 * any custom UI that needs to read state or dispatch commands without
 * prop-drilling the editor. */
export function useEditorContext(): Editor {
  const editor = useContext(EditorContext);
  if (!editor) {
    throw new Error(
      "useEditorContext() must be used within a <RichTextEditor> or an <EditorProvider editor={...}>"
    );
  }
  return editor;
}

/**
 * Shares an editor instance with UI that renders *outside* (a sibling of,
 * or an ancestor above) a `<RichTextEditor>` — a toolbar placed next to
 * the editable area rather than nested inside it, for example. Pair with
 * `useEditor()` to own the instance in a parent component and hand the same
 * editor to both `<EditorProvider>`'s children and `<RichTextEditor editor={...}>`:
 *
 * ```tsx
 * const editor = useEditor({ schema, plugins });
 * return (
 *   <EditorProvider editor={editor}>
 *     <Toolbar items={defaultToolbarItems} />
 *     <RichTextEditor editor={editor} />
 *   </EditorProvider>
 * );
 * ```
 *
 * `<RichTextEditor>` also provides this same context internally around its
 * own container, so nesting `<EditorProvider>` isn't required when your
 * toolbar/menus render as children of `<RichTextEditor>` itself.
 */
export function EditorProvider({ editor, children }: { editor: Editor; children: ReactNode }): JSX.Element {
  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
}
