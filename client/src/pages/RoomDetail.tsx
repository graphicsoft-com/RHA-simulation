import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useRoomStatus } from '../hooks/useRoomStatus';
import { ROOM_NAMES } from '@org/shared-types';

export default function RoomDetail() {
  const { id: roomId = 'room1' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0); // seconds since active

  const { rooms, startRoom, stopRoom } = useRoomStatus();
  const room = rooms.find(r => r.roomId === roomId);
  const isActive = room?.status === 'active';

  const { messages, connected } = useSocket({ roomId, audioEnabled: true });

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Session timer
  useEffect(() => {
    if (!isActive) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  function formatTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 pt-20 pb-6 h-screen flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-muted hover:text-text text-xs tracking-widest transition-colors"
          >
            ← BACK
          </button>
          <div className="w-px h-4 bg-border" />
          <div>
            <div className="flex items-center gap-2">
              <span className={`pulse-dot ${isActive ? '' : 'idle'}`} />
              <span className="font-display text-lg font-700 text-white tracking-wide">
                {ROOM_NAMES[roomId] ?? roomId}
              </span>
            </div>
            <div className="text-[10px] text-muted tracking-widest">{roomId.toUpperCase()}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          {isActive && (
            <div className="px-3 py-1 rounded border border-cyan/20 bg-cyan/5">
              <span className="text-cyan text-xs font-600 tracking-widest">
                ⏱ {formatTime(elapsed)}
              </span>
            </div>
          )}

          {/* Message count */}
          <div className="px-3 py-1 rounded border border-border text-[10px] text-muted tracking-widest">
            {messages.length} MSGS
          </div>

          {/* Socket status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green' : 'bg-red'}`} />
            <span className={`text-[10px] tracking-widest ${connected ? 'text-green' : 'text-red'}`}>
              {connected ? 'LIVE' : 'OFF'}
            </span>
          </div>

          {/* Start / Stop */}
          {!isActive ? (
            <button
              onClick={() => startRoom(roomId)}
              className="px-4 py-1.5 rounded border border-green/40 bg-green/5 text-green text-[11px] font-600 tracking-widest uppercase hover:bg-green/10 transition-all"
            >
              ▶ START
            </button>
          ) : (
            <button
              onClick={() => stopRoom(roomId)}
              className="px-4 py-1.5 rounded border border-red/40 bg-red/5 text-red text-[11px] font-600 tracking-widest uppercase hover:bg-red/10 transition-all"
            >
              ■ STOP
            </button>
          )}
        </div>
      </div>

      {/* Patient profile banner */}
      {isActive && room?.activeSessionId && (
        <div className="mb-3 px-4 py-2 rounded border border-amber/20 bg-amber/5 text-[11px] text-amber tracking-wide flex items-center gap-2">
          <span className="text-amber/60">🧑 PATIENT PROFILE</span>
          <span>Randomly selected for this session — symptoms randomized per run</span>
        </div>
      )}

      {/* Chat log */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-surface p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <div className="text-muted text-xs tracking-widest">
              {isActive ? 'SESSION STARTED — WAITING FOR FIRST TURN...' : 'NO ACTIVE SESSION'}
            </div>
            {!isActive && (
              <button
                onClick={() => startRoom(roomId)}
                className="px-6 py-2 rounded border border-green/40 bg-green/5 text-green text-xs font-600 tracking-widest uppercase hover:bg-green/10 transition-all"
              >
                ▶ START SESSION
              </button>
            )}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className="animate-fadein flex gap-3">
              {/* Role indicator */}
              <div className={`flex-shrink-0 w-16 pt-0.5 text-[9px] font-600 uppercase tracking-widest ${
                m.role === 'clinician' ? 'text-cyan' : 'text-green'
              }`}>
                {m.role === 'clinician' ? '👨‍⚕️ DR.' : '🧑 PT.'}
              </div>

              {/* Bubble */}
              <div className={`flex-1 rounded-lg px-3 py-2 border ${
                m.role === 'clinician'
                  ? 'border-cyan/15 bg-cyan/5'
                  : 'border-green/15 bg-green/5'
              }`}>
                <p className="text-sm text-text leading-relaxed">{m.text}</p>
                <div className="text-[9px] text-muted mt-1 tracking-widest">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 text-[9px] text-muted tracking-widest">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-cyan/30 border border-cyan/40" />
          CLINICIAN
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-green/30 border border-green/40" />
          PATIENT
        </span>
        <span className="ml-auto">
          AUDIO VIA BROWSER WEB SPEECH API · RECORDED BY SONA
        </span>
      </div>
    </div>
  );
}
