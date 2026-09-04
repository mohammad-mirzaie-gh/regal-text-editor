import { useEditorContext } from "@rte/react";
import { Toolbar } from "../Toolbar/Toolbar";
import type { ToolbarItem } from "../Toolbar/types";
import { useSelectionRect } from "../hooks/useSelectionRect";

export interface BubbleToolbarProps {
  items: ToolbarItem[];
  label?: string;
}

/** A small formatting toolbar that appears above the current selection
 * (Medium/Notion-style) instead of sitting fixed above the editor. Renders
 * nothing while the selection is collapsed or empty. Must render inside a
 * `<RichTextEditor>` (or under an `EditorContext.Provider`), same as
 * `<Toolbar>` — it renders one internally. */
export function BubbleToolbar({ items, label = "Selection formatting" }: BubbleToolbarProps): JSX.Element | null {
  const editor = useEditorContext();
  const rect = useSelectionRect(editor);
  if (!rect) return null;

  return (
    <div
      className="rte-bubble-toolbar"
      style={{ position: "fixed", top: rect.top, left: rect.left + rect.width / 2 }}
      // Keep the editor's DOM selection (and focus) intact while the user
      // interacts with the bubble — same reasoning as ToolbarButton's own
      // mousedown guard, applied to the wrapper so it also covers clicks
      // that land between buttons.
      onMouseDown={(event) => event.preventDefault()}
    >
      <Toolbar items={items} label={label} />
    </div>
  );
}
