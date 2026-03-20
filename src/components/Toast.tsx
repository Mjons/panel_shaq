import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type: "error" | "success" | "info";
  duration?: number;
}

interface ToastContextValue {
  addToast: (message: string, type?: Toast["type"], duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "error", duration = 5000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{
  toast: Toast;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const Icon =
    toast.type === "error"
      ? AlertTriangle
      : toast.type === "success"
        ? CheckCircle
        : Info;

  const borderColor =
    toast.type === "error"
      ? "border-red-500/50"
      : toast.type === "success"
        ? "border-green-500/50"
        : "border-primary/50";

  const iconColor =
    toast.type === "error"
      ? "text-red-400"
      : toast.type === "success"
        ? "text-green-400"
        : "text-primary";

  return (
    <div
      className={`bg-surface border ${borderColor} rounded-lg shadow-2xl px-4 py-3 flex items-start gap-3 transition-all duration-300 ${
        exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
      }`}
    >
      <Icon size={18} className={`${iconColor} mt-0.5 shrink-0`} />
      <p className="text-accent text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="text-accent/40 hover:text-accent shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};
