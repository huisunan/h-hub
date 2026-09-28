import { hideWindow } from "../lib/actions";
import { TOOL_BY_ID, RECOMMENDED_ACTION_LAYOUT } from "../lib/tools";
import type { Binding, Mode } from "../lib/types";
import { useHub } from "../state/useHub";

function toolBinding(id: string): Binding {
  const tool = TOOL_BY_ID[id];
  return { kind: "tool", name: tool?.name ?? id, target: id, args: [] };
}

export function TopBar() {
  const mode = useHub((state) => state.mode);
  const view = useHub((state) => state.view);
  const editMode = useHub((state) => state.editMode);
  const patch = useHub((state) => state.patch);
  const clearBindings = useHub((state) => state.clearBindings);
  const applyLayout = useHub((state) => state.applyLayout);

  const switchMode = (next: Mode) => patch({ mode: next, contextMenu: null });

  const recommend = () => {
    if (mode === "action") {
      const layout: Record<string, Binding> = {};
      for (const [slot, id] of Object.entries(RECOMMENDED_ACTION_LAYOUT)) {
        layout[slot] = toolBinding(id);
      }
      applyLayout("action", layout);
    } else {
      patch({ view: "search", query: "" });
    }
  };

  const reset = () => {
    const pageLabel = useHub.getState().page[mode] + 1;
    if (
      window.confirm(
        `确定要清空「${mode === "action" ? "动作" : "应用"}」第 ${pageLabel} 页的所有绑定吗？`,
      )
    ) {
      clearBindings(mode);
    }
  };

  return (
    <header className="hh-topbar" data-tauri-drag-region>
      <div className="hh-brand">
        <span className="hh-brand-mark">◈</span>
        <span>h-hub</span>
      </div>

      <div className="hh-spacer" />

      {view === "grid" && !editMode && (
        <div className="hh-segmented">
          <button data-active={mode === "action"} onClick={() => switchMode("action")}>
            动作
          </button>
          <button data-active={mode === "app"} onClick={() => switchMode("app")}>
            应用
          </button>
        </div>
      )}

      {view === "grid" && editMode && (
        <>
          <span className="hh-banner">
            <b>●</b> 绑定编辑中
          </span>
          <div className="hh-spacer" />
          <button className="hh-btn" data-variant="ghost" onClick={reset}>
            恢复默认
          </button>
          <button className="hh-btn" data-variant="ghost" onClick={recommend}>
            推荐布局
          </button>
          <button className="hh-btn" data-variant="primary" onClick={() => patch({ editMode: false })}>
            完成
          </button>
        </>
      )}

      {view === "grid" && !editMode && (
        <>
          <div className="hh-spacer" />
          <button
            className="hh-iconbtn"
            title="编辑绑定"
            onClick={() => patch({ editMode: true })}
          >
            ✎
          </button>
          <button
            className="hh-iconbtn"
            title="搜索 (Space)"
            onClick={() => patch({ view: "search", query: "" })}
          >
            ⌕
          </button>
          <button
            className="hh-iconbtn"
            title="设置"
            onClick={() => patch({ view: "settings", contextMenu: null })}
          >
            ⚙
          </button>
        </>
      )}

      {view !== "grid" && (
        <>
          <div className="hh-spacer" />
          <button className="hh-btn" data-variant="ghost" onClick={() => patch({ view: "grid", tool: null, query: "" })}>
            ← 返回
          </button>
        </>
      )}

      <button className="hh-iconbtn" data-danger="true" title="隐藏" onClick={() => void hideWindow()}>
        ✕
      </button>
    </header>
  );
}
