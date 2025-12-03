import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { socketHandler } from './socket/socketHandler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatis')
  .then(() => {
    console.log('MongoDB Connected');

    // Socket.io connection handling (only after DB is ready)
    socketHandler(io);

    // Health check route
    app.get('/api/health', (req, res) => {
      res.json({ status: 'OK', message: 'Server is running' });
    });

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.error('Server will not start until MongoDB is available.');
    process.exit(1);
  });

