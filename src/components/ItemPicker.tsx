import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { match } from "../lib/search";
import { TOOLS } from "../lib/tools";
import type { Binding } from "../lib/types";
import { firstChar, gradientFor } from "../lib/util";
import { useHub, type PickerKind } from "../state/useHub";

const TABS: { kind: PickerKind; label: string; icon: string }[] = [
  { kind: "app", label: "应用", icon: "▣" },
  { kind: "file", label: "文件", icon: "🗎" },
  { kind: "folder", label: "文件夹", icon: "🗀" },
  { kind: "url", label: "网页", icon: "🌐" },
  { kind: "tool", label: "工具", icon: "✦" },
  { kind: "shell", label: "脚本", icon: "⌘" },
];

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function ItemPicker() {
  const picker = useHub((state) => state.picker);
  const apps = useHub((state) => state.apps);
  const scanning = useHub((state) => state.scanning);
  const setBinding = useHub((state) => state.setBinding);
  const patch = useHub((state) => state.patch);
  const pushToast = useHub((state) => state.pushToast);

  const [kind, setKind] = useState<PickerKind>(picker?.kind ?? "app");
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    const scored = apps
      .map((app) => ({ app, score: match(q, app.name).score }))
      .filter((item) => item.score > 0);
    scored.sort((a, b) => b.score - a.score || a.app.name.localeCompare(b.app.name));
    return scored.slice(0, 100).map((item) => item.app);
  }, [apps, query]);

  if (!picker) return null;

  const close = () => patch({ picker: null });
  const apply = (binding: Binding) => {
    setBinding(picker.mode, picker.slot, binding);
    close();
  };

  const choosePath = async (directory: boolean) => {
    try {
      const selected = await open({ multiple: false, directory });
      if (typeof selected === "string") {
        apply({
          kind: directory ? "folder" : "file",
          name: label.trim() || baseName(selected),
          target: selected,
        });
      }
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  return (
    <div className="hh-scrim" onClick={close}>
      <div className="hh-modal" onClick={(event) => event.stopPropagation()}>
        <div className="hh-modal-head">
          <span>绑定按键</span>
          <span className="hh-tool-sub">{picker.slot.replace("Key", "").replace("Digit", "")} 键</span>
        </div>
        <div className="hh-modal-body">
          <nav className="hh-picker-nav">
            {TABS.map((tab) => (
              <button
                key={tab.kind}
                data-active={kind === tab.kind}
                onClick={() => setKind(tab.kind)}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="hh-picker-main">
            {kind === "app" && (
              <>
                <input
                  className="hh-field-input"
                  style={{ padding: "9px 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-strong)", outline: "none" }}
                  placeholder="搜索应用名称或首字母"
                  value={query}
                  autoFocus
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="hh-picker-list">
                  {filtered.map((app) => (
                    <button
                      key={app.id}
                      className="hh-app-row"
                      onClick={() =>
                        apply({
                          kind: "app",
                          name: app.name,
                          target: app.target,
                          args: app.args,
                          icon: app.icon ?? undefined,
                        })
                      }
                    >
                      {app.icon ? (
                        <img src={app.icon} alt="" />
                      ) : (
                        <span className="hh-fallback" style={{ background: gradientFor(app.name) }}>
                          {firstChar(app.name)}
                        </span>
                      )}
                      <span>{app.name}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="hh-empty">
                      <span className="hh-empty-ico">📦</span>
                      {scanning ? "正在扫描应用…" : "没有匹配的应用"}
                    </div>
                  )}
                </div>
              </>
            )}

            {(kind === "file" || kind === "folder") && (
              <div className="hh-empty">
                <span className="hh-empty-ico">{kind === "file" ? "🗎" : "🗀"}</span>
                <input
                  placeholder="显示名称（可选）"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  style={{ padding: "9px 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-strong)", outline: "none", textAlign: "center" }}
                />
                <button className="hh-btn" data-variant="primary" onClick={() => void choosePath(kind === "folder")}>
                  选择{kind === "file" ? "文件" : "文件夹"}
                </button>
              </div>
            )}

            {kind === "url" && (
              <div className="hh-field" style={{ gap: 12 }}>
                <label className="hh-field">
                  网址
                  <input
                    autoFocus
                    placeholder="https://example.com"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                </label>
                <label className="hh-field">
                  名称（可选）
                  <input value={label} onChange={(event) => setLabel(event.target.value)} />
                </label>
                <button
                  className="hh-btn"
                  data-variant="primary"
                  disabled={!text.trim()}
                  onClick={() =>
                    apply({ kind: "url", name: label.trim() || text.trim(), target: text.trim() })
                  }
                >
                  绑定网页
                </button>
              </div>
            )}

            {kind === "shell" && (
              <div className="hh-field" style={{ gap: 12 }}>
                <label className="hh-field">
                  命令
                  <textarea
                    autoFocus
                    rows={4}
                    placeholder="例如：code . 或 npm run dev"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                </label>
                <label className="hh-field">
                  名称（可选）
                  <input value={label} onChange={(event) => setLabel(event.target.value)} />
                </label>
                <button
                  className="hh-btn"
                  data-variant="primary"
                  disabled={!text.trim()}
                  onClick={() =>
                    apply({ kind: "shell", name: label.trim() || text.trim(), target: text.trim() })
                  }
                >
                  绑定脚本
                </button>
              </div>
            )}

            {kind === "tool" && (
              <div className="hh-tool-body">
                <div className="hh-cards">
                  {TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      className="hh-card"
                      style={{ textAlign: "left", cursor: "pointer" }}
                      onClick={() => apply({ kind: "tool", name: tool.name, target: tool.id })}
                    >
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{tool.emoji}</div>
                      <h4>{tool.name}</h4>
                      <p>{tool.kind === "native" ? "系统操作" : "内置工具"}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="hh-modal-foot">
          <button className="hh-btn" data-variant="ghost" onClick={close}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
