import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { createRef, StrictMode } from "react";
import { createBaseSchema, type EditorDocument } from "@regal-text-editor/core";
import { EditorProvider, RichTextEditor, useEditor, useEditorContext, type EditorHandle } from "@regal-text-editor/react";
import { Toolbar, defaultToolbarItems } from "@regal-text-editor/ui";
import { BasicMarksPlugin } from "@regal-text-editor/plugin-basic-marks";
import { BasicBlocksPlugin } from "@regal-text-editor/plugin-basic-blocks";
import { HistoryPlugin } from "@regal-text-editor/plugin-history";
import { afterEach } from "vitest";

afterEach(() => cleanup());

describe("<RichTextEditor>", () => {
  it("mounts an editable container and exposes an imperative handle", () => {
    const ref = createRef<EditorHandle>();
    render(<RichTextEditor ref={ref} schema={createBaseSchema()} plugins={[BasicBlocksPlugin()]} />);
    const root = screen.getByRole("textbox");
    expect(root.getAttribute("contenteditable")).toBe("true");
    expect(ref.current?.getText()).toBe("");
    expect(ref.current?.getHTML()).toBe("<p><br></p>");
  });

  it("fires onChange with the new document when the user types", () => {
    const onChange = vi.fn();
    render(<RichTextEditor schema={createBaseSchema()} plugins={[BasicBlocksPlugin()]} onChange={onChange} />);
    const root = screen.getByRole("textbox");
    act(() => {
      root.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: "hi", cancelable: true, bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();
    const doc = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as EditorDocument;
    expect((doc.children[0]!.children[0] as { text: string }).text).toBe("hi");
  });

  it("syncs a controlled `value` prop into the editor without looping", () => {
    const initial: EditorDocument = {
      object: "document",
      id: "d1",
      children: [{ object: "element", id: "b1", type: "paragraph", attrs: {}, children: [{ object: "text", text: "controlled", marks: [] }] }]
    };
    const onChange = vi.fn();
    const { rerender } = render(
      <RichTextEditor schema={createBaseSchema()} plugins={[BasicBlocksPlugin()]} value={initial} onChange={onChange} />
    );
    expect(screen.getByRole("textbox").textContent).toBe("controlled");

    // Re-rendering with the SAME reference must not re-apply/reset content.
    rerender(<RichTextEditor schema={createBaseSchema()} plugins={[BasicBlocksPlugin()]} value={initial} onChange={onChange} />);
    expect(screen.getByRole("textbox").textContent).toBe("controlled");
  });

  it("marks the editor empty via data-is-empty for placeholder styling", () => {
    render(<RichTextEditor schema={createBaseSchema()} plugins={[BasicBlocksPlugin()]} placeholder="Start writing..." />);
    const root = screen.getByRole("textbox");
    expect(root.getAttribute("data-is-empty")).toBe("true");
    expect(root.getAttribute("data-placeholder")).toBe("Start writing...");

    act(() => {
      root.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: "x", cancelable: true, bubbles: true }));
    });
    expect(root.getAttribute("data-is-empty")).toBe("false");
  });

  it("survives React 18 StrictMode's dev-only mount-cleanup-remount cycle (editor stays usable, not destroyed)", () => {
    function Harness({ handleRef }: { handleRef: (editor: ReturnType<typeof useEditor>) => void }) {
      const editor = useEditor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin()] });
      handleRef(editor);
      return <RichTextEditor editor={editor} />;
    }

    let captured: ReturnType<typeof useEditor> | undefined;
    render(
      <StrictMode>
        <Harness handleRef={(editor) => (captured = editor)} />
      </StrictMode>
    );

    expect(captured).toBeDefined();
    const root = screen.getByRole("textbox");
    act(() => {
      root.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: "still alive", cancelable: true, bubbles: true }));
    });
    expect(captured!.getText()).toBe("still alive");
  });

  it("reflects toggleBold command state through useCommand-style plugin commands", () => {
    const ref = createRef<EditorHandle>();
    render(<RichTextEditor ref={ref} schema={createBaseSchema()} plugins={[BasicBlocksPlugin(), BasicMarksPlugin()]} />);
    const editor = ref.current!.editor;
    editor.setContent({ html: "<p>hello</p>" });
    editor.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
    editor.commands.execute(editor, "toggleBold");
    expect(ref.current?.getHTML()).toBe("<p><strong>hello</strong></p>");
  });

  it("lets a <Toolbar> rendered as a SIBLING of <RichTextEditor> reach the editor via <EditorProvider>", () => {
    // Regression test: the example app renders <Toolbar> next to (not
    // nested inside) <RichTextEditor>, which previously threw because
    // ToolbarButton's useEditorContext() had no ambient provider to read
    // from — nothing wired the two together outside of the DOM-adjacent
    // <RichTextEditor>'s own internal, non-exported provider.
    function Harness() {
      const editor = useEditor({ schema: createBaseSchema(), plugins: [BasicBlocksPlugin(), BasicMarksPlugin(), HistoryPlugin()] });
      return (
        <EditorProvider editor={editor}>
          <Toolbar items={defaultToolbarItems} />
          <RichTextEditor editor={editor} />
        </EditorProvider>
      );
    }

    expect(() => render(<Harness />)).not.toThrow();

    const root = screen.getByRole("textbox");
    act(() => {
      root.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: "hello", cancelable: true, bubbles: true }));
    });

    const boldButton = screen.getByRole("button", { name: "Bold" });
    act(() => {
      fireEvent.click(boldButton);
    });
    // Toggling bold with a collapsed cursor sets a stored mark rather than
    // mutating the document — assert the button itself reflects that state
    // rather than the (unchanged) HTML.
    expect(boldButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("builds its own owned Editor from schema/plugins/history/onError/defaultValue/editable when no external editor is given", () => {
    const onError = vi.fn();
    const defaultValue: EditorDocument = {
      object: "document",
      id: "d2",
      children: [{ object: "element", id: "b2", type: "paragraph", attrs: {}, children: [{ object: "text", text: "seeded", marks: [] }] }]
    };
    const ref = createRef<EditorHandle>();
    render(
      <RichTextEditor
        ref={ref}
        schema={createBaseSchema()}
        plugins={[BasicBlocksPlugin()]}
        history={{ typingDelay: 1 }}
        onError={onError}
        defaultValue={defaultValue}
        editable={false}
      />
    );
    expect(ref.current?.getText()).toBe("seeded");
    expect(screen.getByRole("textbox").getAttribute("contenteditable")).toBe("false");
  });

  it("applies an explicit editable prop change after mount", () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <RichTextEditor ref={ref} schema={createBaseSchema()} plugins={[BasicBlocksPlugin()]} editable={true} />
    );
    expect(screen.getByRole("textbox").getAttribute("contenteditable")).toBe("true");
    rerender(<RichTextEditor ref={ref} schema={createBaseSchema()} plugins={[BasicBlocksPlugin()]} editable={false} />);
    expect(ref.current?.editor.editable).toBe(false);
  });

  it("exposes focus/blur/getMarkdown through the imperative handle", () => {
    const ref = createRef<EditorHandle>();
    render(<RichTextEditor ref={ref} schema={createBaseSchema()} plugins={[BasicBlocksPlugin()]} />);
    act(() => ref.current?.focus());
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    act(() => ref.current?.blur());
    expect(ref.current?.editor.isFocused()).toBe(false);
    expect(ref.current?.getMarkdown()).toBe("");
  });
});

describe("useEditorContext", () => {
  it("throws a descriptive error when used outside any provider", () => {
    function Broken() {
      useEditorContext();
      return null;
    }
    // Suppress the expected React error-boundary console noise for this assertion.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Broken />)).toThrow(/must be used within a <RichTextEditor>/);
    } finally {
      spy.mockRestore();
    }
  });
});
