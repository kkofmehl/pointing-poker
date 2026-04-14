import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setupSocketHandlers } from './socketHandlers.js';
import { sessionManager } from './sessionManager.js';
import {
  generateSessionBackground,
  mapGeminiErrorToHttpStatus
} from './geminiBackgroundService.js';
import { createSessionBackgroundHandler } from './sessionBackgroundRoute.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false 
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

app.post(
  '/api/session-background',
  createSessionBackgroundHandler({
    generateSessionBackground,
    mapErrorToStatus: mapGeminiErrorToHttpStatus
  })
);

// Serve static files from client dist in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));
  
  // Serve index.html for all routes (SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(join(clientDistPath, 'index.html'));
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Setup Socket.io handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

