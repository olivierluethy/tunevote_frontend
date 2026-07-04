import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import { X, Share2 } from "lucide-react";

// QR code + share-link dialog for joining the session.
const QrModal = ({ open, onClose, title, onShare }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Scan to Join</h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-white/60 mb-4 truncate">{title}</p>

          <div className="bg-white p-4 rounded-2xl inline-block mb-4">
            <QRCodeCanvas value={window.location.href} size={200} level="H" />
          </div>

          <button
            onClick={() => {
              onShare();
              onClose();
            }}
            className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all"
          >
            <Share2 className="w-4 h-4" />
            Share Link
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default QrModal;
