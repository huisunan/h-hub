import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { ipc, type WindowRect } from "../lib/ipc";
import { rgbaBody, rgbaBodyWithPath } from "../lib/rgba";
import { drawAnnotation, type Annotation, type Tool } from "../lib/annotate";
import { CaptureToolbar, type UiTool } from "./CaptureToolbar";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Snapshot {
  crop: Rect;
  annotations: Annotation[];
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type Mode = "idle" | "select" | "move" | "resize" | "draw" | "crop";

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const TOOLBAR_H = 46;

function normalize(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function clampRect(rect: Rect, maxWidth: number, maxHeight: number): Rect {
  const x = Math.max(0, Math.min(rect.x, maxWidth));
  const y = Math.max(0, Math.min(rect.y, maxHeight));
  const width = Math.max(0, Math.min(rect.width, maxWidth - x));
  const height = Math.max(0, Math.min(rect.height, maxHeight - y));
  return { x, y, width, height };
}

function resizeRect(origin: Rect, handle: Handle, dx: number, dy: number): Rect {
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.width;
  let bottom = origin.y + origin.height;
  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;
  return {
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    width: Math.abs(right - left),
    height: Math.abs(bottom - top),
  };
}

function inRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function CaptureOverlay() {
  const imgRef = useRef<HTMLImageElement>(null);
  const annotRef = useRef<HTMLCanvasElement>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const modeRef = useRef<Mode>("idle");
  const handleRef = useRef<Handle>("se");
  const baseCropRef = useRef<Rect | null>(null);
  const cropStartRef = useRef<[number, number] | null>(null);
  const pendingWindowRef = useRef<Rect | null>(null);

  const [frame, setFrame] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [cropDraft, setCropDraft] = useState<Rect | null>(null);
  const [hover, setHover] = useState<Rect | null>(null);
  const [windows, setWindows] = useState<WindowRect[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [tool, setTool] = useState<UiTool>("move");
  const [color, setColor] = useState("#ff4d4f");
  const [width, setWidth] = useState(4);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [toolbarOffset, setToolbarOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const scale = useCallback(() => {
    const img = imgRef.current;
    const iw = img?.naturalWidth || window.innerWidth;
    const ih = img?.naturalHeight || window.innerHeight;
    return { x: iw / window.innerWidth, y: ih / window.innerHeight };
  }, []);

  const frameWidth = imgRef.current?.naturalWidth || window.innerWidth;
  const frameHeight = imgRef.current?.naturalHeight || window.innerHeight;

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  }, []);

  const revealWindow = useCallback(async () => {
    try {
      await ipc.revealCapture();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let objectUrl: string | null = null;
    ipc
      .captureFrameBytes()
      .then((bytes) => {
        if (!bytes || bytes.byteLength === 0) {
          setError("无法获取截图，请检查屏幕录制权限");
          void revealWindow();
          return;
        }
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
        setFrame(objectUrl);
      })
      .catch((reason) => {
        setError(String(reason));
        void revealWindow();
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [revealWindow]);

  useEffect(() => {
    ipc
      .captureWindows()
      .then((list) => setWindows(list))
      .catch(() => undefined);
  }, []);

  const windowAt = useCallback(
    (x: number, y: number): Rect | null => {
      for (const window of windows) {
        if (x >= window.x && x <= window.x + window.width && y >= window.y && y <= window.y + window.height) {
          return { x: window.x, y: window.y, width: window.width, height: window.height };
        }
      }
      return null;
    },
    [windows],
  );

  // The frozen frame is drawn once by the `<img>`; this overlay only holds the
  // annotations at the image's native resolution and is never moved or resampled.
  const redraw = useCallback(() => {
    const canvas = annotRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const w = Math.max(1, img.naturalWidth || 1);
    const h = Math.max(1, img.naturalHeight || 1);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    for (const annotation of annotations) drawAnnotation(ctx, img, annotation, 0, 0);
    if (draft) drawAnnotation(ctx, img, draft, 0, 0);
  }, [annotations, draft]);

  useEffect(() => {
    redraw();
  }, [redraw, frameReady]);

  const pushUndo = useCallback((snapshot: Snapshot) => {
    setUndoStack((prev) => [...prev, snapshot]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !crop) return;
    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack([...redoStack, { crop, annotations }]);
    setCrop(snapshot.crop);
    setAnnotations(snapshot.annotations);
  }, [undoStack, redoStack, crop, annotations]);

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !crop) return;
    const snapshot = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack([...undoStack, { crop, annotations }]);
    setCrop(snapshot.crop);
    setAnnotations(snapshot.annotations);
  }, [undoStack, redoStack, crop, annotations]);

  const selectFull = useCallback(() => {
    if (!imgRef.current) return;
    setCrop({
      x: 0,
      y: 0,
      width: imgRef.current.naturalWidth,
      height: imgRef.current.naturalHeight,
    });
    setTool("move");
  }, []);

  const cancel = useCallback(() => {
    void ipc.disposeCapture().catch(() => undefined);
  }, []);

  const csrfPoint = (event: React.MouseEvent): { x: number; y: number } => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !frame || error) return;
    const point = csrfPoint(event);
    const target = event.target as HTMLElement;
    const handle = target.dataset.handle as Handle | undefined;
    event.currentTarget.setPointerCapture(event.pointerId);
    originRef.current = point;

    if (handle) {
      modeRef.current = "resize";
      handleRef.current = handle;
      baseCropRef.current = crop;
      return;
    }

    const { x: sx, y: sy } = scale();
    const ix = point.x * sx;
    const iy = point.y * sy;

    if (!crop) {
      modeRef.current = "select";
      pendingWindowRef.current = hover;
      setHover(null);
      setCrop({ x: ix, y: iy, width: 0, height: 0 });
      return;
    }

    if (!inRect(crop, ix, iy)) {
      modeRef.current = "select";
      baseCropRef.current = null;
      setCrop({ x: ix, y: iy, width: 0, height: 0 });
      return;
    }

    if (tool === "move") {
      modeRef.current = "move";
      baseCropRef.current = crop;
      return;
    }

    if (tool === "crop") {
      modeRef.current = "crop";
      cropStartRef.current = [ix, iy];
      setCropDraft({ x: ix, y: iy, width: 0, height: 0 });
      return;
    }

    if (tool === "text") {
      const text = window.prompt("输入文字");
      if (text) pushUndo({ crop, annotations });
      if (text) setAnnotations((prev) => [...prev, { tool, color, width, points: [[ix, iy]], text }]);
      return;
    }

    if (tool === "number") {
      pushUndo({ crop, annotations });
      setAnnotations((prev) => [
        ...prev,
        {
          tool,
          color,
          width,
          points: [[ix, iy]],
          text: String(prev.filter((item) => item.tool === "number").length + 1),
        },
      ]);
      return;
    }

    modeRef.current = "draw";
    setDraft({ tool: tool as Tool, color, width, points: [[ix, iy], [ix, iy]] });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = originRef.current;
    const mode = modeRef.current;
    if (!origin || mode === "idle") {
      if (!crop && frameReady && !error) {
        const point = csrfPoint(event);
        const { x: sx, y: sy } = scale();
        setHover(windowAt(point.x * sx, point.y * sy));
      } else if (hover) {
        setHover(null);
      }
      return;
    }
    const point = csrfPoint(event);
    const { x: sx, y: sy } = scale();

    if (mode === "select") {
      setCrop(
        clampRect(
          normalize(
            { x: origin.x * sx, y: origin.y * sy },
            { x: point.x * sx, y: point.y * sy },
          ),
          frameWidth,
          frameHeight,
        ),
      );
      return;
    }
    if (mode === "resize" && baseCropRef.current) {
      setCrop(
        clampRect(
          resizeRect(baseCropRef.current, handleRef.current, (point.x - origin.x) * sx, (point.y - origin.y) * sy),
          frameWidth,
          frameHeight,
        ),
      );
      return;
    }
    if (mode === "move" && baseCropRef.current) {
      const base = baseCropRef.current;
      setCrop(
        clampRect(
          { ...base, x: base.x + (point.x - origin.x) * sx, y: base.y + (point.y - origin.y) * sy },
          frameWidth,
          frameHeight,
        ),
      );
      return;
    }
    if (mode === "crop" && cropStartRef.current) {
      setCropDraft(
        normalize(
          { x: cropStartRef.current[0], y: cropStartRef.current[1] },
          { x: point.x * sx, y: point.y * sy },
        ),
      );
      return;
    }
    if (mode === "draw") {
      const ix = point.x * sx;
      const iy = point.y * sy;
      setDraft((prev) => {
        if (!prev) return prev;
        if (prev.tool === "pen" || prev.tool === "highlight") {
          return { ...prev, points: [...prev.points, [ix, iy]] };
        }
        return { ...prev, points: [prev.points[0], [ix, iy]] };
      });
    }
  };

  const onPointerUp = () => {
    const mode = modeRef.current;
    originRef.current = null;
    modeRef.current = "idle";

    if (mode === "select") {
      const pending = pendingWindowRef.current;
      pendingWindowRef.current = null;
      setCrop((current) => {
        if (current && current.width >= 4 && current.height >= 4) return current;
        return pending;
      });
      return;
    }
    if (mode === "crop") {
      const rect = cropDraft;
      setCropDraft(null);
      cropStartRef.current = null;
      if (rect && rect.width >= 8 && rect.height >= 8) {
        pushUndo({ crop: crop as Rect, annotations });
        setCrop(rect);
        setTool("move");
      }
      return;
    }
    if ((mode === "move" || mode === "resize") && baseCropRef.current && crop) {
      const base = baseCropRef.current;
      if (base.x !== crop.x || base.y !== crop.y || base.width !== crop.width || base.height !== crop.height) {
        pushUndo({ crop: base, annotations });
      }
      baseCropRef.current = null;
      return;
    }
    if (mode === "draw" && draft) {
      const [start, end] = [draft.points[0], draft.points[draft.points.length - 1]];
      if (Math.hypot(end[0] - start[0], end[1] - start[1]) > 3) {
        pushUndo({ crop: crop as Rect, annotations });
        setAnnotations((prev) => [...prev, draft]);
      }
      setDraft(null);
    }
  };

  const onMoveToolbarStart = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, ox: toolbarOffset.x, oy: toolbarOffset.y };
    const onMove = (moveEvent: PointerEvent) => {
      setToolbarOffset({ x: start.ox + (moveEvent.clientX - start.x), y: start.oy + (moveEvent.clientY - start.y) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Composite the selected region + annotations on demand for copy / save / pin.
  const getCompositeCanvas = useCallback((): HTMLCanvasElement | null => {
    const img = imgRef.current;
    if (!img || !crop) return null;
    const w = Math.max(1, Math.round(crop.width));
    const h = Math.max(1, Math.round(crop.height));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
    const annot = annotRef.current;
    if (annot) ctx.drawImage(annot, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
    return canvas;
  }, [crop]);

  const copyToClipboard = useCallback(async () => {
    const canvas = getCompositeCanvas();
    if (!canvas) throw new Error("导出图片失败");
    await ipc.clipboardWriteImage(rgbaBody(canvas));
  }, [getCompositeCanvas]);

  const onCopy = useCallback(async () => {
    if (!getCompositeCanvas()) return;
    setBusy(true);
    try {
      await copyToClipboard();
      showToast("已复制到剪贴板");
    } catch (reason) {
      showToast(String(reason));
    } finally {
      setBusy(false);
    }
  }, [copyToClipboard, getCompositeCanvas, showToast]);

  const onSave = useCallback(async () => {
    const canvas = getCompositeCanvas();
    if (!canvas) return;
    setBusy(true);
    try {
      const selected = await save({
        defaultPath: "screenshot.png",
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (typeof selected !== "string") return;
      await ipc.saveRgbaPng(rgbaBodyWithPath(canvas, selected));
      showToast("已保存");
    } catch (reason) {
      showToast(String(reason));
    } finally {
      setBusy(false);
    }
  }, [getCompositeCanvas, showToast]);

  const onPin = useCallback(async () => {
    const canvas = getCompositeCanvas();
    if (!canvas) return;
    setBusy(true);
    try {
      await ipc.pinImageRgba(rgbaBody(canvas));
      await ipc.disposeCapture().catch(() => undefined);
    } catch (reason) {
      showToast(String(reason));
      setBusy(false);
    }
  }, [getCompositeCanvas, showToast]);

  const onConfirm = useCallback(async () => {
    if (!getCompositeCanvas()) return;
    setBusy(true);
    try {
      await copyToClipboard();
    } catch (reason) {
      showToast(String(reason));
      setBusy(false);
      return;
    }
    await ipc.disposeCapture().catch(() => undefined);
  }, [copyToClipboard, getCompositeCanvas, showToast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (crop) void onConfirm();
        else selectFull();
      } else if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectFull();
      } else if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && event.key.toLowerCase() === "c") {
        if (crop) {
          event.preventDefault();
          void onCopy();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel, crop, onConfirm, selectFull, undo, redo, onCopy]);

  const cropCss = useMemo(() => {
    if (!crop) return null;
    const { x: sx, y: sy } = scale();
    return { left: crop.x / sx, top: crop.y / sy, width: crop.width / sx, height: crop.height / sy };
  }, [crop, scale, frameReady]);

  const annotStyle = useMemo(() => {
    if (!cropCss) return { display: "none" as const };
    const right = Math.max(0, window.innerWidth - cropCss.left - cropCss.width);
    const bottom = Math.max(0, window.innerHeight - cropCss.top - cropCss.height);
    return {
      clipPath: `inset(${cropCss.top}px ${right}px ${bottom}px ${cropCss.left}px)`,
    };
  }, [cropCss]);

  const dims = useMemo(() => {
    if (!cropCss) return null;
    const iw = window.innerWidth;
    const ih = window.innerHeight;
    const { left, top, width, height } = cropCss;
    return {
      top: { left: 0, top: 0, width: iw, height: Math.max(0, top) },
      bottom: { left: 0, top: top + height, width: iw, height: Math.max(0, ih - top - height) },
      left: { left: 0, top, width: Math.max(0, left), height },
      right: { left: left + width, top, width: Math.max(0, iw - left - width), height },
    } as Record<string, Box>;
  }, [cropCss, frameReady]);

  const toolbarStyle = useMemo(() => {
    if (!cropCss) return null;
    let top = cropCss.top + cropCss.height + 10 + toolbarOffset.y;
    if (top + TOOLBAR_H > window.innerHeight - 8) top = cropCss.top - TOOLBAR_H - 10 + toolbarOffset.y;
    top = Math.max(8, Math.min(top, window.innerHeight - TOOLBAR_H - 8));
    let left = cropCss.left + cropCss.width / 2 + toolbarOffset.x;
    left = Math.max(320, Math.min(left, window.innerWidth - 320));
    return { left, top };
  }, [cropCss, toolbarOffset, frameReady]);

  return (
    <div
      className="cap-root"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest(".cap-toolbar")) return;
        if (crop) {
          const { x: sx, y: sy } = scale();
          const point = csrfPoint(event);
          if (inRect(crop, point.x * sx, point.y * sy)) return;
        }
        selectFull();
      }}
    >
      {frame && (
        <img
          ref={imgRef}
          className="cap-frame"
          src={frame}
          alt=""
          draggable={false}
          onLoad={() => {
            setFrameReady(true);
            const img = imgRef.current;
            if (img && typeof img.decode === "function") {
              img
                .decode()
                .then(() => void revealWindow())
                .catch(() => void revealWindow());
            } else {
              void revealWindow();
            }
          }}
          onError={() => {
            setError("无法加载截图");
            void revealWindow();
          }}
        />
      )}

      {frame && <canvas ref={annotRef} className="cap-annot" style={annotStyle} />}

      {dims ? (
        <>
          <div className="cap-dim" style={dims.top} />
          <div className="cap-dim" style={dims.bottom} />
          <div className="cap-dim" style={dims.left} />
          <div className="cap-dim" style={dims.right} />
        </>
      ) : (
        frame && <div className="cap-dimmer" />
      )}

      {hover && !crop && (
        <div
          className="cap-hover"
          style={(() => {
            const { x: sx, y: sy } = scale();
            return {
              left: hover.x / sx,
              top: hover.y / sy,
              width: hover.width / sx,
              height: hover.height / sy,
            };
          })()}
        />
      )}

      {cropCss && (
        <div className="cap-outline" style={cropCss}>
          {HANDLES.map((handle) => (
            <span key={handle} className={`cap-handle cap-h-${handle}`} data-handle={handle} />
          ))}
          <span className="cap-size">
            {Math.round(crop!.width)} × {Math.round(crop!.height)}
          </span>
        </div>
      )}

      {cropDraft && (
        <div
          className="cap-crop-draft"
          style={(() => {
            const { x: sx, y: sy } = scale();
            return {
              left: cropDraft.x / sx,
              top: cropDraft.y / sy,
              width: cropDraft.width / sx,
              height: cropDraft.height / sy,
            };
          })()}
        />
      )}

      {cropCss && toolbarStyle && (
        <div className="cap-toolbar-anchor" style={toolbarStyle}>
          <CaptureToolbar
            tool={tool}
            onTool={setTool}
            color={color}
            onColor={setColor}
            width={width}
            onWidth={setWidth}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            busy={busy}
            onUndo={undo}
            onRedo={redo}
            onCopy={() => void onCopy()}
            onSave={() => void onSave()}
            onPin={() => void onPin()}
            onConfirm={() => void onConfirm()}
            onCancel={cancel}
            onMoveStart={onMoveToolbarStart}
          />
        </div>
      )}

      {!frame && !error && <div className="cap-status">正在准备截图…</div>}
      {error && <div className="cap-status cap-status-error">{error}</div>}
      {frame && !crop && (
        <div className="cap-hint">拖拽框选 · 点选窗口 · 双击全屏 · Enter 完成 · Esc 取消</div>
      )}
      {toast && <div className="cap-toast">{toast}</div>}
    </div>
  );
}
