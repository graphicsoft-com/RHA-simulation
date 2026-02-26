import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { connectDB } from './db/connection.js';
import simulationRoutes from './routes/simulation.js';
import transcriptRoutes from './routes/transcripts.js';
import { registerSocketHandlers } from './socket/socketHandler.js';
import {
  initIO,
} from './controllers/simulationController.js';


const PORT = process.env['PORT'] || 5000;

async function bootstrap() {

  await connectDB();

  const app = express();

  app.use(cors()); 

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  app.use('/api/simulation', simulationRoutes);
  app.use('/api/transcripts', transcriptRoutes);

  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route not found: ${req.path}` });
  });

  // Attach Socket.io to HTTP server
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ['GET', 'POST'],
    },
  });

  // Give Socket.io instance to simulation controller
  initIO(io);

  // Register socket event handlers
  registerSocketHandlers(io);


  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Socket.io ready`);
    console.log(`CORS allowed for: * `);
  });
}

// Handle unexpected crashes gracefully
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

void bootstrap();