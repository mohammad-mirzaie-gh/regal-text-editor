export interface ToolbarButtonConfig {
  type: "button";
  command: string;
  args?: unknown[];
  icon: string;
  label: string;
  shortcut?: string;
}

export interface ToolbarSeparatorConfig {
  type: "separator";
}

export interface ToolbarDropdownOption {
  command: string;
  args?: unknown[];
  label: string;
  /** Icon name (from `Icon`'s registry) shown next to this option in the menu,
   * and on the trigger button while this option is the active one. */
  icon?: string;
}

export interface ToolbarDropdownConfig {
  type: "dropdown";
  label: string;
  /** Shown as the dropdown's own value when no option is currently active
   * (e.g. the cursor is in a block none of the options apply to). */
  placeholder: string;
  /** Icon shown on the trigger when no option is active. Falls back to the
   * first option's icon if omitted. */
  icon?: string;
  /** Show the active option's label text next to its icon on the trigger
   * button. Off by default, so the trigger reads as a compact icon button
   * matching the rest of the toolbar (e.g. text alignment); turn it on for
   * a dropdown whose options aren't visually distinct enough at a glance
   * (e.g. block style / heading level). */
  showLabel?: boolean;
  options: ToolbarDropdownOption[];
}

export type ToolbarItem = ToolbarButtonConfig | ToolbarSeparatorConfig | ToolbarDropdownConfig;
