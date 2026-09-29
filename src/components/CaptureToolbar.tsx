import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { COLORS, WIDTHS, type Tool } from "../lib/annotate";
import {
  ArrowIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  CropIcon,
  EllipseIcon,
  GearIcon,
  GripIcon,
  HighlightIcon,
  LineIcon,
  MosaicIcon,
  MoveIcon,
  NumberIcon,
  PenIcon,
  PinIcon,
  RectIcon,
  RedoIcon,
  SaveIcon,
  TextIcon,
  UndoIcon,
} from "./icons";

export type UiTool = "move" | "crop" | Tool;

const TOOL_BUTTONS: { id: UiTool; label: string; icon: typeof ArrowIcon }[] = [
  { id: "move", label: "移动选区", icon: MoveIcon },
  { id: "highlight", label: "高亮", icon: HighlightIcon },
  { id: "number", label: "序号", icon: NumberIcon },
  { id: "crop", label: "裁剪", icon: CropIcon },
  { id: "arrow", label: "箭头", icon: ArrowIcon },
  { id: "text", label: "文字", icon: TextIcon },
  { id: "pen", label: "画笔", icon: PenIcon },
  { id: "mosaic", label: "马赛克", icon: MosaicIcon },
  { id: "rect", label: "矩形", icon: RectIcon },
  { id: "ellipse", label: "椭圆", icon: EllipseIcon },
  { id: "line", label: "直线", icon: LineIcon },
];

interface CaptureToolbarProps {
  tool: UiTool;
  onTool: (tool: UiTool) => void;
  color: string;
  onColor: (color: string) => void;
  width: number;
  onWidth: (width: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onSave: () => void;
  onPin: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onMoveStart: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function CaptureToolbar(props: CaptureToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);

  const toolButton = (item: (typeof TOOL_BUTTONS)[number]) => {
    const Glyph = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        className="cap-tb-btn"
        data-active={props.tool === item.id}
        title={item.label}
        onClick={() => props.onTool(item.id)}
      >
        <Glyph />
      </button>
    );
  };

  return (
    <div
      className="cap-toolbar"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
    >
      <span
        className="cap-tb-grip"
        title="拖动工具条"
        onPointerDown={props.onMoveStart}
      >
        <GripIcon />
      </span>

      {TOOL_BUTTONS.slice(0, 4).map(toolButton)}
      <span className="cap-tb-sep" />
      {TOOL_BUTTONS.slice(4).map(toolButton)}

      <div className="cap-tb-settings">
        <button
          type="button"
          className="cap-tb-btn"
          data-active={showSettings}
          title="颜色与粗细"
          onClick={() => setShowSettings((value) => !value)}
        >
          <GearIcon />
        </button>
        {showSettings && (
          <div className="cap-popover" onPointerDown={(event) => event.stopPropagation()}>
            <div className="cap-pop-row">
              {COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="cap-swatch"
                  data-active={props.color === value}
                  style={{ background: value }}
                  title={value}
                  onClick={() => props.onColor(value)}
                />
              ))}
            </div>
            <div className="cap-pop-row">
              {WIDTHS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="cap-width"
                  data-active={props.width === value}
                  onClick={() => props.onWidth(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="cap-tb-sep" />
      <button
        type="button"
        className="cap-tb-btn"
        title="撤销"
        disabled={!props.canUndo}
        onClick={props.onUndo}
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className="cap-tb-btn"
        title="重做"
        disabled={!props.canRedo}
        onClick={props.onRedo}
      >
        <RedoIcon />
      </button>

      <span className="cap-tb-sep" />
      <button type="button" className="cap-tb-btn" title="取消" onClick={props.onCancel}>
        <CloseIcon />
      </button>
      <button type="button" className="cap-tb-btn" title="钉图" onClick={props.onPin} disabled={props.busy}>
        <PinIcon />
      </button>
      <button
        type="button"
        className="cap-tb-btn"
        title="复制到剪贴板"
        onClick={props.onCopy}
        disabled={props.busy}
      >
        <CopyIcon />
      </button>
      <button type="button" className="cap-tb-btn" title="保存图片" onClick={props.onSave} disabled={props.busy}>
        <SaveIcon />
      </button>
      <button
        type="button"
        className="cap-tb-btn cap-tb-primary"
        title="完成（复制并关闭）"
        onClick={props.onConfirm}
        disabled={props.busy}
      >
        <CheckIcon />
      </button>
    </div>
  );
}
