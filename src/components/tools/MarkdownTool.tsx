import { useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ipc } from "../../lib/ipc";
import { renderMarkdown } from "../../lib/markdown";
import { useHub } from "../../state/useHub";

type Mode = "read" | "split" | "edit";

export function MarkdownTool() {
  const pushToast = useHub((state) => state.pushToast);
  const [content, setContent] = useState("# h-hub Markdown\n\n开始输入内容…\n");
  const [mode, setMode] = useState<Mode>("split");
  const [path, setPath] = useState<string | null>(null);

  const html = useMemo(() => renderMarkdown(content), [content]);

  const openFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
      });
      if (typeof selected !== "string") return;
      setContent(await ipc.readText(selected));
      setPath(selected);
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  const saveFile = async () => {
    try {
      let target = path;
      if (!target) {
        const selected = await save({
          defaultPath: "untitled.md",
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
        if (typeof selected !== "string") return;
        target = selected;
      }
      await ipc.writeText(target, content);
      setPath(target);
      pushToast("已保存");
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  const exportHtml = async () => {
    try {
      const selected = await save({
        defaultPath: "export.html",
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (typeof selected !== "string") return;
      await ipc.writeText(
        selected,
        `<!doctype html><html><head><meta charset="utf-8"><title>h-hub</title></head><body>${html}</body></html>`,
      );
      pushToast("已导出 HTML");
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  return (
    <div className="hh-tool">
      <div className="hh-tool-head">
        <span className="hh-tool-title">Markdown</span>
        <span className="hh-tool-sub">{path ?? "未命名文档"}</span>
        <div className="hh-spacer" />
        <div className="hh-segmented">
          {(["read", "split", "edit"] as Mode[]).map((item) => (
            <button key={item} data-active={mode === item} onClick={() => setMode(item)}>
              {item === "read" ? "阅读" : item === "split" ? "分屏" : "编辑"}
            </button>
          ))}
        </div>
        <button className="hh-btn" onClick={() => void openFile()}>
          打开
        </button>
        <button className="hh-btn" onClick={() => void saveFile()}>
          保存
        </button>
        <button className="hh-btn" onClick={() => void exportHtml()}>
          导出 HTML
        </button>
      </div>
      <div className="hh-tool-body" style={{ display: "flex" }}>
        <div className="hh-md-split" style={{ flex: 1, gridTemplateColumns: mode === "split" ? "1fr 1fr" : "1fr" }}>
          {mode !== "read" && (
            <div className="hh-md-editor">
              <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} />
            </div>
          )}
          {mode !== "edit" && <article className="hh-md-view" dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
      </div>
    </div>
  );
}
