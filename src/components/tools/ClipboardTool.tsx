import { useEffect, useState } from "react";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { timeAgo } from "../../lib/util";
import { useHub } from "../../state/useHub";

interface Clip {
  text: string;
  at: number;
}

export function ClipboardTool() {
  const pushToast = useHub((state) => state.pushToast);
  const [items, setItems] = useState<Clip[]>([]);
  const [query, setQuery] = useState("");
  const [live, setLive] = useState(true);

  useEffect(() => {
    let active = true;
    let last = "";
    const tick = async () => {
      try {
        const text = await readText();
        if (!active || !text || text === last) return;
        last = text;
        setItems((prev) => [{ text, at: Date.now() }, ...prev.filter((item) => item.text !== text)].slice(0, 80));
      } catch {
        /* clipboard unavailable */
      }
    };
    void tick();
    const timer = window.setInterval(tick, 1200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const filtered = query
    ? items.filter((item) => item.text.toLowerCase().includes(query.toLowerCase()))
    : items;

  const copy = async (text: string) => {
    try {
      await writeText(text);
      pushToast("已复制到剪贴板");
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  return (
    <div className="hh-tool">
      <div className="hh-tool-head">
        <span className="hh-tool-title">剪贴板</span>
        <span className="hh-tool-sub">自动记录文本</span>
        <div className="hh-spacer" />
        <input
          placeholder="搜索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ padding: "8px 14px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-strong)", outline: "none" }}
        />
        <button className="hh-btn" data-variant="ghost" onClick={() => setLive((value) => !value)}>
          {live ? "暂停记录" : "继续记录"}
        </button>
        <button className="hh-btn" data-variant="ghost" onClick={() => setItems([])}>
          清空
        </button>
      </div>
      <div className="hh-tool-body">
        {filtered.length === 0 ? (
          <div className="hh-empty">
            <span className="hh-empty-ico">📋</span>
            还没有记录，复制一些文字试试
          </div>
        ) : (
          <div className="hh-clip-list">
            {filtered.map((item, index) => (
              <div className="hh-clip" key={`${item.at}-${index}`}>
                <p>{item.text}</p>
                <time>{timeAgo(item.at)}</time>
                <button className="hh-btn" data-variant="ghost" onClick={() => void copy(item.text)}>
                  复制
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
