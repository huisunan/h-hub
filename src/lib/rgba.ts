/** Frames a canvas as `[width u32 LE][height u32 LE][rgba]` for raw IPC. */
export function rgbaBody(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法读取画布");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const out = new Uint8Array(8 + width * height * 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, width, true);
  view.setUint32(4, height, true);
  out.set(data, 8);
  return out;
}

/** Frames a canvas as `[path_len u32 LE][path utf8][width][height][rgba]`. */
export function rgbaBodyWithPath(canvas: HTMLCanvasElement, path: string): Uint8Array {
  const pathBytes = new TextEncoder().encode(path);
  const rgba = rgbaBody(canvas);
  const out = new Uint8Array(4 + pathBytes.length + rgba.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, pathBytes.length, true);
  out.set(pathBytes, 4);
  out.set(rgba, 4 + pathBytes.length);
  return out;
}
