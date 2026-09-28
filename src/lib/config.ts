import { load, type Store } from "@tauri-apps/plugin-store";
import type { AppEntry, HubConfig, SlotMap } from "./types";

const SETTINGS_FILE = "hhub-settings.json";

export const DEFAULT_CONFIG: HubConfig = {
  version: 1,
  toggleShortcut: "Alt+Space",
  modifier: "Alt",
  theme: "system",
  directMode: false,
  hideOnBlur: true,
  opacity: 1,
  iconSize: 60,
  pages: 4,
  frosted: false,
  diagnostics: false,
  bindings: { app: [{}], action: [{}] },
};

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(SETTINGS_FILE, { autoSave: true });
  }
  return storePromise;
}

function toPages(value: unknown): SlotMap[] {
  if (Array.isArray(value)) {
    const pages = value.map((page) => ({ ...((page as SlotMap) ?? {}) }));
    return pages.length ? pages : [{}];
  }
  if (value && typeof value === "object") {
    return [{ ...(value as SlotMap) }];
  }
  return [{}];
}

function normalizeBindings(raw: unknown): { app: SlotMap[]; action: SlotMap[] } {
  const bindings = (raw ?? {}) as { app?: unknown; action?: unknown };
  return { app: toPages(bindings.app), action: toPages(bindings.action) };
}

export function normalizeConfig(raw: Partial<HubConfig> | null | undefined): HubConfig {
  const pages = Math.max(1, Math.min(6, Number(raw?.pages) || DEFAULT_CONFIG.pages));
  const bindings = normalizeBindings(raw?.bindings);
  const pad = (list: SlotMap[]): SlotMap[] => {
    const out = list.slice(0, pages).map((page) => ({ ...page }));
    while (out.length < pages) out.push({});
    return out;
  };
  return {
    ...DEFAULT_CONFIG,
    ...(raw ?? {}),
    pages,
    bindings: { app: pad(bindings.app), action: pad(bindings.action) },
  };
}

export async function loadConfig(): Promise<HubConfig> {
  try {
    const store = await getStore();
    const raw = await store.get<Partial<HubConfig>>("config");
    return normalizeConfig(raw);
  } catch {
    return normalizeConfig(null);
  }
}

export async function saveConfig(config: HubConfig): Promise<void> {
  try {
    const store = await getStore();
    await store.set("config", config);
    await store.save();
  } catch {
    /* ignore persistence errors */
  }
}

export async function loadAppsCache(): Promise<AppEntry[]> {
  try {
    const store = await getStore();
    return (await store.get<AppEntry[]>("apps")) ?? [];
  } catch {
    return [];
  }
}

export async function saveAppsCache(apps: AppEntry[]): Promise<void> {
  try {
    const store = await getStore();
    await store.set("apps", apps);
    await store.save();
  } catch {
    /* ignore */
  }
}

export interface WindowState {
  x: number;
  y: number;
}

export async function loadWindowState(): Promise<WindowState | null> {
  try {
    const store = await getStore();
    return (await store.get<WindowState>("window")) ?? null;
  } catch {
    return null;
  }
}

export async function saveWindowState(state: WindowState): Promise<void> {
  try {
    const store = await getStore();
    await store.set("window", state);
    await store.save();
  } catch {
    /* ignore */
  }
}
