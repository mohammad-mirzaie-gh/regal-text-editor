import { useCommand, useEditorContext } from "@rte/react";
import { formatShortcutForDisplay } from "@rte/browser";
import { Icon } from "../Icon/Icon";
import type { ToolbarButtonConfig } from "./types";

export function ToolbarButton({ config }: { config: ToolbarButtonConfig }): JSX.Element {
  const editor = useEditorContext();
  const { active, enabled, execute } = useCommand(editor, config.command, ...(config.args ?? []));
  const title = config.shortcut ? `${config.label} (${formatShortcutForDisplay(config.shortcut)})` : config.label;

  return (
    <button
      type="button"
      className="rte-toolbar-button"
      aria-label={config.label}
      aria-pressed={active === true}
      title={title}
      disabled={!enabled}
      data-active={active === true ? "true" : active === "mixed" ? "mixed" : "false"}
      // Prevent the button from stealing focus/collapsing the editor's
      // selection before the click handler runs (section 66).
      onMouseDown={(event) => event.preventDefault()}
      onClick={execute}
    >
      <Icon name={config.icon} />
    </button>
  );
}
