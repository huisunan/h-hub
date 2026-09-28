export type BindingKind = "app" | "file" | "folder" | "url" | "shell" | "tool";

export interface Binding {
  kind: BindingKind;
  name: string;
  target: string;
  args?: string[];
  icon?: string;
}

export type SlotMap = Record<string, Binding>;
export type Mode = "app" | "action";
export type ThemeMode = "light" | "dark" | "system";

export interface HubConfig {
  version: number;
  toggleShortcut: string;
  modifier: string;
  theme: ThemeMode;
  directMode: boolean;
  hideOnBlur: boolean;
  opacity: number;
  iconSize: number;
  pages: number;
  frosted: boolean;
  diagnostics: boolean;
  bindings: { app: SlotMap[]; action: SlotMap[] };
}

export interface AppEntry {
  id: string;
  name: string;
  target: string;
  icon?: string | null;
  source: string;
  args: string[];
}

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
}

export interface PlatformInfo {
  os: string;
  defaultShortcut: string;
  modifier: string;
}
