// ─────────────────────────────────────────────
//  RHA Simulation — Shared TypeScript Interfaces
//  Long Term Care Facility context
//  caregiver = care staff, tenant = aging resident
// ─────────────────────────────────────────────

export type IAgentRole = 'caregiver' | 'tenant';
export type IRoomStatus = 'active' | 'idle' | 'stopped';

export interface IRoom {
  roomId: string;
  name: string;
  status: IRoomStatus;
  activeSessionId?: string;
  messageCount?: number;
  lastSpeaker?: IAgentRole;
  lastMessageAt?: Date;
  caregiverId: string;
  tenantName: string;
}


export const ROOM_NAMES: Record<string, string> = {
  room1: 'Osama Room',
};

// 3 caregivers, each assigned 2 rooms
export const CAREGIVER_ASSIGNMENTS: Record<string, string> = {
  room1: 'caregiver1',
};

export const CAREGIVER_NAMES: Record<string, string> = {
  caregiver1: 'Sarah Mitchell',
};

// Aging tenants — one per room (from Sharique's character list)
export const TENANT_NAMES: Record<string, string> = {
  room1: 'Michael Thompson',
};

export const ALL_ROOMS = Object.keys(ROOM_NAMES);

export interface ISession {
  _id?: string;
  roomId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'stopped';
  tenantProfile: string;
  caregiverName: string;
  tenantName: string;
  messageCount: number;
}

export interface IMessage {
  _id?: string;
  sessionId: string;
  roomId: string;
  role: IAgentRole;
  text: string;
  timestamp: Date;
}

export interface ISocketNewMessage {
  roomId: string;
  sessionId: string;
  role: IAgentRole;
  text: string;
  timestamp: Date;
}

export interface ISocketRoomUpdate {
  roomId: string;
  status: IRoomStatus;
  messageCount: number;
}

export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}