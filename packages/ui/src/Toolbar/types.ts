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
}

export interface ToolbarDropdownConfig {
  type: "dropdown";
  label: string;
  /** Shown as the dropdown's own value when no option is currently active
   * (e.g. the cursor is in a block none of the options apply to). */
  placeholder: string;
  options: ToolbarDropdownOption[];
}

export type ToolbarItem = ToolbarButtonConfig | ToolbarSeparatorConfig | ToolbarDropdownConfig;
