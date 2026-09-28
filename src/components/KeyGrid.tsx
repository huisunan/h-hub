import { useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { launchBinding } from "../lib/actions";
import { KEY_ROWS } from "../lib/slots";
import { TOOL_BY_ID } from "../lib/tools";
import type { Binding } from "../lib/types";
import { firstChar, gradientFor } from "../lib/util";
import { useHub } from "../state/useHub";

interface SlotProps {
  label: string;
  binding?: Binding;
  editMode: boolean;
  size: number;
  dragging: boolean;
  dropping: boolean;
  onLaunch: () => void;
  onRemove: () => void;
  onContext: (event: MouseEvent) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function Slot({
  label,
  binding,
  editMode,
  size,
  dragging,
  dropping,
  onLaunch,
  onRemove,
  onContext,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: SlotProps) {
  const tool = binding?.kind === "tool" ? TOOL_BY_ID[binding.target] : undefined;

  let content: React.ReactNode;
  let tileStyle: CSSProperties | undefined;
  if (!binding) {
    content = <span className="hh-letter">{label}</span>;
  } else if (tool) {
    content = <span>{tool.emoji}</span>;
    tileStyle = { background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)` };
  } else if (binding.icon) {
    content = <img src={binding.icon} alt="" />;
  } else {
    content = (
      <span style={{ color: "#fff", fontWeight: 700, fontSize: size * 0.38 }}>
        {firstChar(binding.name)}
      </span>
    );
    tileStyle = { background: gradientFor(binding.name), borderColor: "transparent" };
  }

  return (
    <div
      className="hh-slot"
      data-empty={!binding}
      data-drag={dragging}
      data-drop={dropping}
      style={{ "--slot-size": `${size}px` } as CSSProperties}
      draggable={editMode && Boolean(binding)}
      role="button"
      tabIndex={0}
      onClick={onLaunch}
      onContextMenu={onContext}
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(event: DragEvent) => {
        event.preventDefault();
        onDragEnter();
      }}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
    >
      {editMode && binding && (
        <button
          className="hh-slot-remove"
          title="移除"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          −
        </button>
      )}
      <div className="hh-slot-tile" data-tool={Boolean(tool)} style={tileStyle}>
        {content}
        {binding && <span className="hh-key">{label}</span>}
      </div>
      <span className="hh-slot-name">{binding?.name ?? ""}</span>
    </div>
  );
}

export function KeyGrid() {
  const mode = useHub((state) => state.mode);
  const config = useHub((state) => state.config);
  const editMode = useHub((state) => state.editMode);
  const patch = useHub((state) => state.patch);
  const setBinding = useHub((state) => state.setBinding);
  const swapBindings = useHub((state) => state.swapBindings);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const bindings = config.bindings[mode];

  const openPicker = (slot: string) => patch({ picker: { mode, slot } });

  return (
    <div className="hh-grid-scroll">
      {KEY_ROWS.map((row, index) => (
        <div className="hh-keyrow" key={index}>
          {row.map((slot) => {
            const binding = bindings[slot.code];
            return (
              <Slot
                key={slot.code}
                label={slot.label}
                binding={binding}
                editMode={editMode}
                size={config.iconSize}
                dragging={drag === slot.code}
                dropping={over === slot.code && drag !== null && drag !== slot.code}
                onLaunch={() => {
                  if (editMode) openPicker(slot.code);
                  else if (binding) void launchBinding(binding);
                }}
                onRemove={() => setBinding(mode, slot.code, null)}
                onContext={(event) => {
                  event.preventDefault();
                  patch({ contextMenu: { x: event.clientX, y: event.clientY, slot: slot.code } });
                }}
                onDragStart={() => setDrag(slot.code)}
                onDragEnter={() => setOver(slot.code)}
                onDrop={() => {
                  if (drag && drag !== slot.code) swapBindings(mode, drag, slot.code);
                  setDrag(null);
                  setOver(null);
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setOver(null);
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
