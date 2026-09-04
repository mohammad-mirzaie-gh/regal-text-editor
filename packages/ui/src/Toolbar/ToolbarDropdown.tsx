import { useEditorContext, useEditorSelector } from "@rte/react";
import type { ToolbarDropdownConfig } from "./types";

/**
 * A native `<select>` rather than a custom menu: it gets full keyboard
 * navigation and screen-reader support for free, with no menu-positioning
 * or focus-trapping code to get right. The one trade-off versus a
 * `ToolbarButton` is that opening a native select necessarily takes focus
 * (the browser won't open one otherwise), so — unlike buttons — this can't
 * `preventDefault` on mousedown to keep the editor's visual selection
 * highlighted while it's open; the underlying model selection is
 * unaffected (losing DOM focus doesn't clear `editor.selection`), so the
 * chosen command still applies to the right place, but the highlight
 * blinks off for the moment the dropdown is open.
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

  return (
    <select
      className="rte-toolbar-dropdown"
      aria-label={config.label}
      value={activeIndex >= 0 ? String(activeIndex) : ""}
      disabled={!enabled}
      onChange={(event) => {
        const option = config.options[Number(event.target.value)];
        if (option) editor.commands.execute(editor, option.command, ...(option.args ?? []));
      }}
    >
      {activeIndex < 0 && (
        <option value="" disabled>
          {config.placeholder}
        </option>
      )}
      {config.options.map((option, index) => (
        <option key={`${option.command}-${JSON.stringify(option.args ?? [])}`} value={index}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
