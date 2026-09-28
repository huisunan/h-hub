import { tempDir, join } from "@tauri-apps/api/path";
import { ipc } from "./ipc";
import { useHub } from "../state/useHub";

export async function logDebug(message: string): Promise<void> {
  if (!useHub.getState().config.diagnostics) return;
  try {
    const dir = await tempDir();
    const path = await join(dir, "hhub-shortcut.log");
    let previous = "";
    try {
      previous = await ipc.readText(path);
    } catch {
      previous = "";
    }
    const merged = `${previous}${new Date().toISOString()} ${message}\n`;
    await ipc.writeText(path, merged.length > 8000 ? merged.slice(-8000) : merged);
  } catch {
    /* ignore */
  }
}
