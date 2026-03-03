import 'dotenv/config';
import cors from 'cors';
import path from 'path';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { promises as dns } from 'dns';
import { connectDB } from './db/connection.js';
import simulationRoutes from './routes/simulation.js';
import transcriptRoutes from './routes/transcripts.js';
import { registerSocketHandlers } from './socket/socketHandler.js';
import {
  initIO,
} from './controllers/simulationController.js';


const PORT = process.env['PORT'] || 3000;

// Warm up DNS so the first API call doesn't hit a cold resolver
async function warmupDNS(hostname: string): Promise<void> {
  try {
    await dns.lookup(hostname);
    console.log(`✅  DNS warmup OK — resolved ${hostname}`);
  } catch (err: any) {
    // Non-fatal: retry logic in agentService will handle it
    console.warn(`⚠️  DNS warmup failed for ${hostname}: ${err?.code ?? err?.message}`);
  }
}

async function bootstrap() {

  await connectDB();

  // Warm up DNS for DeepInfra before any room can start
  await warmupDNS('api.deepinfra.com');

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

  // Serve React client static files
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // All non-API routes return index.html (React Router support)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
      res.status(404).json({ success: false, error: `Route not found: ${req.path}` });
    }
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