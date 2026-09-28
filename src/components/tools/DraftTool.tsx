import { useEffect, useState } from "react";

const STORAGE_KEY = "hhub-drafts";

function evaluate(expression: string): string | null {
  const text = expression.trim();
  if (!text || !/^[\d+\-*/(). %]+$/.test(text) || !/\d/.test(text)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const value = new Function(`return (${text})`)();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  } catch {
    return null;
  }
  return null;
}

export function DraftTool() {
  const [cells, setCells] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [""];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cells));
  }, [cells]);

  const update = (index: number, value: string) => {
    setCells((prev) => prev.map((cell, i) => (i === index ? value : cell)));
  };

  return (
    <div className="hh-tool">
      <div className="hh-tool-head">
        <span className="hh-tool-title">草稿</span>
        <span className="hh-tool-sub">分格记录 · 算式即时计算</span>
        <div className="hh-spacer" />
        <button className="hh-btn" onClick={() => setCells((prev) => [...prev, ""])}>
          + 新增格
        </button>
        <button className="hh-btn" data-variant="ghost" onClick={() => setCells([""])}>
          清空
        </button>
      </div>
      <div className="hh-tool-body">
        <div className="hh-draft-grid">
          {cells.map((cell, index) => {
            const result = evaluate(cell);
            return (
              <div className="hh-draft-cell" key={index}>
                <textarea
                  value={cell}
                  placeholder="输入内容或算式，如 (12+8)*3"
                  onChange={(event) => update(index, event.target.value)}
                />
                {result !== null && cell.trim() !== result && <output>= {result}</output>}
                {cells.length > 1 && (
                  <button
                    className="hh-btn"
                    data-variant="ghost"
                    onClick={() => setCells((prev) => prev.filter((_, i) => i !== index))}
                  >
                    删除
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
