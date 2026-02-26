// ─────────────────────────────────────────────
//  useSocket — connects to server Socket.io
//  Joins a room channel and triggers TTS
//  on every incoming message
// ─────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { speak, stopSpeaking, initTTS } from '../services/ttsService';
import type { ISocketNewMessage } from '@org/shared-types';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Re-exported so components can type live messages
export type LiveMessage = ISocketNewMessage;

interface UseSocketOptions {
  roomId: string;
  audioEnabled?: boolean;
  /** When true, joins 'join_dashboard' instead of 'join_room' and accepts messages from ALL rooms */
  dashboard?: boolean;
}

export function useSocket({ roomId, audioEnabled = true, dashboard = false }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<ISocketNewMessage[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // Give ttsService the socket reference so it can emit 'tts_done'
    // after each utterance ends — this is what syncs server to browser TTS
    if (!dashboard && audioEnabled) {
      initTTS(socket, roomId);
    }

    // ── Connection events ──────────────────────
    socket.on('connect', () => {
      console.log(`🔌  Socket connected for ${roomId}`);
      if (dashboard) {
        socket.emit('join_dashboard');
      } else {
        socket.emit('join_room', roomId);
      }
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.warn(`⚠️   Socket disconnected for ${roomId}`);
      setConnected(false);
    });

    // ── Incoming message ───────────────────────
    socket.on('new_message', (data: ISocketNewMessage) => {
      // In dashboard mode accept all rooms; otherwise filter by roomId
      if (!dashboard && data.roomId !== roomId) return;

      // Keep last 50 messages
      setMessages((prev) => [...prev.slice(-49), data]);

      // 🔊 Speak via Web Speech API
      if (audioEnabled) {
        speak(data.text, data.role);
      }
    });

    return () => {
      stopSpeaking();
      socket.disconnect();
      setConnected(false);
    };
  }, [roomId, audioEnabled, dashboard]);

  return {
    messages,
    connected,
    clearMessages: () => setMessages([]),
  };
}
