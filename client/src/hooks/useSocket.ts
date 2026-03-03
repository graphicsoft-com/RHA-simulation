// ─────────────────────────────────────────────
//  useSocket — connects to server Socket.io
//  Joins a room channel and triggers TTS
//  on every incoming message
// ─────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getRoomTTS, initTTS } from '../services/ttsService';
import type { ISocketNewMessage } from '@org/shared-types';

const SERVER_URL = import.meta.env.VITE_API_URL || '';

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
  const [locked, setLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // Get or create a TTS instance scoped to THIS room
    // Dashboard instances are flagged so they never emit tts_done
    const tts = getRoomTTS(roomId);
    if (!dashboard && audioEnabled) {
      tts.init(socket, roomId, false);
      initTTS(socket, roomId, false);
    } else {
      tts.init(socket, roomId, true); // dashboard — no tts_done emission
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

    // ── Room locked by another client ──────────
    socket.on('room_locked', ({ message }: { roomId: string; message: string }) => {
      console.warn(`🔒  Room locked: ${message}`);
      setLocked(true);
      setLockMessage(message);
      setConnected(false);
      socket.disconnect();
    });

    // ── Incoming message ───────────────────────
    socket.on('new_message', (data: ISocketNewMessage) => {
      // Dashboard accepts all rooms; dedicated room tab filters to its own roomId
      if (!dashboard && data.roomId !== roomId) return;

      // Keep last 50 messages
      setMessages((prev) => [...prev.slice(-49), data]);

      // 🔊 Only speak on a dedicated room tab — never on the dashboard
      if (audioEnabled && !dashboard && data.roomId === roomId) {
        tts.speak(data.text, data.role);
      }
    });

    // ── Room locked by another client ─────────────────
    socket.on('room_locked', ({ message }: { roomId: string; message: string }) => {
      console.warn(`🔒  ${message}`);
      setLocked(true);
      setLockMessage(message);
      setConnected(false);
      socket.disconnect();
    });

    return () => {
      tts.stop();
      socket.disconnect();

      setConnected(false);
    };
  }, [roomId, audioEnabled, dashboard]);

  return {
    messages,
    connected,
    locked,
    lockMessage,
    clearMessages: () => setMessages([]),
  };
}
