import { useEffect, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useHub } from "../../state/useHub";

const STORAGE_KEY = "hhub-papers-v2";
const LEGACY_KEY = "hhub-drafts";
const ACCENTS = ["#f59e0b", "#3b82f6", "#22b07d", "#8b5cf6", "#ef4444", "#14b8a6"];

interface Paper {
  id: string;
  title: string;
  createdAt: number;
  color?: string;
  locked?: boolean;
  rows: string[];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function createPaper(): Paper {
  return { id: uid(), title: "计算稿纸", createdAt: Date.now(), rows: [""] };
}

function loadPapers(): Paper[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Paper[];
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((paper) => ({
          ...paper,
          rows: Array.isArray(paper.rows) && paper.rows.length ? paper.rows : [""],
        }));
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const cells = JSON.parse(legacy) as string[];
      if (Array.isArray(cells)) {
        return [
          {
            id: uid(),
            title: "计算稿纸",
            createdAt: Date.now(),
            rows: cells.length ? cells : [""],
          },
        ];
      }
    }
  } catch {
    /* ignore */
  }
  return [createPaper()];
}

function evaluate(expression: string): number | null {
  let text = expression.trim().replace(/,/g, "");
  if (!text) return null;
  text = text.replace(/\^/g, "**");
  if (!/^[\d+\-*/(). %]+$/.test(text) || !/\d/.test(text)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const value = new Function(`return (${text})`)();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  } catch {
    return null;
  }
  return null;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1e10) / 1e10;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 10 });
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DraftTool() {
  const pushToast = useHub((state) => state.pushToast);
  const [papers, setPapers] = useState<Paper[]>(loadPapers);
  const [activeId, setActiveId] = useState<string>(() => papers[0].id);
  const [showSide, setShowSide] = useState(true);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const [activeRow, setActiveRow] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const paper = papers.find((item) => item.id === activeId) ?? papers[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
  }, [papers]);

  useEffect(() => {
    if (focusRow === null) return;
    const input = inputRefs.current[focusRow];
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    setFocusRow(null);
  }, [focusRow, papers]);

  const updatePaper = (updater: (paper: Paper) => Paper) => {
    setPapers((prev) => prev.map((item) => (item.id === paper.id ? updater(item) : item)));
  };

  const setRows = (rows: string[]) => updatePaper((item) => ({ ...item, rows }));

  const onEnter = (index: number) => {
    if (index === paper.rows.length - 1) {
      setRows([...paper.rows, ""]);
      setFocusRow(index + 1);
    } else {
      setFocusRow(index + 1);
    }
  };

  const onBackspace = (index: number) => {
    if (paper.rows[index] !== "" || paper.rows.length <= 1) return;
    setRows(paper.rows.filter((_, i) => i !== index));
    setFocusRow(Math.max(0, index - 1));
  };

  const newPaper = () => {
    const next = createPaper();
    setPapers((prev) => [next, ...prev]);
    setActiveId(next.id);
    setFocusRow(0);
  };

  const deletePaper = () => {
    if (papers.length <= 1) {
      pushToast("至少保留一张稿纸", "error");
      return;
    }
    if (!window.confirm("删除当前稿纸？")) return;
    const rest = papers.filter((item) => item.id !== paper.id);
    setPapers(rest);
    setActiveId(rest[0].id);
  };

  const renamePaper = () => {
    const title = window.prompt("稿纸名称", paper.title);
    if (title?.trim()) updatePaper((item) => ({ ...item, title: title.trim() }));
  };

  const cycleColor = () => {
    const index = paper.color ? ACCENTS.indexOf(paper.color) : -1;
    updatePaper((item) => ({ ...item, color: ACCENTS[(index + 1) % ACCENTS.length] }));
  };

  const copyAll = async () => {
    const lines = paper.rows
      .map((expression) => {
        const value = evaluate(expression);
        if (value === null) return expression.trim();
        return `${expression.trim()} = ${formatNumber(value)}`;
      })
      .filter(Boolean);
    if (lines.length === 0) {
      pushToast("没有可复制的内容", "error");
      return;
    }
    try {
      await writeText(lines.join("\n"));
      pushToast("已复制到剪贴板");
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  const sorted = [...papers].sort((a, b) => b.createdAt - a.createdAt);
  const locked = Boolean(paper.locked);

  return (
    <div className="hh-tool">
      <div className="hh-tool-head">
        <span className="hh-calc-chip">
          <span className="hh-calc-chip-ico">🧮</span>
          {paper.title}
        </span>
        <div className="hh-spacer" />
        <div className="hh-calc-actions">
          <button className="hh-iconbtn" title="强调色" onClick={cycleColor}>
            🎨
          </button>
          <button
            className="hh-iconbtn"
            title={locked ? "解锁" : "锁定"}
            onClick={() => updatePaper((item) => ({ ...item, locked: !item.locked }))}
          >
            {locked ? "🔒" : "🔓"}
          </button>
          <button className="hh-iconbtn" title="重命名" onClick={renamePaper}>
            ✎
          </button>
          <button className="hh-iconbtn" title="删除稿纸" onClick={deletePaper}>
            🗑
          </button>
          <button className="hh-iconbtn" title="复制全部" onClick={() => void copyAll()}>
            ⧉
          </button>
          <button className="hh-btn" data-variant="primary" onClick={newPaper}>
            ＋ 新稿纸
          </button>
          <button
            className="hh-iconbtn"
            title={showSide ? "隐藏稿纸列表" : "显示稿纸列表"}
            onClick={() => setShowSide((value) => !value)}
          >
            ☰
          </button>
        </div>
      </div>

      <div className="hh-calc-body">
        <div className="hh-calc-tape">
          {paper.rows.map((expression, index) => {
            const value = evaluate(expression);
            const active = index === activeRow;
            const accent = active && paper.color ? { background: `${paper.color}22` } : undefined;
            return (
              <div
                className="hh-calc-row"
                key={index}
                data-active={active}
                style={accent}
              >
                <input
                  ref={(element) => { inputRefs.current[index] = element; }}
                  className="hh-calc-input"
                  value={expression}
                  readOnly={locked}
                  placeholder="计算公式"
                  onFocus={() => setActiveRow(index)}
                  onChange={(event) => {
                    const rows = [...paper.rows];
                    rows[index] = event.target.value;
                    setRows(rows);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onEnter(index);
                    } else if (event.key === "Backspace" && (event.target as HTMLInputElement).value === "") {
                      event.preventDefault();
                      onBackspace(index);
                    }
                  }}
                />
                {active && !locked && <span className="hh-calc-pin">📍</span>}
                <span className="hh-calc-result">
                  {value !== null ? `= ${formatNumber(value)}` : "="}
                </span>
              </div>
            );
          })}
        </div>

        {showSide && (
          <aside className="hh-calc-side">
            {sorted.map((item) => (
              <button
                key={item.id}
                className="hh-calc-side-item"
                data-active={item.id === paper.id}
                onClick={() => { setActiveId(item.id); setActiveRow(0); }}
              >
                <span className="hh-calc-side-time">{formatTime(item.createdAt)}</span>
                <span className="hh-calc-side-title">{item.title}</span>
              </button>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
