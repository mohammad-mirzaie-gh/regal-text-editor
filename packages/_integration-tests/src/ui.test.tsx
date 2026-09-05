import { describe, expect, it, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { createBaseSchema } from "@regal-text-editor/core";
import { EditorProvider, RichTextEditor, useEditor } from "@regal-text-editor/react";
import { Toolbar, defaultToolbarItems, LinkButton, FindReplacePanel } from "@regal-text-editor/ui";
import { BasicBlocksPlugin } from "@regal-text-editor/plugin-basic-blocks";
import { BasicMarksPlugin } from "@regal-text-editor/plugin-basic-marks";
import { LinkPlugin } from "@regal-text-editor/plugin-link";
import { HistoryPlugin } from "@regal-text-editor/plugin-history";

afterEach(() => cleanup());

function Harness({ children }: { children: (editor: ReturnType<typeof useEditor>) => ReactNode }): JSX.Element {
  const editor = useEditor({
    schema: createBaseSchema(),
    plugins: [BasicBlocksPlugin(), BasicMarksPlugin(), LinkPlugin(), HistoryPlugin()]
  });
  return <EditorProvider editor={editor}>{children(editor)}</EditorProvider>;
}

describe("<ToolbarDropdown>", () => {
  it("switches the current block's style and reflects the active option", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <Toolbar items={defaultToolbarItems} />
              <RichTextEditor editor={editor} />
            </>
          );
        }}
      </Harness>
    );

    act(() => {
      screen.getByRole("textbox").dispatchEvent(
        new InputEvent("beforeinput", { inputType: "insertText", data: "hello", cancelable: true, bubbles: true })
      );
    });

    const trigger = screen.getByRole("button", { name: "Paragraph style" });
    expect(trigger.getAttribute("data-active")).toBe("true"); // Paragraph is active on a fresh paragraph

    act(() => {
      fireEvent.click(trigger);
    });
    act(() => {
      fireEvent.click(screen.getByRole("menuitemradio", { name: "Heading 1" }));
    });

    expect(capturedEditor!.getHTML()).toBe("<h1>hello</h1>");
    expect(trigger.getAttribute("data-active")).toBe("true");
    expect(trigger.getAttribute("title")).toBe("Heading 1");
  });

  it("closes when focus leaves the control and supports arrow-key navigation", () => {
    render(
      <Harness>
        {(editor) => (
          <>
            <Toolbar items={defaultToolbarItems} />
            <RichTextEditor editor={editor} />
          </>
        )}
      </Harness>
    );

    // The align options only become executable once there's a selection.
    act(() => {
      screen.getByRole("textbox").dispatchEvent(
        new InputEvent("beforeinput", { inputType: "insertText", data: "hello", cancelable: true, bubbles: true })
      );
    });

    const trigger = screen.getByRole("button", { name: "Text align" });
    act(() => {
      fireEvent.click(trigger);
    });
    expect(screen.getByRole("menu", { name: "Text align" })).toBeTruthy();

    const first = screen.getByRole("menuitemradio", { name: "Align start" });
    expect(document.activeElement).toBe(first);

    act(() => {
      fireEvent.keyDown(first, { key: "ArrowDown" });
    });
    const second = screen.getByRole("menuitemradio", { name: "Align center" });
    expect(document.activeElement).toBe(second);

    act(() => {
      fireEvent.keyDown(second, { key: "Escape" });
    });
    expect(screen.queryByRole("menu", { name: "Text align" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("<LinkButton>", () => {
  it("applies a link to the current selection via its popover, then removes it", () => {
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

    act(() => {
      capturedEditor!.setContent({ html: "<p>visit example</p>" });
    });
    act(() => {
      capturedEditor!.setSelection({
        type: "range",
        anchor: { path: [0, 0], offset: 6 },
        focus: { path: [0, 0], offset: 13 }
      });
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Link" }));
    });
    const input = screen.getByPlaceholderText("https://…");
    act(() => {
      fireEvent.change(input, { target: { value: "https://example.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });

    expect(capturedEditor!.getHTML()).toBe('<p>visit <a href="https://example.com" rel="noopener noreferrer">example</a></p>');
    expect(screen.getByRole("button", { name: "Link" }).getAttribute("aria-pressed")).toBe("true");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Link" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    });
    expect(capturedEditor!.getHTML()).toBe("<p>visit example</p>");
  });
});

describe("<FindReplacePanel>", () => {
  it("counts matches and replaces all occurrences", () => {
    let capturedEditor: ReturnType<typeof useEditor> | undefined;
    render(
      <Harness>
        {(editor) => {
          capturedEditor = editor;
          return (
            <>
              <RichTextEditor editor={editor} />
              <FindReplacePanel />
            </>
          );
        }}
      </Harness>
    );

    act(() => {
      capturedEditor!.setContent({ html: "<p>cat and cat and dog</p>" });
    });

    const queryInput = screen.getByPlaceholderText("Find…");
    act(() => {
      fireEvent.change(queryInput, { target: { value: "cat" } });
    });
    expect(screen.getByText("1/2")).toBeTruthy();

    const replaceInput = screen.getByPlaceholderText("Replace…");
    act(() => {
      fireEvent.change(replaceInput, { target: { value: "dog" } });
      fireEvent.click(screen.getByRole("button", { name: "Replace all" }));
    });

    expect(capturedEditor!.getHTML()).toBe("<p>dog and dog and dog</p>");
  });
});
