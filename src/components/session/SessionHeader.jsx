import { ArrowLeft, Edit3, Lock, Users, QrCode, Share2 } from "lucide-react";

// Slim sticky header: identity + navigation + share/participants actions.
const SessionHeader = ({
  session,
  isHost,
  sessionLive,
  queuedCount,
  participantCount,
  onBack,
  onEditName,
  onOpenParticipants,
  onOpenQr,
  onShare,
}) => (
  <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/90 border-b border-white/5">
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-base truncate">{session.title}</h1>
            {isHost && (
              <button
                onClick={onEditName}
                className="p-1 hover:bg-white/10 rounded transition-colors shrink-0"
              >
                <Edit3 className="w-4 h-4 text-white/50" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            {sessionLive ? (
              <span className="flex items-center gap-1 text-green-400">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                Live
              </span>
            ) : (
              <span className="text-yellow-400">Waiting to start</span>
            )}
            {session.is_private === 1 && (
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Private
              </span>
            )}
            <span className="text-white/30">·</span>
            <span>{queuedCount} in queue</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {session.is_private === 1 && (
          <button
            onClick={onOpenParticipants}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors relative"
          >
            <Users className="w-5 h-5" />
            {participantCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-[10px] font-bold flex items-center justify-center">
                {participantCount}
              </span>
            )}
          </button>
        )}
        <button
          onClick={onOpenQr}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <QrCode className="w-5 h-5" />
        </button>
        <button
          onClick={onShare}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  </header>
);

export default SessionHeader;
