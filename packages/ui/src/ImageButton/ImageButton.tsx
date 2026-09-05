import { useEffect, useRef, useState } from "react";
import { useEditorContext, useEditorSelector } from "@regal-text-editor/react";
import { Icon } from "../Icon/Icon";

/**
 * Coupled to `@regal-text-editor/plugin-image`'s `insertImage(src, alt?)` command, for
 * the same reason `LinkButton` is coupled to `@regal-text-editor/plugin-link` — inserting
 * an image needs a URL from the user, which a generic toolbar button can't
 * collect on its own. No upload/file-picker support (see the plugin's own
 * docstring): this only ever inserts a URL the user typed or pasted.
 */
export function ImageButton(): JSX.Element {
  const editor = useEditorContext();
  const enabled = useEditorSelector(editor, (e) => e.commands.canExecute(e, "insertImage"));
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const apply = (): void => {
    if (src.trim().length > 0) {
      editor.commands.execute(editor, "insertImage", src.trim(), alt.trim());
      setSrc("");
      setAlt("");
    }
    setOpen(false);
  };

  return (
    <span className="rte-link-control">
      <button
        type="button"
        className="rte-toolbar-button"
        aria-label="Image"
        title="Image"
        disabled={!enabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <Icon name="image" />
      </button>
      {open && (
        <span className="rte-link-popover" role="dialog" aria-label="Insert image" onMouseDown={(event) => event.preventDefault()}>
          <input
            ref={inputRef}
            className="rte-link-popover-input"
            type="url"
            value={src}
            placeholder="Image URL…"
            onChange={(event) => setSrc(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply();
              if (event.key === "Escape") setOpen(false);
            }}
          />
          <input
            className="rte-link-popover-input"
            type="text"
            value={alt}
            placeholder="Alt text (optional)"
            onChange={(event) => setAlt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply();
              if (event.key === "Escape") setOpen(false);
            }}
          />
          <button type="button" className="rte-link-popover-action" onClick={apply}>
            Insert
          </button>
        </span>
      )}
    </span>
  );
}
