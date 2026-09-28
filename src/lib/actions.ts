import { Effect, EffectState, getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ipc } from "./ipc";
import { logDebug } from "./debug";
import { TOOL_BY_ID } from "./tools";
import type { Binding, ThemeMode } from "./types";
import { useHub, type ToolId } from "../state/useHub";

export async function hideWindow(): Promise<void> {
  try {
    await getCurrentWindow().hide();
  } catch {
    /* not running inside Tauri */
  }
}

let showGuardUntil = 0;

export function markShown(): void {
  showGuardUntil = Date.now() + 400;
}

export function inShowGuard(): boolean {
  return Date.now() < showGuardUntil;
}

/**
 * Keeps the window looking right after it is shown/hidden:
 * - the WebView2 background is made transparent (otherwise a gray backplate shows at the rounded corners)
 * - optional frosted (acrylic) effect
 */
export async function applyAppearance(): Promise<void> {
  try {
    await getCurrentWebview().setBackgroundColor([0, 0, 0, 0]);
  } catch (error) {
    await logDebug(`setBackgroundColor failed: ${String(error)}`);
  }
  try {
    const window = getCurrentWindow();
    if (useHub.getState().config.frosted) {
      await window.setEffects({
        effects: [Effect.Acrylic],
        state: EffectState.Active,
        radius: 30,
      });
    } else {
      await window.clearEffects();
    }
  } catch (error) {
    await logDebug(`effects failed: ${String(error)}`);
  }
}

export async function toggleWindow(): Promise<void> {
  try {
    const window = getCurrentWindow();
    const visible = await window.isVisible();
    await logDebug(`hotkey fired, visible=${visible}`);
    if (visible) {
      await window.hide();
      await logDebug("window hidden");
    } else {
      markShown();
      await window.show();
      await window.setFocus();
      await applyAppearance();
      await logDebug("window shown + focused");
    }
  } catch (error) {
    await logDebug(`toggle failed: ${String(error)}`);
  }
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
}

export async function launchBinding(binding: Binding, options?: { close?: boolean }): Promise<void> {
  const hub = useHub.getState();
  const close = options?.close !== false;

  try {
    if (binding.kind === "tool") {
      const tool = TOOL_BY_ID[binding.target];
      if (!tool) {
        hub.pushToast(`未知工具：${binding.target}`, "error");
        return;
      }
      if (tool.kind === "native") {
        await ipc.runAction(binding.target);
        if (close) await hideWindow();
      } else {
        hub.patch({ view: "tool", tool: binding.target as ToolId, editMode: false, contextMenu: null });
      }
      return;
    }

    await ipc.launch(binding.kind, binding.target, binding.args ?? []);
    if (close) {
      hub.patch({ flash: binding.name });
      await new Promise((resolve) => setTimeout(resolve, 240));
      await hideWindow();
      hub.patch({ flash: null });
    }
  } catch (error) {
    hub.pushToast(String(error), "error");
  }
}

export function resetToGrid(): void {
  useHub.getState().patch({
    view: "grid",
    tool: null,
    query: "",
    editMode: false,
    contextMenu: null,
    picker: null,
  });
}
