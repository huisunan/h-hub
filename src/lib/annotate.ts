export type Tool =
  | "arrow"
  | "line"
  | "rect"
  | "ellipse"
  | "pen"
  | "highlight"
  | "mosaic"
  | "text"
  | "number";

export interface Annotation {
  tool: Tool;
  color: string;
  width: number;
  points: [number, number][];
  text?: string;
}

export const COLORS = ["#ff4d4f", "#ffb020", "#22b07d", "#3b82f6", "#8b5cf6", "#14161a", "#ffffff"];
export const WIDTHS = [2, 4, 7];

/**
 * Draws one annotation. Points are stored in the base image's pixel space.
 * `offsetX/offsetY` shift the output (e.g. when rendering a cropped region),
 * while mosaic still samples the untouched `base` at absolute coordinates.
 */
export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  ann: Annotation,
  offsetX = 0,
  offsetY = 0,
): void {
  const shift = (point: [number, number]): [number, number] => [point[0] - offsetX, point[1] - offsetY];
  const [startAbs, endAbs] = [ann.points[0], ann.points[ann.points.length - 1]];
  const start = shift(startAbs);
  const end = shift(endAbs);

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
        const [x, y] = shift(point);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      break;
    }
    case "mosaic": {
      const x = Math.min(startAbs[0], endAbs[0]);
      const y = Math.min(startAbs[1], endAbs[1]);
      const w = Math.abs(endAbs[0] - startAbs[0]);
      const h = Math.abs(endAbs[1] - startAbs[1]);
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
        ctx.drawImage(off, x - offsetX, y - offsetY, w, h);
      }
      break;
    }
    case "text": {
      ctx.font = `600 ${12 + ann.width * 5}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(ann.text ?? "", start[0], start[1]);
      break;
    }
    case "number": {
      const radius = 11 + ann.width * 2;
      ctx.beginPath();
      ctx.arc(start[0], start[1], radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${radius * 1.25}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ann.text ?? "", start[0], start[1] + 0.5);
      break;
    }
  }
  ctx.restore();
}
