import { ToolbarButton } from "./ToolbarButton";
import { ToolbarDropdown } from "./ToolbarDropdown";
import { ToolbarSeparator } from "./ToolbarSeparator";
import type { ToolbarItem } from "./types";

export interface ToolbarProps {
  items: ToolbarItem[];
  label?: string;
  className?: string;
}

/** A configurable toolbar (section 56): pass any list of button/separator/
 * dropdown items — there is nothing hard-coded here about which commands
 * exist. Must render inside a `<RichTextEditor>` (or anywhere under an
 * `EditorContext.Provider`) so its items can reach the ambient editor. */
export function Toolbar({ items, label = "Formatting", className }: ToolbarProps): JSX.Element {
  return (
    <div className={["rte-toolbar", className].filter(Boolean).join(" ")} role="toolbar" aria-label={label}>
      {items.map((item, index) => {
        if (item.type === "separator") return <ToolbarSeparator key={`sep-${index}`} />;
        if (item.type === "dropdown") return <ToolbarDropdown key={`dropdown-${item.label}`} config={item} />;
        return <ToolbarButton key={`${item.command}-${JSON.stringify(item.args ?? [])}`} config={item} />;
      })}
    </div>
  );
}
