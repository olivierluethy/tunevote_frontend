import BottomSheet from "./BottomSheet";

// Votable session rules (#67): each row starts a multi-option poll that changes a
// rule (quorum thresholds / vote duration) if the group agrees. The rules
// themselves are decided democratically — nothing here is set unilaterally.
const RulesSheet = ({ open, onClose, onCreatePoll, disabled }) => {
  const startPoll = (question, key, values, fmt) => {
    onCreatePoll(
      question,
      values.map((v) => ({
        id: `${key}-${v}`,
        label: fmt(v),
        type: "set_rule",
        payload: { key, value: v },
      })),
    );
    onClose();
  };

  const pct = (v) => `${Math.round(v * 100)}%`;

  return (
    <BottomSheet open={open} onClose={onClose} title="🛡 Regeln (per Abstimmung)">
      <div className="flex flex-col gap-2">
        <RuleRow
          title="Skip-Quorum"
          desc="Wie viel % zum Überspringen nötig sind"
          disabled={disabled}
          onClick={() =>
            startPoll(
              "Skip-Quorum ändern?",
              "quorum.skip_current",
              [0.5, 0.6, 0.75],
              pct,
            )
          }
        />
        <RuleRow
          title="Beenden-Quorum"
          desc="Wie viel % zum Beenden der Session nötig sind"
          disabled={disabled}
          onClick={() =>
            startPoll(
              "Quorum zum Session-Beenden ändern?",
              "quorum.end_session",
              [0.66, 0.75, 0.9],
              pct,
            )
          }
        />
        <RuleRow
          title="Abstimmungsdauer"
          desc="Wie lange Abstimmungen offen bleiben"
          disabled={disabled}
          onClick={() =>
            startPoll(
              "Abstimmungsdauer ändern?",
              "duration_seconds",
              [30, 45, 60, 90],
              (v) => `${v}s`,
            )
          }
        />
        <RuleRow
          title="Auto-Pause"
          desc="Automatisch eine Pause vorschlagen nach X Songs"
          disabled={disabled}
          onClick={() => {
            onCreatePoll("Automatische Pausen-Regel?", [
              { id: "off", label: "Aus", type: "set_rule", payload: { key: "auto_pause_after_songs", value: null } },
              { id: "ap5", label: "nach 5", type: "set_rule", payload: { key: "auto_pause_after_songs", value: 5 } },
              { id: "ap8", label: "nach 8", type: "set_rule", payload: { key: "auto_pause_after_songs", value: 8 } },
              { id: "ap12", label: "nach 12", type: "set_rule", payload: { key: "auto_pause_after_songs", value: 12 } },
            ]);
            onClose();
          }}
        />
        <RuleRow
          title="Bei Ablauf entscheiden"
          desc="Bei Ablauf gewinnt die Mehrheit — auch ohne volles Quorum"
          disabled={disabled}
          onClick={() => {
            onCreatePoll("Bei Ablauf soll die Mehrheit entscheiden?", [
              { id: "on", label: "An", type: "set_rule", payload: { key: "poll_decide_on_expiry", value: 1 } },
              { id: "off", label: "Aus", type: "set_rule", payload: { key: "poll_decide_on_expiry", value: 0 } },
            ]);
            onClose();
          }}
        />
        <RuleRow
          title="AI-Vorschläge"
          desc="Der Assistent schlägt gelegentlich eine Pause vor (nie erzwungen)"
          disabled={disabled}
          onClick={() => {
            onCreatePoll("AI-Vorschläge aktivieren?", [
              { id: "on", label: "An", type: "set_rule", payload: { key: "ai_suggestions", value: 1 } },
              { id: "off", label: "Aus", type: "set_rule", payload: { key: "ai_suggestions", value: 0 } },
            ]);
            onClose();
          }}
        />
      </div>
    </BottomSheet>
  );
};

const RuleRow = ({ title, desc, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left transition-colors hover:bg-white/10 disabled:opacity-40"
  >
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-white">{title}</span>
      <span className="block truncate text-[11px] text-white/50">{desc}</span>
    </span>
    <span className="shrink-0 text-xs font-semibold text-violet-200">🗳 Abstimmen</span>
  </button>
);

export default RulesSheet;
