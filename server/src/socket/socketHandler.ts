import { Server, Socket } from 'socket.io';
import { ALL_ROOMS } from '../../../shared-types/src/index.js';
import { acknowledgeTTS } from '../services/agentService';
import { pendingMessages } from '../controllers/simulationController';

// Tracks the authoritative TTS-owning socket per room.
// Only a dedicated room tab (join_room) can own a room.
// Dashboard sockets (join_dashboard) are never registered here.
const roomOwners: Record<string, string> = {};

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join_room', (roomId: string) => {
      if (!ALL_ROOMS.includes(roomId)) {
        socket.emit('error', { message: `Invalid roomId: ${roomId}` });
        return;
      }

      // If another socket already owns this room, deny access
      if (roomOwners[roomId] && roomOwners[roomId] !== socket.id) {
        console.warn(`🔒  [${roomId}] Blocked — already owned by ${roomOwners[roomId]}`);
        socket.emit('room_locked', { roomId, message: `Room ${roomId} is currently in use. Please try again later.` });
        return;
      }

      // Leave any previously joined rooms and release prior ownership
      ALL_ROOMS.forEach(id => {
        if (roomOwners[id] === socket.id) delete roomOwners[id];
        socket.leave(id);
      });

      socket.join(roomId);
      // This socket is now the authoritative TTS owner for this room
      roomOwners[roomId] = socket.id;
      console.log(`Socket ${socket.id} joined ${roomId} (owner)`);

      socket.emit('joined_room', { roomId });

      // Flush any messages that fired before this client joined
      if (pendingMessages[roomId]?.length) {
        console.log(`📦  [${roomId}] Flushing ${pendingMessages[roomId].length} buffered message(s) to new owner`);
        pendingMessages[roomId].forEach(p => socket.emit('new_message', p));
        pendingMessages[roomId] = [];
      }
    });

    // Dashboard joins all rooms for message broadcast only — NOT a TTS owner
    socket.on('join_dashboard', () => {
      ALL_ROOMS.forEach(roomId => socket.join(roomId));
      console.log(`Socket ${socket.id} joined dashboard (all rooms, no ownership)`);
      socket.emit('joined_dashboard');
    });

    // Only honour tts_done from the socket that owns that room
    socket.on('tts_done', (roomId: string) => {
      if (!ALL_ROOMS.includes(roomId)) return;

      if (roomOwners[roomId] !== socket.id) {
        console.warn(
          `⚠️  [${roomId}] tts_done ignored — sender ${socket.id} is not owner (owner: ${roomOwners[roomId] ?? 'none'})`
        );
        return;
      }

      acknowledgeTTS(roomId);
    });

    socket.on('disconnect', () => {
      // Release ownership so reconnect can re-register cleanly
      ALL_ROOMS.forEach(id => {
        if (roomOwners[id] === socket.id) {
          console.log(`🔌  [${id}] Owner disconnected — clearing roomOwner`);
          delete roomOwners[id];
        }
      });
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
