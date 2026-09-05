import { useEffect, useRef, useState } from "react";
import { useEditorContext, useEditorSelector } from "@rte/react";
import { Icon } from "../Icon/Icon";
import type { ToolbarDropdownConfig } from "./types";

/**
 * A custom icon-driven menu rather than a native `<select>` — a `<select>`
 * can only ever show plain text, which reads as a bare OS control sitting
 * inside an otherwise icon-only toolbar. This renders a `ToolbarButton`-style
 * trigger (the active option's icon, optionally its label, and a chevron)
 * that opens a floating menu of icon+label rows.
 *
 * Closing behavior deliberately mirrors `LinkButton`/`ImageButton`'s
 * popovers (Escape, or toggling the trigger again) plus one addition: a
 * blur handler on the whole control closes it once focus leaves both the
 * trigger and the menu, which is the cheapest reasonably-correct stand-in
 * for "click outside to close" without a global document listener.
 */
export function ToolbarDropdown({ config }: { config: ToolbarDropdownConfig }): JSX.Element {
  const editor = useEditorContext();
  const activeIndex = useEditorSelector(editor, (e) =>
    config.options.findIndex((option) => e.commands.isActive(e, option.command, ...(option.args ?? [])) === true)
  );
  const enabled = useEditorSelector(
    editor,
    (e) => config.options.some((option) => e.commands.canExecute(e, option.command, ...(option.args ?? [])))
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Deliberately keyed on `open` alone: refocusing on every `activeIndex`
  // change while already open would fight the user's own arrow-key
  // navigation through the menu.
  useEffect(() => {
    if (open) itemRefs.current[Math.max(activeIndex, 0)]?.focus();
  }, [open]);

  const activeOption = activeIndex >= 0 ? config.options[activeIndex] : undefined;
  const triggerIcon = activeOption?.icon ?? config.icon ?? config.options[0]?.icon;

  function choose(index: number): void {
    const option = config.options[index];
    if (option) editor.commands.execute(editor, option.command, ...(option.args ?? []));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveFocus(from: number, delta: number): void {
    const count = config.options.length;
    itemRefs.current[(from + delta + count) % count]?.focus();
  }

  function closeAndRefocus(): void {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={containerRef}
      className="rte-toolbar-dropdown"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="rte-toolbar-dropdown-trigger"
        aria-label={config.label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={activeOption?.label ?? config.label}
        disabled={!enabled}
        data-active={activeIndex >= 0 ? "true" : "false"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {triggerIcon && <Icon name={triggerIcon} />}
        {config.showLabel && <span className="rte-toolbar-dropdown-label">{activeOption?.label ?? config.placeholder}</span>}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div
          className="rte-toolbar-dropdown-menu"
          role="menu"
          aria-label={config.label}
          onMouseDown={(event) => event.preventDefault()}
        >
          {config.options.map((option, index) => (
            <button
              key={`${option.command}-${JSON.stringify(option.args ?? [])}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={index === activeIndex}
              className="rte-toolbar-dropdown-item"
              data-active={index === activeIndex ? "true" : "false"}
              onClick={() => choose(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveFocus(index, 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveFocus(index, -1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  closeAndRefocus();
                }
              }}
            >
              {option.icon && <Icon name={option.icon} size={15} />}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
