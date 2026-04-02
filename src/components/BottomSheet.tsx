import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useDrag } from "@use-gesture/react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const bindDrag = useDrag(
    ({ movement: [, my], last }) => {
      if (last && my > 100) {
        onClose();
      }
    },
    { axis: "y", filterTaps: true },
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-surface-container rounded-t-2xl z-[90] flex flex-col"
          >
            {/* Drag handle */}
            <div
              {...bindDrag()}
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
              style={{ touchAction: "none" }}
            >
              <div className="w-10 h-1 bg-accent/20 rounded-full" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-6 py-3 border-b border-outline/10">
                <h2 className="font-headline text-xl font-bold text-accent">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-accent/10 rounded-full transition-colors"
                  aria-label="Close"
                >
                  <X size={20} className="text-accent/50" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
