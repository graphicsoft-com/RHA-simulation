import { useRoomStatus } from '../hooks/useRoomStatus';
import { useSocket } from '../hooks/useSocket';
import RoomCard from '../components/RoomCard';

export default function Dashboard() {
  const { rooms, loading, error, startRoom, stopRoom, activeCount } = useRoomStatus();

  // Single shared socket on dashboard mode — receives messages from ALL rooms
  const { messages: liveMessages, connected } = useSocket({
    roomId: 'dashboard',
    audioEnabled: false, // audio handled per-card
    dashboard: true,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted text-xs tracking-widest">
        CONNECTING TO SERVER...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-red text-xs tracking-widest">
        ❌ {error} — is the server running?
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-20 pb-12">

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[10px] text-muted tracking-[0.25em] uppercase mb-2">
            iPole Project · RHA Testing
          </div>
          <h1 className="font-display text-3xl font-800 text-white tracking-tight">
            Room <span className="text-cyan">Command</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            AI patient-clinician simulation across 6 rooms · 6PM–4AM daily
          </p>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-2xl font-display font-800 text-cyan">{activeCount}</div>
            <div className="text-[10px] text-muted tracking-widest uppercase">Active</div>
          </div>
          <div>
            <div className="text-2xl font-display font-800 text-text">{rooms.length - activeCount}</div>
            <div className="text-[10px] text-muted tracking-widest uppercase">Idle</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green shadow-[0_0_6px_#00ff88]' : 'bg-muted'}`} />
            <span className={`text-[10px] tracking-widest uppercase ${connected ? 'text-green' : 'text-muted'}`}>
              {connected ? 'SOCKET LIVE' : 'DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>

      {/* 6-room grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map(room => (
          <RoomCard
            key={room.roomId}
            room={room}
            onStart={startRoom}
            onStop={stopRoom}
            liveMessages={liveMessages}
          />
        ))}
      </div>

      {/* Bottom status bar */}
      <div className="mt-8 pt-4 border-t border-border flex items-center justify-between text-[10px] text-muted tracking-widest">
        <span>SCHEDULE · AUTO START 18:00 · AUTO STOP 04:00 · AMERICA/DENVER</span>
        <span>SONA RECORDING · NUIQ TRANSCRIPTION · BANNA EHR</span>
      </div>
    </div>
  );
}
