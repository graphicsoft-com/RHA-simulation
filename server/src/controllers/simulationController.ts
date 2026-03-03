import { Request, Response } from 'express';
import { Server } from 'socket.io';
import Session from '../models/Session.js';
import {
  runRoom,
  stopRoom,
  getRoomStatus,
} from '../services/agentService.js';
import { ALL_ROOMS, ROOM_NAMES } from '../../../shared-types/src/index.js';

// ─────────────────────────────────────────────
//  Simulation Controller
//  Injected with Socket.io instance from main.ts
// ─────────────────────────────────────────────

let io: Server;

// Buffer for messages emitted before any client has joined the room
export const pendingMessages: Record<string, any[]> = {};

// Called once from main.ts after Socket.io is created
export function initIO(socketIO: Server): void {
  io = socketIO;
}

// ── POST /api/simulation/start/:roomId ─────────────────────────────────────
export async function startSimulation(req: Request, res: Response): Promise<void> {
  const roomId = req.params['roomId'] as string;

  // Validate roomId
  if (!ALL_ROOMS.includes(roomId)) {
    res.status(400).json({
      success: false,
      error: `Invalid roomId. Must be one of: ${ALL_ROOMS.join(', ')}`,
    });
    return;
  }

  // Don't start if already running
  if (getRoomStatus(roomId)) {
    res.status(409).json({
      success: false,
      error: `${roomId} is already running`,
    });
    return;
  }

  try {
    // Create a new session in MongoDB
    const session = new Session({
      roomId,
      tenantProfile: 'PENDING',
      status: 'active' as const,
      startTime: new Date(),
      messageCount: 0,
    });
    await session.save();

    const sessionId = (session._id as { toString(): string }).toString();

    // Kick off the agent loop — non-blocking (no await)
    // The loop runs in the background and emits via Socket.io
    runRoom(roomId, sessionId, (payload) => {
      const socketRoom = io.sockets.adapter.rooms.get(roomId);
      const hasClients = socketRoom && socketRoom.size > 0;

      if (hasClients) {
        // Flush any buffered messages first, then send the current one
        if (pendingMessages[roomId]?.length) {
          console.log(`📦  [${roomId}] Flushing ${pendingMessages[roomId].length} buffered message(s) to room`);
          pendingMessages[roomId].forEach(p => io.to(roomId).emit('new_message', p));
          pendingMessages[roomId] = [];
        }
        io.to(roomId).emit('new_message', payload);
      } else {
        // No client in room yet — buffer until someone joins
        if (!pendingMessages[roomId]) pendingMessages[roomId] = [];
        pendingMessages[roomId].push(payload);
        console.log(`📦  [${roomId}] Buffered message (no clients yet) — ${payload.role} turn`);
      }

      // Also emit a room status update so the dashboard stays in sync
      io.emit('room_update', {
        roomId,
        status: 'active',
        messageCount: payload.sessionId,
      });
    });

    console.log(`🟢  [${roomId}] Started — session: ${sessionId}`);

    res.status(201).json({
      success: true,
      data: { roomId, sessionId, status: 'active' },
    });
  } catch (err) {
    console.error(`❌  Failed to start ${roomId}:`, err);
    res.status(500).json({ success: false, error: 'Failed to start simulation' });
  }
}

// ── POST /api/simulation/stop/:roomId ──────────────────────────────────────
export async function stopSimulation(req: Request, res: Response): Promise<void> {
  const roomId = req.params['roomId'] as string;

  if (!ALL_ROOMS.includes(roomId)) {
    res.status(400).json({ success: false, error: 'Invalid roomId' });
    return;
  }

  if (!getRoomStatus(roomId)) {
    res.status(409).json({ success: false, error: `${roomId} is not running` });
    return;
  }

  stopRoom(roomId);

  // Notify all clients that this room stopped
  io.emit('room_update', { roomId, status: 'idle' });

  console.log(`🔴  [${roomId}] Stopped via API`);

  res.json({ success: true, data: { roomId, status: 'idle' } });
}

// ── GET /api/simulation/status ─────────────────────────────────────────────
export async function getAllRoomStatuses(req: Request, res: Response): Promise<void> {
  try {
    // Build status for all 6 rooms
    const rooms = await Promise.all(
      ALL_ROOMS.map(async (roomId) => {
        const isActive = getRoomStatus(roomId);

        // Get the active session if running
        const activeSession = isActive
          ? await Session.findOne({ roomId, status: 'active' }).sort({ startTime: -1 })
          : null;

        return {
          roomId,
          name: ROOM_NAMES[roomId],
          status: isActive ? 'active' : 'idle',
          activeSessionId: activeSession?._id?.toString() ?? null,
          messageCount: activeSession?.messageCount ?? 0,
        };
      })
    );

    res.json({ success: true, data: { rooms } });
  } catch (err) {
    console.error('❌  Failed to get room statuses:', err);
    res.status(500).json({ success: false, error: 'Failed to get statuses' });
  }
}

// ── Helpers used by node-cron scheduler ────────────────────────────────────
export async function startAllRooms(): Promise<void> {
  console.log('⏰  Cron: Starting all rooms...');
  for (const roomId of ALL_ROOMS) {
    if (!getRoomStatus(roomId)) {
      try {
        const session = new Session({
          roomId,
          patientProfile: 'PENDING',
          status: 'active' as const,
          startTime: new Date(),
          messageCount: 0,
        });
        await session.save();

        runRoom(roomId, (session._id as { toString(): string }).toString(), (payload) => {
          io.to(roomId).emit('new_message', payload);
        });

        console.log(`🟢  [${roomId}] Auto-started by cron`);
      } catch (err) {
        console.error(`❌  Cron failed to start ${roomId}:`, err);
      }
    }
  }
}

export function stopAllRooms(): void {
  console.log('⏰  Cron: Stopping all rooms...');
  ALL_ROOMS.forEach((roomId) => {
    if (getRoomStatus(roomId)) {
      stopRoom(roomId);
      io.emit('room_update', { roomId, status: 'idle' });
    }
  });
}
