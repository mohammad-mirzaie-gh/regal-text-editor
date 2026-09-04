import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Editor, createBaseSchema, type EditorDocument } from "@rte/core";
import { EditorView } from "@rte/browser";
import { EditorContext } from "../context/EditorContext";
import { useEditorSelector } from "../hooks/useEditorSelector";
import type { EditorHandle, RichTextEditorProps } from "./types";

/**
 * The framework integration point (Layer 5). Owns (or accepts) an `Editor`
 * instance, mounts an `EditorView` (Layer 2) onto a container div exactly
 * once per editor instance, and keeps that mount stable across React
 * re-renders — re-rendering this component never tears down and rebuilds
 * the DOM editing surface, only the editor's own `render()` (driven by
 * `editor.subscribe`) updates the container's contents.
 */
export const RichTextEditor = forwardRef<EditorHandle, RichTextEditorProps>(function RichTextEditor(
  {
    editor: externalEditor,
    schema,
    plugins,
    history,
    onError,
    value,
    defaultValue,
    onChange,
    editable,
    placeholder,
    className,
    autoFocus
  },
  ref
) {
  const [ownedEditor] = useState(() =>
    externalEditor
      ? null
      : new Editor({
          schema: schema ?? createBaseSchema(),
          ...(plugins !== undefined ? { plugins } : {}),
          ...(history !== undefined ? { history } : {}),
          ...(onError !== undefined ? { onError } : {}),
          ...(value !== undefined || defaultValue !== undefined ? { initialDoc: value ?? defaultValue } : {}),
          ...(editable !== undefined ? { editable } : {})
        })
  );
  const editor = externalEditor ?? ownedEditor!;

  // Deliberately no destroy-on-unmount effect here — see the comment on
  // `useEditor` (packages/react/src/hooks/useEditor.ts) for why: `useState`'s
  // initializer runs at most once per component instance, so destroying in
  // a cleanup would permanently kill the component's only editor instance
  // during React 18 StrictMode's development-only mount→cleanup→remount
  // simulation, even though nothing about this editor holds an external
  // resource that actually needs tearing down.

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const view = new EditorView({ editor, container: containerRef.current, ...(autoFocus !== undefined ? { autoFocus } : {}) });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally keyed on `editor` alone: `autoFocus` should only apply
    // to the initial mount of this view, not re-mount it on every change.
  }, [editor]);

  // Controlled value: push external `value` into the editor when it
  // changes, but only when it's not the document we ourselves just emitted
  // via onChange (reference-equality guard against an update loop).
  const lastEmittedRef = useRef<EditorDocument | null>(null);
  useEffect(() => {
    if (value !== undefined && value !== lastEmittedRef.current) {
      editor.setContent(value);
      lastEmittedRef.current = value;
    }
  }, [value, editor]);

  useEffect(() => {
    if (!onChange) return undefined;
    return editor.on("change", () => {
      const json = editor.getJSON();
      lastEmittedRef.current = json;
      onChange(json);
    });
  }, [onChange, editor]);

  useEffect(() => {
    if (editable !== undefined) editor.setEditable(editable);
  }, [editable, editor]);

  const isEmpty = useEditorSelector(editor, (e) => e.isEmpty());

  useImperativeHandle(
    ref,
    () => ({
      editor,
      focus: () => viewRef.current?.focus(),
      blur: () => editor.blur(),
      getJSON: () => editor.getJSON(),
      getHTML: () => editor.getHTML(),
      getMarkdown: () => editor.getMarkdown(),
      getText: () => editor.getText()
    }),
    [editor]
  );

  return (
    <EditorContext.Provider value={editor}>
      <div
        ref={containerRef}
        className={className}
        data-rte-editable-root=""
        data-is-empty={isEmpty ? "true" : "false"}
        data-placeholder={placeholder}
      />
    </EditorContext.Provider>
  );
});
