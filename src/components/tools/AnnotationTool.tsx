import { useCallback, useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { ipc } from "../../lib/ipc";
import { useHub } from "../../state/useHub";

type Tool = "arrow" | "line" | "rect" | "ellipse" | "pen" | "highlight" | "mosaic" | "text";

interface Annotation {
  tool: Tool;
  color: string;
  width: number;
  points: [number, number][];
  text?: string;
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: "arrow", label: "箭头" },
  { id: "rect", label: "矩形" },
  { id: "ellipse", label: "椭圆" },
  { id: "line", label: "直线" },
  { id: "pen", label: "画笔" },
  { id: "highlight", label: "高亮" },
  { id: "mosaic", label: "马赛克" },
  { id: "text", label: "文字" },
];

const COLORS = ["#ff4d4f", "#ffb020", "#22b07d", "#3b82f6", "#8b5cf6", "#14161a", "#ffffff"];
const WIDTHS = [2, 4, 7];

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  ann: Annotation,
): void {
  const [start, end] = [ann.points[0], ann.points[ann.points.length - 1]];
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.lineWidth = ann.width;

  switch (ann.tool) {
    case "arrow": {
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
      const size = 10 + ann.width * 2;
      ctx.beginPath();
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(end[0] - size * Math.cos(angle - Math.PI / 7), end[1] - size * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(end[0] - size * Math.cos(angle + Math.PI / 7), end[1] - size * Math.sin(angle + Math.PI / 7));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "line": {
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      break;
    }
    case "rect": {
      ctx.strokeRect(start[0], start[1], end[0] - start[0], end[1] - start[1]);
      break;
    }
    case "ellipse": {
      const cx = (start[0] + end[0]) / 2;
      const cy = (start[1] + end[1]) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(end[0] - start[0]) / 2, Math.abs(end[1] - start[1]) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "pen":
    case "highlight": {
      ctx.globalAlpha = ann.tool === "highlight" ? 0.35 : 1;
      ctx.lineWidth = ann.tool === "highlight" ? ann.width * 3 : ann.width;
      ctx.beginPath();
      ann.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point[0], point[1]);
        else ctx.lineTo(point[0], point[1]);
      });
      ctx.stroke();
      break;
    }
    case "mosaic": {
      const x = Math.min(start[0], end[0]);
      const y = Math.min(start[1], end[1]);
      const w = Math.abs(end[0] - start[0]);
      const h = Math.abs(end[1] - start[1]);
      if (w < 2 || h < 2) break;
      const block = 10;
      const tw = Math.max(1, Math.floor(w / block));
      const th = Math.max(1, Math.floor(h / block));
      const off = document.createElement("canvas");
      off.width = tw;
      off.height = th;
      const octx = off.getContext("2d");
      if (octx) {
        octx.drawImage(base, x, y, w, h, 0, 0, tw, th);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, x, y, w, h);
      }
      break;
    }
    case "text": {
      ctx.font = `${12 + ann.width * 5}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(ann.text ?? "", start[0], start[1]);
      break;
    }
  }
  ctx.restore();
}

export function AnnotationTool() {
  const pushToast = useHub((state) => state.pushToast);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLImageElement | null>(null);
  const [baseReady, setBaseReady] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    for (const ann of annotations) drawAnnotation(ctx, base, ann);
    if (draft) drawAnnotation(ctx, base, draft);
  }, [annotations, draft]);

  useEffect(() => {
    redraw();
  }, [redraw, baseReady]);

  const loadDataUrl = (dataUrl: string) => {
    const image = new Image();
    image.onload = () => {
      baseRef.current = image;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
      }
      setAnnotations([]);
      setDraft(null);
      setBaseReady(true);
    };
    image.src = dataUrl;
  };

  const openFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }],
      });
      if (typeof selected !== "string") return;
      const dataUrl = await ipc.readImage(selected);
      if (!dataUrl) {
        pushToast("无法读取图片", "error");
        return;
      }
      loadDataUrl(dataUrl);
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  const pasteImage = async () => {
    try {
      const image = await readImage();
      const size = await image.size();
      const rgba = await image.rgba();
      const temp = document.createElement("canvas");
      temp.width = size.width;
      temp.height = size.height;
      const ctx = temp.getContext("2d");
      if (!ctx) return;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), size.width, size.height), 0, 0);
      loadDataUrl(temp.toDataURL("image/png"));
    } catch (error) {
      pushToast(`剪贴板没有图片：${String(error)}`, "error");
    }
  };

  const saveImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !baseRef.current) {
      pushToast("请先打开图片", "error");
      return;
    }
    try {
      const selected = await save({
        defaultPath: "annotated.png",
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (typeof selected !== "string") return;
      await ipc.saveImageDataUrl(selected, canvas.toDataURL("image/png"));
      pushToast("已保存");
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  const point = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return [(event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy];
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!baseRef.current) return;
    const p = point(event);
    if (tool === "text") {
      const text = window.prompt("输入文字");
      if (text) setAnnotations((prev) => [...prev, { tool, color, width, points: [p], text }]);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ tool, color, width, points: [p, p] });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draft) return;
    const p = point(event);
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.tool === "pen" || prev.tool === "highlight") {
        return { ...prev, points: [...prev.points, p] };
      }
      return { ...prev, points: [prev.points[0], p] };
    });
  };

  const onPointerUp = () => {
    if (!draft) return;
    const [start, end] = [draft.points[0], draft.points[draft.points.length - 1]];
    const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (distance > 3) setAnnotations((prev) => [...prev, draft]);
    setDraft(null);
  };

  return (
    <div className="hh-tool">
      <div className="hh-tool-head">
        <span className="hh-tool-title">标注</span>
        <div className="hh-segmented">
          {TOOLS.map((item) => (
            <button key={item.id} data-active={tool === item.id} onClick={() => setTool(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="hh-annot-colors">
          {COLORS.map((value) => (
            <button
              key={value}
              data-active={color === value}
              style={{ background: value }}
              onClick={() => setColor(value)}
              aria-label={value}
            />
          ))}
        </div>
        <div className="hh-segmented">
          {WIDTHS.map((value) => (
            <button key={value} data-active={width === value} onClick={() => setWidth(value)}>
              {value}
            </button>
          ))}
        </div>
        <div className="hh-spacer" />
        <button className="hh-btn" onClick={() => void openFile()}>
          打开
        </button>
        <button className="hh-btn" onClick={() => void pasteImage()}>
          粘贴
        </button>
        <button className="hh-btn" onClick={() => setAnnotations((prev) => prev.slice(0, -1))}>
          撤销
        </button>
        <button className="hh-btn" onClick={() => setAnnotations([])}>
          清空
        </button>
        <button className="hh-btn" data-variant="primary" onClick={() => void saveImage()}>
          保存
        </button>
      </div>
      <div className="hh-tool-body hh-annot-body">
        {!baseReady && (
          <div className="hh-empty">
            <span className="hh-empty-ico">🖊️</span>
            打开图片或从剪贴板粘贴后开始标注
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="hh-annot-canvas"
          hidden={!baseReady}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>
    </div>
  );
}
