export * from './lib/shared-types.js';

// ── Agent ──────────────────────────────────────
export type IAgentRole = 'clinician' | 'patient';

// ── Room ───────────────────────────────────────
export type IRoomStatus = 'active' | 'idle' | 'stopped';

export interface IRoom {
  roomId: string;       // e.g. "room1"
  name: string;         // e.g. "Provo Peak"
  status: IRoomStatus;
  activeSessionId?: string;
  messageCount?: number;
  lastSpeaker?: IAgentRole;
  lastMessageAt?: Date;
}

// Room name mapping — single source of truth
export const ROOM_NAMES: Record<string, string> = {
  room1: 'Osama',
  room2: 'John',
};

export const ALL_ROOMS = Object.keys(ROOM_NAMES); // ['room1'...'room6']

// ── Session ────────────────────────────────────
export interface ISession {
  _id?: string;
  roomId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'stopped';
  patientProfile: string;   // symptom description used this session
  messageCount: number;
}

// ── Message ────────────────────────────────────
export interface IMessage {
  _id?: string;
  sessionId: string;
  roomId: string;
  role: IAgentRole;
  text: string;
  timestamp: Date;
}

// ── Socket Events ──────────────────────────────
// Emitted from server → client via Socket.io
export interface ISocketNewMessage {
  roomId: string;
  sessionId: string;
  role: IAgentRole;
  text: string;
  audio?: string;       // base64 mp3 from OpenAI TTS
  timestamp: Date;
}

export interface ISocketRoomUpdate {
  roomId: string;
  status: IRoomStatus;
  messageCount: number;
}

// ── API Response Shapes ────────────────────────
export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IStatusResponse {
  rooms: IRoom[];
}