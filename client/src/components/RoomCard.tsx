import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveMessage } from '../hooks/useSocket';
import { RoomStatus } from '../hooks/useRoomStatus';

interface RoomCardProps {
  room: RoomStatus;
  onStart: (roomId: string) => Promise<void>;
  onStop:  (roomId: string) => Promise<void>;
  /** Messages pushed from Dashboard's shared socket */
  liveMessages: LiveMessage[];
}

export default function RoomCard({ room, onStart, onStop, liveMessages }: RoomCardProps) {
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const [audioOn, setAudioOn] = useState(true);

  const isActive = room.status === 'active';

  // Filter live messages for this room only — keep last 5
  const myMessages = liveMessages
    .filter(m => m.roomId === room.roomId)
    .slice(-5);

  async function handleStart() {
    setLoading(true);
    try { await onStart(room.roomId); } finally { setLoading(false); }
  }

  async function handleStop() {
    setLoading(true);
    try { await onStop(room.roomId); } finally { setLoading(false); }
  }

  return (
    <div
      className={`
        relative flex flex-col rounded-lg border transition-all duration-300 overflow-hidden
        ${isActive
          ? 'border-cyan/40 bg-surface shadow-[0_0_20px_rgba(0,229,255,0.06)]'
          : 'border-border bg-surface hover:border-muted'
        }
      `}
    >
      {/* Active glow bar */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan to-transparent" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`pulse-dot ${isActive ? '' : 'idle'}`} />
            <span className="font-display text-sm font-700 text-white uppercase tracking-wider">
              {room.name}
            </span>
          </div>
          <div className="text-[10px] text-muted mt-0.5 tracking-widest">
            {room.roomId.toUpperCase()}
          </div>
        </div>

        <div className="text-right">
          <div className={`text-xs font-600 tracking-widest uppercase ${isActive ? 'text-green' : 'text-muted'}`}>
            {isActive ? 'LIVE' : 'IDLE'}
          </div>
          {isActive && (
            <div className="text-[10px] text-muted mt-0.5">
              {room.messageCount} msgs
            </div>
          )}
        </div>
      </div>

      {/* Live message feed */}
      <div className="flex-1 mx-4 mb-3 rounded border border-border bg-bg min-h-[120px] max-h-[140px] overflow-y-auto p-2">
        {myMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[10px] text-muted tracking-widest">
            {isActive ? 'WAITING FOR FIRST TURN...' : 'NO ACTIVE SESSION'}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {myMessages.map((m, i) => (
              <div key={i} className="animate-fadein">
                <span className={`text-[9px] uppercase tracking-widest font-600 ${
                  m.role === 'clinician' ? 'text-cyan' : 'text-green'
                }`}>
                  {m.role === 'clinician' ? '▸ Dr.' : '▸ Pt.'}
                </span>
                <p className="text-[11px] text-text leading-snug mt-0.5 line-clamp-2">
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 pb-4">
        {!isActive ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex-1 py-1.5 rounded border border-green/40 bg-green/5 text-green text-[11px] font-600 tracking-widest uppercase hover:bg-green/10 hover:border-green/70 transition-all disabled:opacity-40"
          >
            {loading ? 'STARTING...' : '▶ START'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={loading}
            className="flex-1 py-1.5 rounded border border-red/40 bg-red/5 text-red text-[11px] font-600 tracking-widest uppercase hover:bg-red/10 hover:border-red/70 transition-all disabled:opacity-40"
          >
            {loading ? 'STOPPING...' : '■ STOP'}
          </button>
        )}

        {/* Audio toggle */}
        <button
          onClick={() => setAudioOn(!audioOn)}
          title={audioOn ? 'Mute audio' : 'Unmute audio'}
          className={`w-8 h-8 rounded border text-[10px] transition-all ${
            audioOn
              ? 'border-cyan/30 text-cyan bg-cyan/5 hover:bg-cyan/10'
              : 'border-muted/30 text-muted hover:border-muted/60'
          }`}
        >
          {audioOn ? '🔊' : '🔇'}
        </button>

        {/* Detail link */}
        <button
          onClick={() => navigate(`/room/${room.roomId}`)}
          className="w-8 h-8 rounded border border-border text-muted text-[10px] hover:border-muted/60 hover:text-text transition-all"
          title="View detail"
        >
          ↗
        </button>
      </div>
    </div>
  );
}
