import { useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { launchBinding } from "../lib/actions";
import { match } from "../lib/search";
import { TOOL_BY_ID } from "../lib/tools";
import type { Binding } from "../lib/types";
import { firstChar, gradientFor } from "../lib/util";
import { useHub } from "../state/useHub";

function renderName(name: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return name;
  const index = name.toLowerCase().indexOf(q);
  if (index < 0) return name;
  return (
    <>
      {name.slice(0, index)}
      <mark>{name.slice(index, index + q.length)}</mark>
      {name.slice(index + q.length)}
    </>
  );
}

function ResultIcon({ binding }: { binding: Binding }) {
  const tool = binding.kind === "tool" ? TOOL_BY_ID[binding.target] : undefined;
  if (tool) {
    return (
      <span className="hh-fallback" style={{ background: tool.color, width: 40, height: 40, borderRadius: 12, fontSize: 20 }}>
        {tool.emoji}
      </span>
    );
  }
  if (binding.icon) return <img src={binding.icon} alt="" />;
  return (
    <span className="hh-fallback" style={{ background: gradientFor(binding.name), width: 40, height: 40, borderRadius: 12, fontSize: 16 }}>
      {firstChar(binding.name)}
    </span>
  );
}

export function SearchView() {
  const apps = useHub((state) => state.apps);
  const bindings = useHub((state) => state.config.bindings);
  const query = useHub((state) => state.query);
  const focusIndex = useHub((state) => state.focusIndex);
  const patch = useHub((state) => state.patch);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    const pool: Binding[] = [];
    const seen = new Set<string>();
    const push = (binding: Binding) => {
      const key = `${binding.kind}:${binding.target}`;
      if (seen.has(key)) return;
      seen.add(key);
      pool.push(binding);
    };

    for (const map of [bindings.action, bindings.app]) {
      for (const binding of Object.values(map)) push(binding);
    }
    if (q) {
      for (const app of apps) {
        push({ kind: "app", name: app.name, target: app.target, args: app.args, icon: app.icon ?? undefined });
      }
    }

    const scored = pool
      .map((binding) => ({ binding, score: match(q, binding.name).score }))
      .filter((item) => item.score > 0);
    scored.sort((a, b) => b.score - a.score || a.binding.name.localeCompare(b.binding.name));
    return scored.slice(0, 32).map((item) => item.binding);
  }, [apps, bindings, query]);

  const launchAt = (index: number) => {
    const binding = results[index];
    if (binding) void launchBinding(binding, { close: false });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      patch({ view: "grid", query: "", focusIndex: 0 });
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      patch({ focusIndex: Math.min(focusIndex + 1, results.length - 1) });
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      patch({ focusIndex: Math.max(focusIndex - 1, 0) });
      return;
    }
    if (event.key === "Enter") {
      launchAt(results.length ? focusIndex : 0);
      return;
    }
    if (query.trim() && /^[1-8]$/.test(event.key)) {
      event.preventDefault();
      launchAt(Number(event.key) - 1);
    }
  };

  return (
    <>
      <div className="hh-search-head">
        <div className="hh-searchfield">
          <span>⌕</span>
          <input
            ref={inputRef}
            placeholder="搜索名称或首字母"
            value={query}
            onChange={(event) => patch({ query: event.target.value, focusIndex: 0 })}
            onKeyDown={onKeyDown}
          />
          <span className="hh-lang">En</span>
        </div>
      </div>
      <div className="hh-results">
        {results.length === 0 ? (
          <div className="hh-empty">
            <span className="hh-empty-ico">🔍</span>
            没有匹配结果
          </div>
        ) : (
          <div className="hh-result-grid">
            {results.map((binding, index) => (
              <button
                key={`${binding.kind}:${binding.target}`}
                className="hh-result"
                data-focus={index === focusIndex}
                onClick={() => launchAt(index)}
              >
                {index < 8 && <span className="hh-result-num">{index + 1}</span>}
                <ResultIcon binding={binding} />
                <span className="hh-result-name">{renderName(binding.name, query)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
