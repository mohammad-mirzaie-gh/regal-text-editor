import { useEffect, useRef, useState } from "react";
import { useEditorContext, useEditorSelector } from "@rte/react";
import { getActiveLinkHref } from "@rte/plugin-link";
import { Icon } from "../Icon/Icon";

/**
 * Unlike `ToolbarButton`, this is coupled to a specific plugin's command
 * contract — `@rte/plugin-link`'s `setLink(href)` / `unsetLink()` commands
 * and its `getActiveLinkHref` helper — because collecting a URL from the
 * user needs a real input, which a generic `{command, icon, label}`
 * config can't express. It's an opt-in, "batteries included" component,
 * not a replacement for the fully generic `<Toolbar>`; an app using a
 * different link plugin (or none) simply wouldn't render it.
 */
export function LinkButton(): JSX.Element {
  const editor = useEditorContext();
  const active = useEditorSelector(editor, (e) => e.commands.isActive(e, "setLink") === true);
  const enabled = useEditorSelector(editor, (e) => e.commands.canExecute(e, "setLink") || active);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const apply = (): void => {
    if (value.trim().length > 0) editor.commands.execute(editor, "setLink", value.trim());
    setOpen(false);
  };

  const remove = (): void => {
    editor.commands.execute(editor, "unsetLink");
    setOpen(false);
  };

  return (
    <span className="rte-link-control">
      <button
        type="button"
        className="rte-toolbar-button"
        aria-label="Link"
        aria-pressed={active}
        title="Link"
        disabled={!enabled}
        data-active={active ? "true" : "false"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          setValue(getActiveLinkHref(editor) ?? "");
          setOpen(true);
        }}
      >
        <Icon name="link" />
      </button>
      {open && (
        <span className="rte-link-popover" role="dialog" aria-label="Edit link" onMouseDown={(event) => event.preventDefault()}>
          <input
            ref={inputRef}
            className="rte-link-popover-input"
            type="url"
            value={value}
            placeholder="https://…"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply();
              if (event.key === "Escape") setOpen(false);
            }}
          />
          <button type="button" className="rte-link-popover-action" onClick={apply}>
            Apply
          </button>
          {active && (
            <button type="button" className="rte-link-popover-action" onClick={remove}>
              Remove
            </button>
          )}
        </span>
      )}
    </span>
  );
}
