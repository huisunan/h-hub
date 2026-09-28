import { invoke } from "@tauri-apps/api/core";
import type { AppEntry, FileItem, PlatformInfo } from "./types";

export const ipc = {
  platformInfo: () => invoke<PlatformInfo>("platform_info"),
  scanApps: () => invoke<AppEntry[]>("scan_apps"),
  launch: (kind: string, target: string, args: string[] = []) =>
    invoke<void>("launch", { kind, target, args }),
  extractIcon: (path: string) => invoke<string | null>("extract_icon", { path }),
  runAction: (id: string) => invoke<void>("run_action", { id }),
  listDir: (path: string) => invoke<FileItem[]>("list_dir", { path }),
  readText: (path: string) => invoke<string>("read_text_file", { path }),
  writeText: (path: string, content: string) =>
    invoke<void>("write_text_file", { path, content }),
  convertImages: (
    inputs: string[],
    outDir: string,
    format: string,
    quality?: number,
  ) => invoke<string[]>("convert_images", { inputs, outDir, format, quality }),
};
