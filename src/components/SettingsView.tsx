import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { DEFAULT_CONFIG } from "../lib/config";
import type { HubConfig, ThemeMode } from "../lib/types";
import { download } from "../lib/util";
import { useHub } from "../state/useHub";

type Section = "general" | "shortcut" | "appearance" | "config" | "about";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "general", label: "常规" },
  { id: "shortcut", label: "快捷键" },
  { id: "appearance", label: "外观" },
  { id: "config", label: "配置" },
  { id: "about", label: "关于" },
];

function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return <button className="hh-switch" data-on={on} aria-pressed={on} onClick={onChange} />;
}

function Setting({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div className="hh-setting">
      <div>
        <div className="hh-setting-label">{label}</div>
        {desc && <div className="hh-setting-desc">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function sanitizeImported(parsed: Partial<HubConfig>): HubConfig {
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    bindings: {
      app: { ...(parsed.bindings?.app ?? {}) },
      action: { ...(parsed.bindings?.action ?? {}) },
    },
  };
}

export function SettingsView() {
  const config = useHub((state) => state.config);
  const setConfig = useHub((state) => state.setConfig);
  const patch = useHub((state) => state.patch);
  const pushToast = useHub((state) => state.pushToast);
  const [section, setSection] = useState<Section>("general");
  const [autostart, setAutostart] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isEnabled()
      .then((enabled) => setAutostart(enabled))
      .catch(() => undefined);
  }, []);

  const toggleAutostart = async () => {
    try {
      if (autostart) {
        await disable();
        setAutostart(false);
      } else {
        await enable();
        setAutostart(true);
      }
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  const recordShortcut = (event: ReactKeyboardEvent) => {
    if (!recording) return;
    event.preventDefault();
    const parts: string[] = [];
    if (event.ctrlKey) parts.push("Control");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (event.metaKey) parts.push("Super");
    const key = event.key;
    if (["Control", "Alt", "Shift", "Meta"].includes(key)) return;
    if (key === " ") parts.push("Space");
    else if (key.length === 1) parts.push(key.toUpperCase());
    else parts.push(key);
    if (parts.length < 2) return;
    setConfig((current) => ({ ...current, toggleShortcut: parts.join("+") }));
    setRecording(false);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<HubConfig>;
        if (!parsed || typeof parsed !== "object" || !parsed.bindings) {
          throw new Error("invalid");
        }
        setConfig(() => sanitizeImported(parsed));
        pushToast("已导入配置");
      } catch {
        pushToast("配置格式无效", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="hh-settings">
      <nav className="hh-settings-nav">
        {SECTIONS.map((item) => (
          <button key={item.id} data-active={section === item.id} onClick={() => setSection(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="hh-settings-body">
        {section === "general" && (
          <>
            <Setting label="开机自动启动" desc="随系统启动并常驻托盘">
              <Switch on={autostart} onChange={() => void toggleAutostart()} />
            </Setting>
            <Setting label="失焦自动隐藏" desc="面板失去焦点时自动隐藏">
              <Switch
                on={config.hideOnBlur}
                onChange={() => setConfig((current) => ({ ...current, hideOnBlur: !current.hideOnBlur }))}
              />
            </Setting>
            <Setting label="单实例运行" desc="重复启动时聚焦已有窗口（默认开启）">
              <span className="hh-tool-sub">已启用</span>
            </Setting>
          </>
        )}

        {section === "shortcut" && (
          <>
            <Setting label="唤起面板" desc="点击录制后按下组合键（需包含修饰键）">
              <button
                className="hh-btn"
                data-variant={recording ? "primary" : undefined}
                onClick={() => setRecording(true)}
                onKeyDown={recordShortcut}
                onBlur={() => setRecording(false)}
              >
                {recording ? "请按下组合键…" : config.toggleShortcut}
              </button>
            </Setting>
            <Setting label="直达模式" desc="按 修饰键 + 键位 直接启动，无需打开面板">
              <Switch
                on={config.directMode}
                onChange={() => setConfig((current) => ({ ...current, directMode: !current.directMode }))}
              />
            </Setting>
            <Setting label="修饰键" desc="直达模式使用的修饰键">
              <select
                className="hh-field"
                value={config.modifier}
                onChange={(event) => setConfig((current) => ({ ...current, modifier: event.target.value }))}
                style={{ padding: "8px 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-strong)" }}
              >
                <option value="Alt">Alt / Option</option>
                <option value="Control">Control</option>
                <option value="Shift">Shift</option>
                <option value="Super">Super / Cmd</option>
              </select>
            </Setting>
          </>
        )}

        {section === "appearance" && (
          <>
            <Setting label="主题" desc="浅色 / 深色 / 跟随系统">
              <div className="hh-segmented">
                {(["light", "dark", "system"] as ThemeMode[]).map((theme) => (
                  <button
                    key={theme}
                    data-active={config.theme === theme}
                    onClick={() => setConfig((current) => ({ ...current, theme }))}
                  >
                    {theme === "light" ? "浅色" : theme === "dark" ? "深色" : "跟随系统"}
                  </button>
                ))}
              </div>
            </Setting>
            <Setting label="面板不透明度" desc={`${Math.round(config.opacity * 100)}%`}>
              <input
                type="range"
                min={0.6}
                max={1}
                step={0.02}
                value={config.opacity}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, opacity: Number(event.target.value) }))
                }
              />
            </Setting>
            <Setting label="图标尺寸" desc={`${config.iconSize}px`}>
              <input
                type="range"
                min={44}
                max={84}
                step={4}
                value={config.iconSize}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, iconSize: Number(event.target.value) }))
                }
              />
            </Setting>
          </>
        )}

        {section === "config" && (
          <>
            <Setting label="导出配置" desc="保存为 .hhubconfig 文件">
              <button
                className="hh-btn"
                onClick={() => download("hhub.hhubconfig", JSON.stringify(config, null, 2))}
              >
                导出
              </button>
            </Setting>
            <Setting label="导入配置" desc="从 .hhubconfig 文件恢复">
              <button className="hh-btn" onClick={() => fileRef.current?.click()}>
                导入
              </button>
            </Setting>
            <Setting label="恢复默认" desc="清空所有绑定与偏好设置">
              <button
                className="hh-btn"
                data-variant="danger"
                onClick={() => {
                  if (window.confirm("确定恢复默认设置？此操作不可撤销。")) {
                    setConfig(() => DEFAULT_CONFIG);
                  }
                }}
              >
                恢复默认
              </button>
            </Setting>
            <input ref={fileRef} type="file" accept=".hhubconfig,.json" hidden onChange={handleImport} />
          </>
        )}

        {section === "about" && (
          <>
            <Setting label="h-hub" desc="跨平台键盘启动器 · v0.1.0">
              <button className="hh-btn" data-variant="ghost" onClick={() => patch({ view: "grid" })}>
                关闭设置
              </button>
            </Setting>
            <Setting label="运行平台" desc={useHub.getState().platform?.os ?? "unknown"}>
              <span className="hh-tool-sub">{useHub.getState().platform?.modifier ?? "Alt"}</span>
            </Setting>
            <Setting label="内核" desc="Tauri 2 + Rust + React">
              <span className="hh-tool-sub">Rust / WebView</span>
            </Setting>
          </>
        )}
      </div>
    </div>
  );
}
