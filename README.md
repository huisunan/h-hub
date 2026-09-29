# h-hub

跨平台键盘启动器。把应用、文件、文件夹、网页、Shell 脚本和内置工具绑定到物理键位，按下即可启动；支持全局热键呼出、拼音首字母搜索、绑定编辑与配置导入导出。

参考「浮引 / FloGravity」与「浮宇宙 fg.vkr.me」的交互，用 Tauri 2 重新实现为 Windows / macOS / Linux 三端工具。

## 技术栈

- **Tauri 2** + **Rust**：窗口、系统能力、应用扫描与启动
- **React 19 + TypeScript + Vite**，使用 **Bun** 作为包管理与构建
- 官方插件：`global-shortcut`、`store`、`clipboard-manager`、`dialog`、`autostart`、`single-instance`、`shell`、`opener`
- 毛玻璃：`windowEffects`（Windows Acrylic / macOS HUD）

## 功能

- **键位网格**：数字行 + QWERTY + ASDF + ZXCV，共 36 个键位；「动作 / 应用」双模式。
- **直达模式**：`修饰键 + 键位` 全局直接启动（可在设置中开关）。
- **搜索**：`Space` 进入，支持中文名 / 全拼 / 拼音首字母，`Enter` 打开首选，`1-8` 直达。
- **绑定编辑**：点击空位绑定、拖拽排序、右键菜单、推荐布局、清空。
- **条目类型**：应用 / 文件 / 文件夹 / 网页 / Shell 脚本 / 内置工具。
- **内置工具**：截图（原生抓屏 + 全屏选区 + 内联标注工具条，支持复制 / 保存 / 钉图）、剪贴板、日历、改图、Markdown、草稿、回到桌面、锁屏。
- **外观**：浅色 / 深色 / 跟随系统，面板不透明度与图标尺寸可调；`Tab` 快捷键切换主题。
- **配置**：`.hhubconfig` 导出 / 导入。

## 开发

```bash
bun install
bun run tauri dev
```

## 构建

```bash
bun run tauri build
```

## 目录结构

```
src/                     # React 前端
  components/            # TopBar / KeyGrid / SearchView / SettingsView / ItemPicker / tools
  lib/                   # ipc / slots / tools / search / config / shortcuts / actions
  state/                 # zustand store
  styles/                # 设计 token 与样式
src-tauri/               # Rust 后端
  src/commands.rs        # invoke 命令
  src/platform/          # windows / macos / linux 适配
  src/model.rs
```

## 平台说明

- **Windows**：扫描开始菜单 `.lnk` / `.url`，应用图标由 Shell 提取。
- **macOS**：扫描 `/Applications` 等目录，`.icns` 经 `sips` 转 PNG。
- **Linux**：解析 `.desktop` 文件，解析 hicolor / pixmaps 图标。

> 启动脚本与部分系统动作会调用本机命令，请仅绑定可信内容。
