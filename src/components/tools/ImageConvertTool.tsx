import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ipc } from "../../lib/ipc";
import { useHub } from "../../state/useHub";

export function ImageConvertTool() {
  const pushToast = useHub((state) => state.pushToast);
  const [inputs, setInputs] = useState<string[]>([]);
  const [outDir, setOutDir] = useState("");
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(85);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const pickFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "ico"] }],
      });
      if (Array.isArray(selected)) setInputs(selected);
      else if (typeof selected === "string") setInputs([selected]);
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  const pickDir = async () => {
    try {
      const selected = await open({ directory: true });
      if (typeof selected === "string") setOutDir(selected);
    } catch (error) {
      pushToast(String(error), "error");
    }
  };

  const run = async () => {
    if (inputs.length === 0 || !outDir) {
      pushToast("请先选择图片与输出目录", "error");
      return;
    }
    setBusy(true);
    try {
      const output = await ipc.convertImages(inputs, outDir, format, quality);
      setResults(output);
      pushToast(`已转换 ${output.length} 张图片`);
    } catch (error) {
      pushToast(String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hh-tool">
      <div className="hh-tool-head">
        <span className="hh-tool-title">改图</span>
        <span className="hh-tool-sub">批量转换格式与尺寸</span>
      </div>
      <div className="hh-tool-body">
        <div className="hh-row">
          <button className="hh-btn" onClick={() => void pickFiles()}>
            选择图片{inputs.length ? `（${inputs.length}）` : ""}
          </button>
          <button className="hh-btn" onClick={() => void pickDir()}>
            {outDir ? "更换输出目录" : "选择输出目录"}
          </button>
          <label className="hh-field">
            格式
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </label>
          {format === "jpg" && (
            <label className="hh-field">
              质量 {quality}
              <input
                type="range"
                min={40}
                max={100}
                value={quality}
                onChange={(event) => setQuality(Number(event.target.value))}
              />
            </label>
          )}
          <button className="hh-btn" data-variant="primary" disabled={busy} onClick={() => void run()}>
            {busy ? "转换中…" : "开始转换"}
          </button>
        </div>

        {outDir && <p className="hh-tool-sub">输出：{outDir}</p>}

        {results.length > 0 ? (
          <div className="hh-clip-list" style={{ marginTop: 12 }}>
            {results.map((path) => (
              <div className="hh-clip" key={path}>
                <p>{path}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="hh-empty">
            <span className="hh-empty-ico">🖼️</span>
            选择图片后开始批量转换
          </div>
        )}
      </div>
    </div>
  );
}
