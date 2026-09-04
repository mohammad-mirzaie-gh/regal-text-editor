import { useEffect, useState } from "react";
import type { Editor } from "@rte/core";
import { useEditorSelector } from "@rte/react";

/**
 * The viewport-relative bounding rect of the current *non-collapsed*
 * selection, or `null` when there is none — for positioning a bubble
 * toolbar or popover next to it. Recomputes whenever the model selection
 * changes; it deliberately does not also track scroll/resize (a real
 * bubble toolbar would want to reposition on those too), a known
 * simplification rather than adding a second event-listener lifecycle for
 * a UI nicety.
 */
export function useSelectionRect(editor: Editor): DOMRect | null {
  const selection = useEditorSelector(editor, (e) => e.getSelection());
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selection || selection.type !== "range") {
      setRect(null);
      return;
    }
    const domSelection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!domSelection || domSelection.rangeCount === 0 || domSelection.isCollapsed) {
      setRect(null);
      return;
    }
    const domRect = domSelection.getRangeAt(0).getBoundingClientRect();
    setRect(domRect.width === 0 && domRect.height === 0 ? null : domRect);
  }, [selection]);

  return rect;
}
