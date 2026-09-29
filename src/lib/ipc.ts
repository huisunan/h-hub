import { invoke } from "@tauri-apps/api/core";
import type { AppEntry, FileItem, PlatformInfo } from "./types";

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  readImage: (path: string) => invoke<string | null>("read_image", { path }),
  clipboardWriteImage: (body: Uint8Array) => invoke<void>("clipboard_write_image", body),
  saveRgbaPng: (body: Uint8Array) => invoke<void>("save_rgba_png", body),
  startCapture: () => invoke<void>("start_capture"),
  captureFrameBytes: () => invoke<ArrayBuffer>("capture_frame_bytes"),
  captureWindows: () => invoke<WindowRect[]>("capture_windows"),
  revealCapture: () => invoke<void>("reveal_capture"),
  disposeCapture: () => invoke<void>("dispose_capture"),
  pinImageRgba: (body: Uint8Array) => invoke<void>("pin_image_rgba", body),
  takePinImage: (label: string) => invoke<string | null>("take_pin_image", { label }),
};
