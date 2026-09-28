import { pinyin } from "pinyin-pro";

const cache = new Map<string, { initials: string; full: string }>();

function analyze(text: string): { initials: string; full: string } {
  const cached = cache.get(text);
  if (cached) return cached;
  let initials = "";
  let full = "";
  try {
    initials = pinyin(text, { pattern: "first", toneType: "none", type: "string" })
      .replace(/\s+/g, "")
      .toLowerCase();
    full = pinyin(text, { pattern: "pinyin", toneType: "none", type: "string" })
      .replace(/\s+/g, "")
      .toLowerCase();
  } catch {
    initials = text.toLowerCase();
    full = text.toLowerCase();
  }
  const result = { initials, full };
  cache.set(text, result);
  return result;
}

export interface MatchResult {
  score: number;
  initials: string;
}

export function match(query: string, name: string): MatchResult {
  const q = query.trim().toLowerCase();
  const { initials, full } = analyze(name);
  if (!q) return { score: 1, initials };
  const n = name.toLowerCase();
  if (n === q) return { score: 1000, initials };
  if (n.startsWith(q)) return { score: 900, initials };
  if (n.includes(q)) return { score: 700, initials };
  if (initials.startsWith(q)) return { score: 820, initials };
  if (initials.includes(q)) return { score: 600, initials };
  if (full.startsWith(q)) return { score: 500, initials };
  if (full.includes(q)) return { score: 400, initials };
  return { score: -1, initials };
}
