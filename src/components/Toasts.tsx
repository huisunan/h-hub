import { useEffect } from "react";
import { useHub, type Toast } from "../state/useHub";

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="hh-toast" data-kind={toast.kind}>
      {toast.text}
    </div>
  );
}

export function Toasts() {
  const toasts = useHub((state) => state.toasts);
  const dismiss = useHub((state) => state.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="hh-toast-wrap">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDone={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}
