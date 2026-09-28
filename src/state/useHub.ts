import { create } from "zustand";
import { DEFAULT_CONFIG, saveConfig } from "../lib/config";
import type { AppEntry, Binding, HubConfig, Mode, PlatformInfo, SlotMap } from "../lib/types";

export type View = "grid" | "search" | "settings" | "tool";
export type ToolId = "clipboard" | "calendar" | "imageConvert" | "markdown" | "draft" | "annotate" | null;

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

interface ContextMenuState {
  x: number;
  y: number;
  slot: string;
}

export type PickerKind = "app" | "file" | "folder" | "url" | "tool" | "shell";

interface PickerState {
  mode: Mode;
  slot: string;
  kind?: PickerKind;
}

interface HubState {
  ready: boolean;
  platform: PlatformInfo | null;
  config: HubConfig;
  apps: AppEntry[];
  scanning: boolean;
  mode: Mode;
  page: { app: number; action: number };
  view: View;
  editMode: boolean;
  tool: ToolId;
  query: string;
  focusIndex: number;
  toasts: Toast[];
  flash: string | null;
  contextMenu: ContextMenuState | null;
  picker: PickerState | null;
  shortcutError: string | null;

  patch: (partial: Partial<HubState>) => void;
  setConfig: (updater: (config: HubConfig) => HubConfig) => void;
  setBinding: (mode: Mode, slot: string, binding: Binding | null) => void;
  swapBindings: (mode: Mode, a: string, b: string) => void;
  clearBindings: (mode: Mode) => void;
  applyLayout: (mode: Mode, layout: Record<string, Binding>) => void;
  setPage: (mode: Mode, index: number) => void;
  pushToast: (text: string, kind?: "info" | "error") => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;

function replacePage(
  config: HubConfig,
  mode: Mode,
  index: number,
  map: SlotMap,
): HubConfig {
  const pages = [...config.bindings[mode]];
  pages[index] = map;
  return { ...config, bindings: { ...config.bindings, [mode]: pages } };
}

export const useHub = create<HubState>()((set) => ({
  ready: false,
  platform: null,
  config: DEFAULT_CONFIG,
  apps: [],
  scanning: false,
  mode: "app",
  page: { app: 0, action: 0 },
  view: "grid",
  editMode: false,
  tool: null,
  query: "",
  focusIndex: 0,
  toasts: [],
  flash: null,
  contextMenu: null,
  picker: null,
  shortcutError: null,

  patch: (partial) => set(partial),

  setConfig: (updater) =>
    set((state) => {
      const config = updater(state.config);
      void saveConfig(config);
      return { config };
    }),

  setBinding: (mode, slot, binding) =>
    set((state) => {
      const index = state.page[mode];
      const map = { ...(state.config.bindings[mode][index] ?? {}) };
      if (binding) map[slot] = binding;
      else delete map[slot];
      const config = replacePage(state.config, mode, index, map);
      void saveConfig(config);
      return { config };
    }),

  swapBindings: (mode, a, b) =>
    set((state) => {
      const index = state.page[mode];
      const map = { ...(state.config.bindings[mode][index] ?? {}) };
      const from = map[a];
      const to = map[b];
      if (to) map[a] = to;
      else delete map[a];
      if (from) map[b] = from;
      else delete map[b];
      const config = replacePage(state.config, mode, index, map);
      void saveConfig(config);
      return { config };
    }),

  clearBindings: (mode) =>
    set((state) => {
      const index = state.page[mode];
      const config = replacePage(state.config, mode, index, {});
      void saveConfig(config);
      return { config };
    }),

  applyLayout: (mode, layout) =>
    set((state) => {
      const index = state.page[mode];
      const config = replacePage(state.config, mode, index, { ...layout });
      void saveConfig(config);
      return { config };
    }),

  setPage: (mode, index) =>
    set((state) => {
      const clamped = Math.max(0, Math.min(state.config.pages - 1, index));
      return { page: { ...state.page, [mode]: clamped }, contextMenu: null };
    }),

  pushToast: (text, kind = "info") =>
    set((state) => ({
      toasts: [...state.toasts, { id: ++toastSeq, text, kind }],
    })),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function currentBindings(state: {
  config: HubConfig;
  mode: Mode;
  page: { app: number; action: number };
}): SlotMap {
  return state.config.bindings[state.mode][state.page[state.mode]] ?? {};
}
