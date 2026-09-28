import { load, type Store } from "@tauri-apps/plugin-store";
import type { AppEntry, HubConfig } from "./types";

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
  bindings: { app: {}, action: {} },
};

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(SETTINGS_FILE, { autoSave: true });
  }
  return storePromise;
}

function mergeConfig(raw: Partial<HubConfig> | null | undefined): HubConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(raw ?? {}),
    bindings: {
      app: { ...(raw?.bindings?.app ?? {}) },
      action: { ...(raw?.bindings?.action ?? {}) },
    },
  };
}

export async function loadConfig(): Promise<HubConfig> {
  try {
    const store = await getStore();
    const raw = await store.get<Partial<HubConfig>>("config");
    return mergeConfig(raw);
  } catch {
    return mergeConfig(null);
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
