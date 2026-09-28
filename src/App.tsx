import { useEffect } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";
import { ContextMenu } from "./components/ContextMenu";
import { ItemPicker } from "./components/ItemPicker";
import { KeyGrid } from "./components/KeyGrid";
import { SearchView } from "./components/SearchView";
import { SettingsView } from "./components/SettingsView";
import { Toasts } from "./components/Toasts";
import { TopBar } from "./components/TopBar";
import { AnnotationTool } from "./components/tools/AnnotationTool";
import { CalendarTool } from "./components/tools/CalendarTool";
import { ClipboardTool } from "./components/tools/ClipboardTool";
import { DraftTool } from "./components/tools/DraftTool";
import { ImageConvertTool } from "./components/tools/ImageConvertTool";
import { MarkdownTool } from "./components/tools/MarkdownTool";
import {
  applyAppearance,
  applyTheme,
  hideWindow,
  inShowGuard,
  launchBinding,
  markShown,
  resolveTheme,
} from "./lib/actions";
import {
  DEFAULT_CONFIG,
  loadAppsCache,
  loadConfig,
  loadWindowState,
  saveAppsCache,
  saveConfig,
  saveWindowState,
} from "./lib/config";
import { logDebug } from "./lib/debug";
import { ipc } from "./lib/ipc";
import { applyShortcuts } from "./lib/shortcuts";
import { useHub } from "./state/useHub";

function PageDots() {
  const mode = useHub((state) => state.mode);
  const pages = useHub((state) => state.config.pages);
  const page = useHub((state) => state.page[mode]);
  const setPage = useHub((state) => state.setPage);
  if (pages <= 1) return null;
  return (
    <div className="hh-dots">
      {Array.from({ length: pages }).map((_, index) => (
        <i
          key={index}
          data-active={index === page}
          style={{ cursor: "pointer" }}
          onClick={() => setPage(mode, index)}
        />
      ))}
    </div>
  );
}

function Footer() {
  const view = useHub((state) => state.view);
  const editMode = useHub((state) => state.editMode);
  const platform = useHub((state) => state.platform);
  const modifier = platform?.modifier ?? "Alt";

  if (view === "grid" && editMode) {
    return (
      <footer className="hh-footer">
        <span className="hh-hint">拖拽排序 · 点击空位添加 · 右键更多</span>
        <div className="hh-spacer" />
        <PageDots />
        <div className="hh-spacer" />
        <span className="hh-hint">
          <kbd>完成</kbd> 保存
        </span>
      </footer>
    );
  }
  if (view === "grid") {
    return (
      <footer className="hh-footer">
        <span className="hh-hint">
          <kbd>{modifier}</kbd> + 键位启动
        </span>
        <span className="hh-hint">
          <kbd>Space</kbd> 搜索
        </span>
        <div className="hh-spacer" />
        <PageDots />
        <div className="hh-spacer" />
        <span className="hh-hint">
          <kbd>PgUp/PgDn</kbd> 翻页
        </span>
        <span className="hh-hint">
          <kbd>Tab</kbd> 主题
        </span>
        <span className="hh-hint">
          <kbd>Esc</kbd> 隐藏
        </span>
      </footer>
    );
  }
  if (view === "search") {
    return (
      <footer className="hh-footer">
        <span className="hh-hint">输入即搜 · 支持拼音首字母</span>
        <div className="hh-spacer" />
        <span className="hh-hint">
          <kbd>↩</kbd> 打开首选
        </span>
        <span className="hh-hint">
          <kbd>1-8</kbd> 直达
        </span>
        <span className="hh-hint">
          <kbd>Esc</kbd> 返回
        </span>
      </footer>
    );
  }
  return (
    <footer className="hh-footer">
      <span className="hh-hint">h-hub</span>
      <div className="hh-spacer" />
      <span className="hh-hint">
        <kbd>Esc</kbd> 返回
      </span>
    </footer>
  );
}

export default function App() {
  const ready = useHub((state) => state.ready);
  const view = useHub((state) => state.view);
  const mode = useHub((state) => state.mode);
  const editMode = useHub((state) => state.editMode);
  const tool = useHub((state) => state.tool);
  const config = useHub((state) => state.config);
  const flash = useHub((state) => state.flash);
  const patch = useHub((state) => state.patch);
  const setConfig = useHub((state) => state.setConfig);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const platform = await ipc.platformInfo().catch(() => null);
      const stored = await loadConfig();
      if (cancelled) return;

      let cfg = stored;
      if (
        platform &&
        stored.toggleShortcut === DEFAULT_CONFIG.toggleShortcut &&
        stored.modifier === DEFAULT_CONFIG.modifier
      ) {
        cfg = {
          ...stored,
          toggleShortcut: platform.defaultShortcut,
          modifier: platform.modifier,
        };
        void saveConfig(cfg);
      }

      patch({ platform, config: cfg, ready: true });
      applyTheme(cfg.theme);
      void applyAppearance();

      try {
        if (!localStorage.getItem("hhub-onboarded")) {
          localStorage.setItem("hhub-onboarded", "1");
          const window = getCurrentWindow();
          markShown();
          await window.show();
          await window.setFocus();
          await applyAppearance();
        }
      } catch {
        /* ignore */
      }

      const cached = await loadAppsCache();
      if (cached.length) patch({ apps: cached });
      patch({ scanning: true });

      try {
        const scanned = await ipc.scanApps();
        if (cancelled) return;
        patch({ apps: scanned, scanning: false });
        void saveAppsCache(scanned);

        for (let index = 0; index < scanned.length; index += 8) {
          if (cancelled) return;
          const slice = scanned.slice(index, index + 8);
          const icons = await Promise.all(
            slice.map((app) => ipc.extractIcon(app.target).catch(() => null)),
          );
          if (cancelled) return;
          const resolved = new Map<string, string>();
          slice.forEach((app, position) => {
            const icon = icons[position];
            if (icon) resolved.set(app.id, icon);
          });
          patch({
            apps: useHub
              .getState()
              .apps.map((app) => (resolved.has(app.id) ? { ...app, icon: resolved.get(app.id)! } : app)),
          });
        }
        void saveAppsCache(useHub.getState().apps);
      } catch {
        patch({ scanning: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patch]);

  useEffect(() => {
    applyTheme(config.theme);
  }, [config.theme]);

  useEffect(() => {
    if (config.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [config.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--panel-alpha", String(config.opacity));
  }, [config.opacity]);

  useEffect(() => {
    if (!ready) return;
    void applyShortcuts(config);
  }, [
    ready,
    config,
    config.toggleShortcut,
    config.directMode,
    config.modifier,
    config.bindings,
  ]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const window = getCurrentWindow();
        unlisten = await window.onFocusChanged(({ payload: focused }) => {
          const state = useHub.getState();
          void logDebug(`focus changed: ${focused}`);
          if (focused) {
            state.patch({ contextMenu: null });
            void applyAppearance();
            return;
          }
          if (inShowGuard()) {
            void logDebug("blur ignored (show guard)");
            return;
          }
          if (
            state.config.hideOnBlur &&
            state.view === "grid" &&
            !state.editMode &&
            !state.picker
          ) {
            void logDebug("hide on blur");
            void hideWindow();
          }
        });
      } catch {
        /* ignore */
      }
    })();
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (view !== "grid") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editMode) patch({ editMode: false, contextMenu: null });
        else void hideWindow();
        return;
      }
      if (editMode) return;
      if (event.key === " ") {
        event.preventDefault();
        patch({ view: "search", query: "" });
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        setConfig((current) => ({
          ...current,
          theme: resolveTheme(current.theme) === "dark" ? "light" : "dark",
        }));
        return;
      }
      if (event.key === "PageDown" || event.key === "PageUp") {
        event.preventDefault();
        const state = useHub.getState();
        const delta = event.key === "PageDown" ? 1 : -1;
        state.setPage(state.mode, state.page[state.mode] + delta);
        return;
      }
      if (event.code.startsWith("Key") || event.code.startsWith("Digit")) {
        const state = useHub.getState();
        const binding = state.config.bindings[state.mode][state.page[state.mode]]?.[event.code];
        if (binding) {
          event.preventDefault();
          void launchBinding(binding);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, editMode, patch, setConfig]);

  useEffect(() => {
    void applyAppearance();
  }, [config.frosted]);

  useEffect(() => {
    let unlistenMoved: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;
    (async () => {
      try {
        const appWindow = getCurrentWindow();
        const saved = await loadWindowState();
        if (saved) await appWindow.setPosition(new PhysicalPosition(saved.x, saved.y));
        unlistenMoved = await appWindow.onMoved(({ payload }) => {
          void saveWindowState({ x: payload.x, y: payload.y });
        });
      } catch {
        /* ignore */
      }
      try {
        unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type !== "drop") return;
          const { paths, position } = event.payload;
          if (paths.length === 0) return;
          const ratio = window.devicePixelRatio || 1;
          const element = document.elementFromPoint(
            position.x / ratio,
            position.y / ratio,
          ) as HTMLElement | null;
          const slot = element?.closest("[data-slot]") as HTMLElement | null;
          const code = slot?.dataset.slot;
          if (!code) return;
          const path = paths[0];
          const name = path.split(/[\\/]/).pop() ?? path;
          const hub = useHub.getState();
          hub.setBinding(hub.mode, code, { kind: "file", name, target: path });
          hub.pushToast(`已绑定：${name}`);
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      unlistenMoved?.();
      unlistenDrop?.();
    };
  }, []);

  useEffect(() => {
    let unlistenTheme: (() => void) | undefined;
    let unlistenAutostart: (() => void) | undefined;
    (async () => {
      try {
        unlistenTheme = await listen("hhub://toggle-theme", () => {
          useHub.getState().setConfig((current) => ({
            ...current,
            theme: resolveTheme(current.theme) === "dark" ? "light" : "dark",
          }));
        });
        unlistenAutostart = await listen("hhub://toggle-autostart", async () => {
          const hub = useHub.getState();
          try {
            if (await autostartEnabled()) {
              await disableAutostart();
              hub.pushToast("已关闭开机自启");
            } else {
              await enableAutostart();
              hub.pushToast("已开启开机自启");
            }
          } catch (error) {
            hub.pushToast(String(error), "error");
          }
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      unlistenTheme?.();
      unlistenAutostart?.();
    };
  }, []);

  return (
    <div className="hh-root">
      <div className="hh-panel" data-mode={mode}>
        <div className="hh-glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <TopBar />
        <div className="hh-body">
          {view === "grid" && <KeyGrid />}
          {view === "search" && <SearchView />}
          {view === "settings" && <SettingsView />}
          {view === "tool" && tool === "annotate" && <AnnotationTool />}
          {view === "tool" && tool === "clipboard" && <ClipboardTool />}
          {view === "tool" && tool === "calendar" && <CalendarTool />}
          {view === "tool" && tool === "imageConvert" && <ImageConvertTool />}
          {view === "tool" && tool === "markdown" && <MarkdownTool />}
          {view === "tool" && tool === "draft" && <DraftTool />}
        </div>
        <Footer />
      </div>
      <ContextMenu />
      <ItemPicker />
      <Toasts />
      {flash && <div className="hh-launch-flash" />}
    </div>
  );
}
