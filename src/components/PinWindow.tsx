import { useEffect, useRef, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { ipc } from "../lib/ipc";
import { rgbaBody } from "../lib/rgba";

interface MenuState {
  x: number;
  y: number;
}

export function PinWindow({ label }: { label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const appWindow = useRef(getCurrentWindow()).current;
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    ipc
      .takePinImage(label)
      .then((data) => {
        if (data) setSrc(data);
        else setError("图片已失效");
      })
      .catch((reason) => setError(String(reason)));
  }, [label]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void appWindow.close();
    };
    const onClick = () => setMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [appWindow]);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 1200);
  };

  const onWheel = async (event: React.WheelEvent) => {
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    try {
      const size = await appWindow.innerSize();
      const scale = await appWindow.scaleFactor();
      const width = Math.max(80, (size.width / scale) * factor);
      const height = Math.max(60, (size.height / scale) * factor);
      await appWindow.setSize(new LogicalSize(width, height));
    } catch {
      /* ignore */
    }
  };

  const copy = async () => {
    const img = imgRef.current;
    if (!img) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      await ipc.clipboardWriteImage(rgbaBody(canvas));
      flash("已复制");
    } catch (reason) {
      flash(String(reason));
    }
  };

  return (
    <div
      className="pin-root"
      data-tauri-drag-region
      onWheel={(event) => void onWheel(event)}
      onDoubleClick={() => void appWindow.close()}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {src && (
        <img
          ref={imgRef}
          className="pin-image"
          src={src}
          alt=""
          data-tauri-drag-region
          draggable={false}
        />
      )}
      {!src && !error && <div className="pin-status">正在加载…</div>}
      {error && <div className="pin-status">{error}</div>}
      {toast && <div className="pin-toast">{toast}</div>}
      {menu && (
        <div className="pin-menu" style={{ left: menu.x, top: menu.y }}>
          <button type="button" onClick={() => void copy()}>
            复制图片
          </button>
          <button type="button" onClick={() => void appWindow.close()}>
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
