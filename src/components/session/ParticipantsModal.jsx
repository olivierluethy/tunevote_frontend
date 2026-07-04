import { motion, AnimatePresence } from "framer-motion";
import { Users, X, Crown, Send, UserMinus } from "lucide-react";

// Live participants list + (host-only) invite form and member management.
const ParticipantsModal = ({
  open,
  onClose,
  liveParticipants,
  isHost,
  inviteEmail,
  setInviteEmail,
  onSendInvite,
  inviteStatus,
  acceptedInvites,
  onRemoveInvite,
  removingUserId,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 16 }}
          className="bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-white/10 shadow-2xl max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold">Participants</h3>
              <span className="text-xs text-white/50">
                ({liveParticipants.length} live)
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {liveParticipants.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {liveParticipants.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-xl bg-white/5"
                >
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                    {p.profileImage ? (
                      <img
                        src={p.profileImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      p.name?.[0]?.toUpperCase() || "?"
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium">{p.name}</span>
                  {p.isHost && <Crown className="w-4 h-4 text-yellow-400" />}
                </div>
              ))}
            </div>
          )}

          {isHost && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-3">
              <p className="text-xs text-white/60 mb-2 font-medium">
                Invite someone
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSendInvite()}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder-white/30"
                />
                <button
                  onClick={onSendInvite}
                  disabled={!inviteEmail.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {inviteStatus === "success" && (
                <p className="text-xs text-green-400 mt-2">Invitation sent!</p>
              )}
              {inviteStatus === "error" && (
                <p className="text-xs text-red-400 mt-2">
                  Invalid email or error.
                </p>
              )}
            </div>
          )}

          {isHost && acceptedInvites.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-white/50 px-1">Members</p>
              {acceptedInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-3 p-2 rounded-xl bg-white/5"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                    {invite.imageData ? (
                      <img
                        src={invite.imageData}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      invite.invitee_name?.[0]?.toUpperCase() ||
                      invite.invitee_email?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {invite.invitee_name || "Unknown"}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {invite.invitee_email}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveInvite(invite)}
                    disabled={removingUserId === invite.id}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ParticipantsModal;
