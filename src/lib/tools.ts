export type ToolKind = "view" | "native";

export interface ToolDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: ToolKind;
}

export const TOOLS: ToolDef[] = [
  { id: "screenshot", name: "截图", emoji: "✂️", color: "#8b5cf6", kind: "native" },
  { id: "annotate", name: "标注", emoji: "🖊️", color: "#b48cff", kind: "view" },
  { id: "clipboard", name: "剪贴板", emoji: "📋", color: "#2fa8bd", kind: "view" },
  { id: "calendar", name: "日历", emoji: "📅", color: "#d99a3a", kind: "view" },
  { id: "imageConvert", name: "改图", emoji: "🖼️", color: "#e0834a", kind: "view" },
  { id: "markdown", name: "Markdown", emoji: "📝", color: "#4a90d9", kind: "view" },
  { id: "draft", name: "计算稿纸", emoji: "🧮", color: "#9a6ce0", kind: "view" },
  { id: "backDesktop", name: "回到桌面", emoji: "🖥️", color: "#2fa89a", kind: "native" },
  { id: "lock", name: "锁屏", emoji: "🔒", color: "#d96a5a", kind: "native" },
];

export const TOOL_BY_ID: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((tool) => [tool.id, tool]),
);

export const RECOMMENDED_ACTION_LAYOUT: Record<string, string> = {
  Digit1: "screenshot",
  Digit2: "clipboard",
  Digit3: "calendar",
  Digit4: "imageConvert",
  Digit5: "markdown",
  Digit6: "draft",
  Digit7: "backDesktop",
  Digit8: "lock",
  Digit9: "annotate",
};
