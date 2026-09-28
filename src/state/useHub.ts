import { create } from "zustand";
import { DEFAULT_CONFIG, saveConfig } from "../lib/config";
import type { AppEntry, Binding, HubConfig, Mode, PlatformInfo } from "../lib/types";

export type View = "grid" | "search" | "settings" | "tool";
export type ToolId = "clipboard" | "calendar" | "imageConvert" | "markdown" | "draft" | null;

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
  pushToast: (text: string, kind?: "info" | "error") => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;

export const useHub = create<HubState>()((set) => ({
  ready: false,
  platform: null,
  config: DEFAULT_CONFIG,
  apps: [],
  scanning: false,
  mode: "app",
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
      const nextBindings = {
        app: { ...state.config.bindings.app },
        action: { ...state.config.bindings.action },
      };
      if (binding) nextBindings[mode][slot] = binding;
      else delete nextBindings[mode][slot];
      const config = { ...state.config, bindings: nextBindings };
      void saveConfig(config);
      return { config };
    }),

  swapBindings: (mode, a, b) =>
    set((state) => {
      const map = { ...state.config.bindings[mode] };
      const from = map[a];
      const to = map[b];
      if (to) map[a] = to;
      else delete map[a];
      if (from) map[b] = from;
      else delete map[b];
      const config = {
        ...state.config,
        bindings: { ...state.config.bindings, [mode]: map },
      };
      void saveConfig(config);
      return { config };
    }),

  clearBindings: (mode) =>
    set((state) => {
      const config = {
        ...state.config,
        bindings: { ...state.config.bindings, [mode]: {} },
      };
      void saveConfig(config);
      return { config };
    }),

  applyLayout: (mode, layout) =>
    set((state) => {
      const config = {
        ...state.config,
        bindings: { ...state.config.bindings, [mode]: { ...layout } },
      };
      void saveConfig(config);
      return { config };
    }),

  pushToast: (text, kind = "info") =>
    set((state) => ({
      toasts: [...state.toasts, { id: ++toastSeq, text, kind }],
    })),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
