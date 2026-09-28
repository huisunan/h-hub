import { useEffect } from "react";
import { launchBinding } from "../lib/actions";
import { useHub, type PickerKind } from "../state/useHub";

const KINDS: { kind: PickerKind; label: string; icon: string }[] = [
  { kind: "app", label: "应用", icon: "▣" },
  { kind: "file", label: "文件", icon: "🗎" },
  { kind: "folder", label: "文件夹", icon: "🗀" },
  { kind: "url", label: "网页", icon: "🌐" },
  { kind: "tool", label: "h-hub 工具", icon: "✦" },
  { kind: "shell", label: "Shell 脚本", icon: "⌘" },
];

export function ContextMenu() {
  const menu = useHub((state) => state.contextMenu);
  const mode = useHub((state) => state.mode);
  const page = useHub((state) => state.page);
  const config = useHub((state) => state.config);
  const patch = useHub((state) => state.patch);
  const setBinding = useHub((state) => state.setBinding);

  useEffect(() => {
    if (!menu) return;
    const close = () => patch({ contextMenu: null });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, patch]);

  if (!menu) return null;

  const binding = config.bindings[mode][page[mode]]?.[menu.slot];
  const left = Math.min(menu.x, window.innerWidth - 210);
  const top = Math.min(menu.y, window.innerHeight - 300);

  return (
    <div
      className="hh-menu"
      style={{ left, top }}
      onClick={(event) => event.stopPropagation()}
    >
      {binding && (
        <>
          <button
            onClick={() => {
              void launchBinding(binding);
              patch({ contextMenu: null });
            }}
          >
            <span className="hh-menu-ico">▶</span>打开
          </button>
          <button
            onClick={() => {
              setBinding(mode, menu.slot, null);
              patch({ contextMenu: null });
            }}
          >
            <span className="hh-menu-ico">🗑</span>删除绑定
          </button>
          <hr />
        </>
      )}
      {KINDS.map((item) => (
        <button
          key={item.kind}
          onClick={() =>
            patch({ picker: { mode, slot: menu.slot, kind: item.kind }, contextMenu: null })
          }
        >
          <span className="hh-menu-ico">{item.icon}</span>
          {binding?.kind === item.kind ? `重新绑定 · ${item.label}` : item.label}
        </button>
      ))}
    </div>
  );
}
