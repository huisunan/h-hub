import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { launchBinding, toggleWindow } from "./actions";
import { ALL_SLOTS, acceleratorFor } from "./slots";
import { logDebug } from "./debug";
import type { HubConfig } from "./types";
import { useHub } from "../state/useHub";

let queue: Promise<void> = Promise.resolve();

async function apply(config: HubConfig): Promise<void> {
  const report: string[] = [];
  try {
    await unregisterAll();
    report.push("unregisterAll ok");
  } catch (error) {
    report.push(`unregisterAll failed: ${String(error)}`);
  }

  try {
    await register(config.toggleShortcut, (event) => {
      if (event.state !== "Pressed") return;
      void toggleWindow();
    });
    report.push(`toggle ok: ${config.toggleShortcut}`);
    useHub.getState().patch({ shortcutError: null });
  } catch (error) {
    report.push(`toggle FAIL: ${config.toggleShortcut} -> ${String(error)}`);
    useHub.getState().patch({ shortcutError: String(error) });
  }

  if (config.directMode) {
    let count = 0;
    for (const slot of ALL_SLOTS) {
      const binding = config.bindings.app[slot.code] ?? config.bindings.action[slot.code];
      if (!binding) continue;
      const accelerator = acceleratorFor(slot.code, config.modifier);
      if (!accelerator) continue;
      try {
        await register(accelerator, (event) => {
          if (event.state !== "Pressed") return;
          const current = useHub.getState();
          void launchBinding(binding, { close: current.view !== "tool" });
        });
        count += 1;
      } catch (error) {
        report.push(`direct FAIL: ${accelerator} -> ${String(error)}`);
      }
    }
    report.push(`direct registered: ${count}`);
  }

  await logDebug(report.join(" | "));
}

export function applyShortcuts(config: HubConfig): Promise<void> {
  queue = queue.then(() => apply(config)).catch(() => undefined);
  return queue;
}
