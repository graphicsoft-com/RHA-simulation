import { Server, Socket } from 'socket.io';
import { ALL_ROOMS } from '../../../shared-types/src/index.js';
import { acknowledgeTTS } from '../services/agentService';

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join_room', (roomId: string) => {
      if (!ALL_ROOMS.includes(roomId)) {
        socket.emit('error', { message: `Invalid roomId: ${roomId}` });
        return;
      }

      ALL_ROOMS.forEach(id => socket.leave(id));

      socket.join(roomId);
      console.log(`Socket ${socket.id} joined ${roomId}`);

      // Confirm to client
      socket.emit('joined_room', { roomId });
    });

    // Browser tab subscribes to ALL rooms (for the dashboard overview)
    socket.on('join_dashboard', () => {
      ALL_ROOMS.forEach(roomId => socket.join(roomId));
      console.log(`Socket ${socket.id} joined dashboard (all rooms)`);
      socket.emit('joined_dashboard');
    });

    // Client fires this when speechSynthesis.onend fires
    socket.on('tts_done', (roomId: string) => {
      acknowledgeTTS(roomId);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
