import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

// Mobile-first bottom sheet (#68): slides up from the bottom, big touch targets,
// tap-the-backdrop / swipe-down to close. Centered with a max width on desktop.
const BottomSheet = ({ open, onClose, title, children }) => {
  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-900 pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
          >
            <div className="flex flex-col items-center pt-3">
              <div className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <button
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-full text-white/60 hover:bg-white/10"
                  aria-label="Schließen"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;
