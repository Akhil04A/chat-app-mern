import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Message from '../models/Message.js';

export const socketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production'
      );
      
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    });

    // Join user's personal room
    socket.join(socket.userId);

    // Emit online users list
    const onlineUsers = await User.find({ isOnline: true }).select('_id username avatar');
    const normalizedOnlineUsers = onlineUsers.map(u => ({
      _id: u._id,
      id: u._id.toString(),
      username: u.username,
      avatar: u.avatar
    }));
    io.emit('users:online', normalizedOnlineUsers);

    // Handle sending messages
    socket.on('message:send', async (data) => {
      try {
        const { receiverId, content, file } = data;

        if (!receiverId || (!content && !file)) {
          socket.emit('message:error', { message: 'Receiver ID and content/file are required' });
          return;
        }

        // Create message in database
        const message = new Message({
          sender: socket.userId,
          receiver: receiverId,
          content: content ? content.trim() : '',
          file: file || null
        });

        await message.save();

        // Populate sender and receiver
        await message.populate('sender', 'username avatar');
        await message.populate('receiver', 'username avatar');

        // Emit to receiver
        socket.to(receiverId).emit('message:receive', message);
        
        // Also emit back to sender for confirmation
        socket.emit('message:sent', message);

        // Send notification to receiver
        socket.to(receiverId).emit('notification:new', {
          type: 'message',
          from: {
            id: socket.userId,
            username: socket.username
          },
          content: content ? content.substring(0, 50) : '📎 Sent a file',
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('message:error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (data) => {
      socket.to(data.receiverId).emit('typing:start', {
        userId: socket.userId,
        username: socket.username
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(data.receiverId).emit('typing:stop', {
        userId: socket.userId
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`);

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });

      // Update online users list
      const onlineUsers = await User.find({ isOnline: true }).select('_id username avatar');
      const normalizedOnlineUsers = onlineUsers.map(u => ({
        _id: u._id,
        id: u._id.toString(),
        username: u.username,
        avatar: u.avatar
      }));
      io.emit('users:online', normalizedOnlineUsers);
    });
  });
};

