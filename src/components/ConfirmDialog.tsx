import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: () => Promise.resolve(false),
});

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setDialog(opts);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = (result: boolean) => {
    resolveRef.current?.(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] animate-in fade-in duration-150"
            onClick={() => handleClose(false)}
          />
          <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
            <div
              className="bg-surface border border-outline/20 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg shrink-0 ${dialog.danger ? "bg-red-500/10" : "bg-primary/10"}`}
                >
                  <AlertTriangle
                    size={20}
                    className={dialog.danger ? "text-red-400" : "text-primary"}
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="font-headline font-bold text-accent text-base">
                    {dialog.title}
                  </h3>
                  <p className="text-sm text-accent/60 leading-relaxed">
                    {dialog.message}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => handleClose(false)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-accent/60 hover:text-accent hover:bg-background/50 transition-all"
                >
                  {dialog.cancelText || "Cancel"}
                </button>
                {dialog.secondaryAction && (
                  <button
                    onClick={() => {
                      dialog.secondaryAction!.onClick();
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-accent/80 border border-outline/20 hover:border-primary/30 hover:text-primary transition-all"
                  >
                    {dialog.secondaryAction.label}
                  </button>
                )}
                <button
                  onClick={() => handleClose(true)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                    dialog.danger
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-primary text-background hover:opacity-90"
                  }`}
                >
                  {dialog.confirmText || "Continue"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </ConfirmContext.Provider>
  );
};
