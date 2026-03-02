import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoomStatus } from '../hooks/useRoomStatus';

interface RoomCardProps {
  room: RoomStatus;
  onStart: (roomId: string) => Promise<void>;
  onStop:  (roomId: string) => Promise<void>;
}

export default function RoomCard({ room, onStart }: RoomCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const isActive = room.status === 'active';

  async function handleStartAndNavigate() {
    setLoading(true);
    try {
      if (!isActive) await onStart(room.roomId);
      navigate(`/room/${room.roomId}`);
    } finally {
      setLoading(false);
    }
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

      {/* CTA */}
      <div className="px-4 pb-4">
        <button
          onClick={handleStartAndNavigate}
          disabled={loading}
          className={`w-full py-2 rounded border text-[11px] font-600 tracking-widest uppercase transition-all disabled:opacity-40 ${
            isActive
              ? 'border-cyan/40 bg-cyan/5 text-cyan hover:bg-cyan/10 hover:border-cyan/70'
              : 'border-green/40 bg-green/5 text-green hover:bg-green/10 hover:border-green/70'
          }`}
        >
          {loading ? 'STARTING...' : isActive ? '↗ JOIN SESSION' : '▶ START SESSION'}
        </button>
      </div>
    </div>
  );
}
