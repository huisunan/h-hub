# h-hub 开发计划与 Check List

> 跨平台键盘启动器 · Tauri 2 + React 19 + TypeScript + Vite + Bun
>
> 更新时间：今日已完成壳与主要功能；下方「明日待办」为剩余项。

---

## 0. 状态总览

- [x] `typecheck` / `build` / `cargo check` / `cargo build` 全部通过
- [x] Windows 上 `tauri dev` 可运行：Alt+Space 唤起、键位启动、托盘常驻
- [ ] macOS / Linux 实机验证
- [ ] 打包与发布

---

## 1. 已完成

### 基础框架
- [x] Bun + Tauri 2 + React/TS 脚手架
- [x] 窗口：`transparent` / `decorations:false` / `shadow:false` / `resizable:false` / `alwaysOnTop` / `skipTaskbar`
- [x] 单实例 / 托盘 / 开机自启 / 插件（opener、shell、store、clipboard、dialog、global-shortcut）
- [x] 权限收敛（capabilities）

### 核心启动器
- [x] 36 键位网格 + 多页（页点、PgUp/PgDn 翻页、`pages` 可配置 1–6）
- [x] 「动作 / 应用」双模式
- [x] 全局热键唤起（可录制修改）、只响应 `Pressed`、直达模式
- [x] 失焦隐藏 + 唤起 400ms 宽限期
- [x] 搜索（中文/全拼/首字母、`Enter` 首选、`1-8` 直达、跨全部页）
- [x] 绑定编辑（点击绑定、拖拽排序、右键菜单、推荐布局、清空当前页）
- [x] 拖拽文件到键位直接绑定
- [x] 配置持久化 + `.hhubconfig` 导入/导出（含旧格式迁移）
- [x] 窗口位置记忆

### 内置工具
- [x] 截图（原生抓屏 + 全屏选区 + 内联标注工具条：绘图/序号/裁剪/撤销重做/复制/保存/钉图）
- [x] 「标注」打开/粘贴图片；箭头/矩形/椭圆/直线/画笔/高亮/马赛克/文字；撤销/清空/复制/保存 PNG
- [x] 剪贴板（记录文本 + 搜索 + 复制）
- [x] 日历（公历月视图 + 固定节日）
- [x] 改图（批量 png/jpg）
- [x] Markdown（打开/保存/导出 HTML，阅读/分屏/编辑）
- [x] **计算稿纸**：纸带（表达式=结果，千分位）+ 稿纸历史侧栏 + 顶部动作（调色/锁定/重命名/删除/复制/新建/列表开关）
- [x] 回到桌面 / 锁屏

### 体验与修复
- [x] 透明窗口 + 30px 大圆角，无矩形边框、无阴影
- [x] 修复四角灰底（WebView2 webview 背景运行时置透明）
- [x] 「面板不透明度」改为控制面板底色 alpha（100% = 完全不透明）
- [x] 禁止误选中；磨砂模糊开关；诊断日志（默认关）
- [x] 托盘：显示 / 切换主题 / 切换自启 / 退出

---

## 2. 明日待办（按优先级）

### A. 跨平台验证（最高优先）
- [ ] macOS：`/Applications` 扫描、`.icns`→png、`open` 启动、`screencapture`/锁屏/回桌
- [ ] Linux：`.desktop` 解析、图标主题、`xdg-open`、`loginctl`/`xdotool`
- [ ] macOS/Linux：热键、直达、托盘、自启、透明圆角表现

### B. 工具第二批
- [ ] 录屏（`ffmpeg` 或平台工具；含停止控制）
- [ ] 翻译 / OCR（20 语种）
- [ ] 快剪（ffmpeg：分割/裁剪/导出）
- [ ] 同声传译 / 语音输入

### C. 发布
- [ ] 生成并替换品牌图标（`tauri icon`）
- [ ] Windows `msi` / `nsis`；macOS `dmg` + 签名公证；Linux `AppImage`/`deb`
- [ ] GitHub Actions 三平台矩阵
- [ ] 自动更新（`tauri-plugin-updater`）

### D. 优化与增强
- [ ] 默认面板不透明度（建议 90%）/ 磨砂默认值
- [ ] 悬浮球 / 边缘触发 / 灵动岛
- [ ] 多 Profile / 分组
- [ ] 多语言 i18n
- [ ] 无障碍（焦点环、`prefers-reduced-motion` 全覆盖）
- [ ] 热键冲突检测与提示
- [ ] 图标缓存失效与增量刷新

---

## 3. 已知取舍

- [ ] 窗口**固定尺寸**（`resizable:false`）以消除 DWM 阴影；需缩放则改自绘缩放手柄
- [ ] Windows 上默认**无桌面虚化**；可在设置里开「磨砂模糊」（可能影响圆角观感）
- [ ] macOS 使用 `macOSPrivateApi`（效果最佳，**不可上架 App Store**）
- [ ] 截图仅支持主显示器，暂不含窗口识别 / 滚动长截图 / 录屏；Linux Wayland 依赖 grim 等外部工具

---

## 4. 验证命令 Check List

- [x] `bun install`
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `cargo check` / `cargo build`（`src-tauri`）
- [x] `bun run tauri dev`：Alt+Space、键位启动、搜索、编辑、设置
- [ ] 手测：标注 / 剪贴板 / 日历 / 改图 / 计算稿纸
- [ ] 导出 → 恢复默认 → 导入还原
- [ ] 拖文件到键位、翻页、窗口位置记忆
