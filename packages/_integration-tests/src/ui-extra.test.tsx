import { describe, expect, it, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { createBaseSchema } from "@regal-text-editor/core";
import { EditorProvider, RichTextEditor, useEditor } from "@regal-text-editor/react";
import { LinkButton, ImageButton, FindReplacePanel, BubbleToolbar, Toolbar, defaultToolbarItems } from "@regal-text-editor/ui";
import { BasicBlocksPlugin } from "@regal-text-editor/plugin-basic-blocks";
import { BasicMarksPlugin } from "@regal-text-editor/plugin-basic-marks";
import { LinkPlugin } from "@regal-text-editor/plugin-link";
import { ImagePlugin } from "@regal-text-editor/plugin-image";
import { HistoryPlugin } from "@regal-text-editor/plugin-history";

afterEach(() => cleanup());

function Harness({ children }: { children: (editor: ReturnType<typeof useEditor>) => ReactNode }): JSX.Element {
  const editor = useEditor({
    schema: createBaseSchema(),
    plugins: [BasicBlocksPlugin(), BasicMarksPlugin(), LinkPlugin(), ImagePlugin(), HistoryPlugin()]
  });
  return <EditorProvider editor={editor}>{children(editor)}</EditorProvider>;
}

describe("<ImageButton>", () => {
  it("is disabled with no selection", () => {
    render(
      <Harness>
        {() => (
          <>
            <ImageButton />
            <RichTextEditor />
          </>
        )}
      </Harness>
    );
    // A freshly-mounted editor with no autoFocus has no model selection yet.
    const button = screen.getByRole("button", { name: "Image" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("opens and closes the popover on repeated clicks", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <ImageButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hi</p>" }));
    act(() => capturedEditor!.setSelection({ type: "cursor", position: { path: [0, 0], offset: 2 } }));
    const button = screen.getByRole("button", { name: "Image" });
    expect(screen.queryByRole("dialog", { name: "Insert image" })).toBeNull();
    act(() => fireEvent.click(button));
    expect(screen.getByRole("dialog", { name: "Insert image" })).toBeTruthy();
    act(() => fireEvent.click(button));
    expect(screen.queryByRole("dialog", { name: "Insert image" })).toBeNull();
  });

  it("inserts an image with src and alt via the Insert button", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <ImageButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hi</p>" }));
    act(() => capturedEditor!.setSelection({ type: "cursor", position: { path: [0, 0], offset: 2 } }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Image" })));
    act(() => {
      fireEvent.change(screen.getByPlaceholderText("Image URL…"), { target: { value: "https://example.com/a.png" } });
      fireEvent.change(screen.getByPlaceholderText("Alt text (optional)"), { target: { value: "a cat" } });
      fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    });
    expect(capturedEditor!.getHTML()).toContain('<img src="https://example.com/a.png" alt="a cat">');
    expect(screen.queryByRole("dialog", { name: "Insert image" })).toBeNull();
  });

  it("does not insert when the src field is left empty, but still closes on Enter", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <ImageButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hi</p>" }));
    act(() => capturedEditor!.setSelection({ type: "cursor", position: { path: [0, 0], offset: 2 } }));
    const before = capturedEditor!.getHTML();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Image" })));
    act(() => fireEvent.keyDown(screen.getByPlaceholderText("Image URL…"), { key: "Enter" }));
    expect(capturedEditor!.getHTML()).toBe(before);
    expect(screen.queryByRole("dialog", { name: "Insert image" })).toBeNull();
  });

  it("closes the popover on Escape from either field", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <ImageButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hi</p>" }));
    act(() => capturedEditor!.setSelection({ type: "cursor", position: { path: [0, 0], offset: 2 } }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Image" })));
    act(() => fireEvent.keyDown(screen.getByPlaceholderText("Alt text (optional)"), { key: "Escape" }));
    expect(screen.queryByRole("dialog", { name: "Insert image" })).toBeNull();
  });
});

describe("<LinkButton> extra flows", () => {
  it("closes an already-open popover by clicking the button again", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <LinkButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hello</p>" }));
    act(() => capturedEditor!.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } }));
    const button = screen.getByRole("button", { name: "Link" });
    act(() => fireEvent.click(button));
    expect(screen.getByRole("dialog", { name: "Edit link" })).toBeTruthy();
    act(() => fireEvent.click(button));
    expect(screen.queryByRole("dialog", { name: "Edit link" })).toBeNull();
  });

  it("applies a link on Enter inside the input", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <LinkButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hello</p>" }));
    act(() => capturedEditor!.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Link" })));
    act(() => {
      fireEvent.change(screen.getByPlaceholderText("https://…"), { target: { value: "https://example.com" } });
      fireEvent.keyDown(screen.getByPlaceholderText("https://…"), { key: "Enter" });
    });
    expect(capturedEditor!.getHTML()).toBe('<p><a href="https://example.com" rel="noopener noreferrer">hello</a></p>');
    expect(screen.queryByRole("dialog", { name: "Edit link" })).toBeNull();
  });

  it("closes without applying on Escape", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <LinkButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hello</p>" }));
    act(() => capturedEditor!.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Link" })));
    act(() => {
      fireEvent.change(screen.getByPlaceholderText("https://…"), { target: { value: "https://example.com" } });
      fireEvent.keyDown(screen.getByPlaceholderText("https://…"), { key: "Escape" });
    });
    expect(capturedEditor!.getHTML()).toBe("<p>hello</p>");
    expect(screen.queryByRole("dialog", { name: "Edit link" })).toBeNull();
  });

  it("does not apply an empty/whitespace href, but still closes the popover", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <LinkButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hello</p>" }));
    act(() => capturedEditor!.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Link" })));
    act(() => {
      fireEvent.change(screen.getByPlaceholderText("https://…"), { target: { value: "   " } });
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });
    expect(capturedEditor!.getHTML()).toBe("<p>hello</p>");
    expect(screen.queryByRole("dialog", { name: "Edit link" })).toBeNull();
  });

  it("is disabled when the selection is collapsed and not already on a link", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <LinkButton />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>hello</p>" }));
    act(() => capturedEditor!.setSelection({ type: "cursor", position: { path: [0, 0], offset: 2 } }));
    expect(screen.getByRole("button", { name: "Link" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("<FindReplacePanel> extra flows", () => {
  function setup() {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    const onClose = vi.fn();
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <RichTextEditor editor={editor} />
              <FindReplacePanel onClose={onClose} />
            </>
          );
        }}
      </Harness>
    );
    act(() => capturedEditor!.setContent({ html: "<p>cat and cat and dog</p>" }));
    return { getEditor: () => capturedEditor!, onClose };
  }

  it("shows 0/0 and disables navigation/replace buttons when there are no matches", () => {
    setup();
    expect(screen.getByText("0/0")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous match" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Next match" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Replace" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Replace all" }).hasAttribute("disabled")).toBe(true);
  });

  it("cycles forward and backward through matches, wrapping at both ends", () => {
    setup();
    const queryInput = screen.getByPlaceholderText("Find…");
    act(() => fireEvent.change(queryInput, { target: { value: "cat" } }));
    expect(screen.getByText("1/2")).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole("button", { name: "Next match" })));
    expect(screen.getByText("2/2")).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole("button", { name: "Next match" })));
    expect(screen.getByText("1/2")).toBeTruthy(); // wraps forward

    act(() => fireEvent.click(screen.getByRole("button", { name: "Previous match" })));
    expect(screen.getByText("2/2")).toBeTruthy(); // wraps backward
  });

  it("Enter/Shift+Enter in the query field move to the next/previous match", () => {
    setup();
    const queryInput = screen.getByPlaceholderText("Find…");
    act(() => fireEvent.change(queryInput, { target: { value: "cat" } }));
    act(() => fireEvent.keyDown(queryInput, { key: "Enter" }));
    expect(screen.getByText("2/2")).toBeTruthy();
    act(() => fireEvent.keyDown(queryInput, { key: "Enter", shiftKey: true }));
    expect(screen.getByText("1/2")).toBeTruthy();
  });

  it("Escape in the query field calls onClose", () => {
    const { onClose } = setup();
    const queryInput = screen.getByPlaceholderText("Find…");
    act(() => fireEvent.keyDown(queryInput, { key: "Escape" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("the Close button calls onClose", () => {
    const { onClose } = setup();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
    expect(onClose).toHaveBeenCalled();
  });

  it("respects the case-sensitive checkbox", () => {
    const { getEditor } = setup();
    act(() => getEditor().setContent({ html: "<p>Cat and cat</p>" }));
    const queryInput = screen.getByPlaceholderText("Find…");
    act(() => fireEvent.change(queryInput, { target: { value: "cat" } }));
    expect(screen.getByText("1/2")).toBeTruthy();
    act(() => fireEvent.click(screen.getByLabelText("Aa")));
    expect(screen.getByText("1/1")).toBeTruthy();
  });

  it("replaces only the current match with the Replace button", () => {
    const { getEditor } = setup();
    act(() => fireEvent.change(screen.getByPlaceholderText("Find…"), { target: { value: "cat" } }));
    act(() => fireEvent.change(screen.getByPlaceholderText("Replace…"), { target: { value: "dog" } }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Replace" })));
    expect(getEditor().getHTML()).toBe("<p>dog and cat and dog</p>");
  });

  it("Enter in the replace field replaces the current match", () => {
    const { getEditor } = setup();
    act(() => fireEvent.change(screen.getByPlaceholderText("Find…"), { target: { value: "cat" } }));
    const replaceInput = screen.getByPlaceholderText("Replace…");
    act(() => fireEvent.change(replaceInput, { target: { value: "dog" } }));
    act(() => fireEvent.keyDown(replaceInput, { key: "Enter" }));
    expect(getEditor().getHTML()).toBe("<p>dog and cat and dog</p>");
  });

  it("renders with no Close button when onClose isn't provided", () => {
    render(
      <Harness>
        {(editor) => (
          <>
            <RichTextEditor editor={editor} />
            <FindReplacePanel />
          </>
        )}
      </Harness>
    );
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});

describe("<BubbleToolbar>", () => {
  it("renders nothing when the selection is collapsed", () => {
    render(
      <Harness>
        {(editor) => (
          <>
            <RichTextEditor editor={editor} />
            <BubbleToolbar items={defaultToolbarItems} />
          </>
        )}
      </Harness>
    );
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("renders the toolbar positioned at the selection's bounding rect once one exists", () => {
    // jsdom's Range prototype doesn't implement getBoundingClientRect at
    // all (unlike a real browser), so it must be installed outright rather
    // than spied on.
    const original = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = () =>
      ({ top: 40, left: 60, width: 80, height: 20, bottom: 60, right: 140, x: 60, y: 40, toJSON: () => ({}) }) as DOMRect;
    try {
      let capturedEditor: ReturnType<typeof useEditor> | undefined;
      render(
        <Harness>
          {(editor) => {
            capturedEditor = editor;
            return (
              <>
                <RichTextEditor editor={editor} />
                <BubbleToolbar items={defaultToolbarItems} />
              </>
            );
          }}
        </Harness>
      );
      act(() => capturedEditor!.setContent({ html: "<p>hello world</p>" }));
      act(() => {
        capturedEditor!.setSelection({ type: "range", anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } });
      });
      expect(screen.getByRole("toolbar")).toBeTruthy();
    } finally {
      Range.prototype.getBoundingClientRect = original;
    }
  });
});

describe("<ToolbarButton>", () => {
  it('marks data-active="mixed" when the underlying command reports a mixed state', () => {
    // No shipped plugin's isActive ever actually returns "mixed" today (the
    // CommandRegistry type allows it for a future command that would), so
    // this exercises ToolbarButton's own rendering of that state directly
    // via a test-only command rather than a real plugin.
    render(
      <Harness>
        {(editor) => {
          editor.commands.register("testMixed", { execute: () => true, isActive: () => "mixed" });
          return (
            <>
              <Toolbar items={[{ type: "button", command: "testMixed", icon: "bold", label: "Test Mixed" }]} />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );
    const button = screen.getByRole("button", { name: "Test Mixed" });
    expect(button.getAttribute("data-active")).toBe("mixed");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
