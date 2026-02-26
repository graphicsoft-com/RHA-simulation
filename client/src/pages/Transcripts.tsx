import { useState, useEffect } from 'react';
import axios from 'axios';
import { ROOM_NAMES, ALL_ROOMS } from '@org/shared-types';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Session {
  _id: string;
  roomId: string;
  startTime: string;
  endTime?: string;
  status: string;
  patientProfile: string;
  messageCount: number;
}

interface Message {
  _id: string;
  role: 'clinician' | 'patient';
  text: string;
  timestamp: string;
}

export default function Transcripts() {
  const [selectedRoom, setSelectedRoom]       = useState<string>('room1');
  const [sessions, setSessions]               = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messages, setMessages]               = useState<Message[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch sessions when room changes
  useEffect(() => {
    async function fetchSessions() {
      setLoadingSessions(true);
      setSelectedSession(null);
      setMessages([]);
      try {
        const { data } = await axios.get(`${SERVER_URL}/api/transcripts/${selectedRoom}`);
        setSessions(data.data.sessions);
      } catch {
        setSessions([]);
      } finally {
        setLoadingSessions(false);
      }
    }
    fetchSessions();
  }, [selectedRoom]);

  // Fetch messages when session is selected
  async function openSession(session: Session) {
    setSelectedSession(session);
    setLoadingMessages(true);
    try {
      const { data } = await axios.get(`${SERVER_URL}/api/transcripts/${session._id}/messages`);
      setMessages(data.data.messages);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  function formatDuration(start: string, end?: string) {
    if (!end) return 'ongoing';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const m = Math.floor(ms / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-20 pb-8 h-screen flex flex-col">

      {/* Header */}
      <div className="mb-6">
        <div className="text-[10px] text-muted tracking-[0.25em] uppercase mb-1">
          Session History
        </div>
        <h1 className="font-display text-2xl font-800 text-white">
          Tran<span className="text-cyan">scripts</span>
        </h1>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">

        {/* Left panel — room selector + session list */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">

          {/* Room filter */}
          <div className="flex flex-col gap-1">
            {ALL_ROOMS.map(roomId => (
              <button
                key={roomId}
                onClick={() => setSelectedRoom(roomId)}
                className={`px-3 py-2 rounded border text-left transition-all text-xs tracking-widest ${
                  selectedRoom === roomId
                    ? 'border-cyan/40 bg-cyan/5 text-cyan'
                    : 'border-border bg-surface text-muted hover:border-muted/60 hover:text-text'
                }`}
              >
                <span className="uppercase font-600">{ROOM_NAMES[roomId]}</span>
                <span className="text-muted ml-2 text-[9px]">{roomId}</span>
              </button>
            ))}
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
            {loadingSessions ? (
              <div className="text-muted text-[10px] tracking-widest text-center py-4">
                LOADING...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-muted text-[10px] tracking-widest text-center py-4">
                NO SESSIONS YET
              </div>
            ) : (
              sessions.map(session => (
                <button
                  key={session._id}
                  onClick={() => openSession(session)}
                  className={`w-full text-left px-3 py-2.5 rounded border transition-all ${
                    selectedSession?._id === session._id
                      ? 'border-cyan/40 bg-cyan/5'
                      : 'border-border bg-surface hover:border-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] uppercase tracking-widest font-600 ${
                      session.status === 'active' ? 'text-green' : 'text-muted'
                    }`}>
                      {session.status === 'active' ? '● LIVE' : '○ DONE'}
                    </span>
                    <span className="text-[9px] text-muted">
                      {session.messageCount} msgs
                    </span>
                  </div>
                  <div className="text-[10px] text-text">
                    {new Date(session.startTime).toLocaleDateString()} ·{' '}
                    {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[9px] text-muted mt-0.5">
                    Duration: {formatDuration(session.startTime, session.endTime)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel — transcript view */}
        <div className="flex-1 flex flex-col rounded-lg border border-border bg-surface overflow-hidden">
          {!selectedSession ? (
            <div className="flex-1 flex items-center justify-center text-muted text-xs tracking-widest">
              ← SELECT A SESSION TO VIEW TRANSCRIPT
            </div>
          ) : (
            <>
              {/* Session meta */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="text-xs text-white font-600">
                    {ROOM_NAMES[selectedSession.roomId]} · {new Date(selectedSession.startTime).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5 line-clamp-1">
                    {selectedSession.patientProfile !== 'PENDING'
                      ? selectedSession.patientProfile
                      : 'Profile pending'}
                  </div>
                </div>
                <div className="text-right text-[10px] text-muted">
                  <div>{selectedSession.messageCount} messages</div>
                  <div>{formatDuration(selectedSession.startTime, selectedSession.endTime)}</div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {loadingMessages ? (
                  <div className="text-muted text-[10px] tracking-widest text-center py-8">
                    LOADING TRANSCRIPT...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-muted text-[10px] tracking-widest text-center py-8">
                    NO MESSAGES IN THIS SESSION
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className="flex gap-3 animate-fadein">
                      <div className={`flex-shrink-0 w-16 pt-0.5 text-[9px] font-600 uppercase tracking-widest ${
                        m.role === 'clinician' ? 'text-cyan' : 'text-green'
                      }`}>
                        {m.role === 'clinician' ? '👨‍⚕️ DR.' : '🧑 PT.'}
                      </div>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
