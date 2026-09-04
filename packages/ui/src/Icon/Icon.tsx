/**
 * A tiny, dependency-free icon abstraction (section 100): every toolbar
 * icon is a name looked up here rather than inline SVG markup repeated at
 * every call site. Paths are intentionally simple 24x24 stroke icons —
 * swap this registry (or pass a custom `render` per item) for a different
 * icon set without touching any consuming component.
 */
const PATHS: Record<string, string> = {
  bold: "M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z",
  italic: "M10 4h8M6 20h8M14 4L10 20",
  underline: "M6 4v7a6 6 0 0 0 12 0V4M4 20h16",
  strikethrough: "M5 12h14M8 6.5c0-1.5 1.8-2.5 4-2.5s4 1 4 2.5-1.5 2-4 2.5M8 17.5c0 1.5 1.8 2.5 4 2.5s4-1 4-2.5-1.5-2-4-2.5",
  code: "M9 6l-6 6 6 6M15 6l6 6-6 6",
  heading1: "M4 4v16M12 4v16M4 12h8M17 9l3-2v9",
  heading2: "M4 4v16M12 4v16M4 12h8M16 8a3 3 0 0 1 6 0c0 2-2.5 3-4 5.5-.5.8-1 1.7-1 2.5h5",
  heading3: "M4 4v16M12 4v16M4 12h8M16.5 8a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5",
  paragraph: "M9 4h9M12 4v16M9 4a4 4 0 0 0 0 8h1V4",
  quote: "M7 7h4v4c0 3-2 5-4 5v-2c1 0 2-1 2-3H7zM15 7h4v4c0 3-2 5-4 5v-2c1 0 2-1 2-3h-2z",
  bulletList: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  orderedList: "M10 6h11M10 12h11M10 18h11M4 4h1v4M4 10h2l-2 2h2M4 16h2v1.5a1.5 1.5 0 0 1-1.5 1.5H4",
  taskList: "M9 6h12M9 12h12M9 18h12M4 5l1.5 1.5L8 4M4 11l1.5 1.5L8 10M4 17l1.5 1.5L8 16",
  undo: "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1",
  redo: "M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1",
  link: "M9 15l6-6M8 12L5.5 14.5a3 3 0 0 0 4 4.5L12 16M16 12l2.5-2.5a3 3 0 0 0-4-4.5L12 8",
  horizontalRule: "M4 12h16",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M6 15l6-6 6 6",
  image: "M4 5h16v14H4zM4 16l5-5 3 3 4-4 4 4M9 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3",
  codeBlock: "M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12",
  alignStart: "M4 6h16M4 12h10M4 18h14",
  alignCenter: "M4 6h16M7 12h10M5 18h14",
  alignEnd: "M4 6h16M10 12h10M6 18h14",
  alignJustify: "M4 6h16M4 12h16M4 18h16",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35",
  close: "M6 6l12 12M18 6L6 18",
  trash: "M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"
};

export interface IconProps {
  name: keyof typeof PATHS | string;
  size?: number;
}

export function Icon({ name, size = 16 }: IconProps): JSX.Element | null {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

export const availableIconNames = Object.keys(PATHS);
