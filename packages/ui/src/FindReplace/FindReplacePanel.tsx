import { useEffect, useMemo, useRef, useState } from "react";
import { cursor, findMatches, replaceAllMatches, replaceMatch, type SearchMatch } from "@regal-text-editor/core";
import { useEditorContext, useEditorSelector } from "@regal-text-editor/react";
import { Icon } from "../Icon/Icon";

export interface FindReplacePanelProps {
  onClose?: () => void;
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/**
 * A find/replace bar: Enter/Shift+Enter (or the Next/Previous buttons)
 * cycle through matches by moving the editor's own selection onto each
 * one, reusing its native highlight — there is no separate "highlight
 * every match at once" decoration layer here (this editor has no
 * decoration system at all yet), so only the *current* match is visibly
 * marked, the same way a browser's own Ctrl+F bar behaves without a page
 * that implements custom highlighting. A documented scope decision, not an
 * oversight.
 */
export function FindReplacePanel({ onClose }: FindReplacePanelProps): JSX.Element {
  const editor = useEditorContext();
  const doc = useEditorSelector(editor, (e) => e.doc);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const queryInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => findMatches(doc, query, { caseSensitive }), [doc, query, caseSensitive]);

  useEffect(() => {
    setMatchIndex(0);
  }, [query, caseSensitive]);

  useEffect(() => {
    if (matches.length === 0) return;
    const match = matches[wrapIndex(matchIndex, matches.length)]!;
    editor.setSelection({ type: "range", anchor: match.start, focus: match.end });
  }, [matches, matchIndex, editor]);

  useEffect(() => {
    queryInputRef.current?.focus();
  }, []);

  const currentMatch = (): SearchMatch | undefined => (matches.length > 0 ? matches[wrapIndex(matchIndex, matches.length)] : undefined);

  const findNext = (): void => setMatchIndex((index) => index + 1);
  const findPrevious = (): void => setMatchIndex((index) => index - 1);

  const replaceCurrent = (): void => {
    const match = currentMatch();
    if (!match) return;
    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    const point = replaceMatch(tx, editor.schema, match, replacement);
    tx.setSelection(cursor(point));
    editor.dispatch(tx);
  };

  const replaceAll = (): void => {
    if (matches.length === 0) return;
    const tx = editor.createTransaction({ origin: "command", historyGroup: "structural" });
    replaceAllMatches(tx, editor.schema, matches, replacement);
    editor.dispatch(tx);
  };

  return (
    <div className="rte-find-replace" role="search" aria-label="Find and replace">
      <div className="rte-find-replace-row">
        <input
          ref={queryInputRef}
          className="rte-find-replace-input"
          type="text"
          value={query}
          placeholder="Find…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (event.shiftKey) findPrevious();
              else findNext();
            }
            if (event.key === "Escape") onClose?.();
          }}
        />
        <span className="rte-find-replace-count">{matches.length > 0 ? `${wrapIndex(matchIndex, matches.length) + 1}/${matches.length}` : "0/0"}</span>
        <button type="button" className="rte-toolbar-button" aria-label="Previous match" disabled={matches.length === 0} onClick={findPrevious}>
          <Icon name="chevronUp" size={14} />
        </button>
        <button type="button" className="rte-toolbar-button" aria-label="Next match" disabled={matches.length === 0} onClick={findNext}>
          <Icon name="chevronDown" size={14} />
        </button>
        <label className="rte-find-replace-check">
          <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
          Aa
        </label>
        {onClose && (
          <button type="button" className="rte-toolbar-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <div className="rte-find-replace-row">
        <input
          className="rte-find-replace-input"
          type="text"
          value={replacement}
          placeholder="Replace…"
          onChange={(event) => setReplacement(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              replaceCurrent();
            }
          }}
        />
        <button type="button" className="rte-find-replace-text-button" disabled={matches.length === 0} onClick={replaceCurrent}>
          Replace
        </button>
        <button type="button" className="rte-find-replace-text-button" disabled={matches.length === 0} onClick={replaceAll}>
          Replace all
        </button>
      </div>
    </div>
  );
}
