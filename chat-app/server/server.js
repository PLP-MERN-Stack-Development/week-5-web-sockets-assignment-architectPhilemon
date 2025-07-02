// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());

const users = new Map();

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('join_chat', (username) => {
    users.set(socket.id, { id: socket.id, username });
    io.emit('user_online', { id: socket.id, username });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      io.emit('user_offline', user);
      users.delete(socket.id);
    }
  });

  socket.on('typing', (username) => {
    socket.broadcast.emit('user_typing', username);
  });

  socket.on('stop_typing', () => {
    socket.broadcast.emit('stop_typing');
  });

  socket.on('send_message', (data, callback) => {
    io.emit('receive_message', data);
    if (callback) callback({ status: 'delivered' });
  });

  socket.on('send_private_message', ({ to, sender, message, fileType, timestamp }) => {
    io.to(to).emit('receive_private_message', { sender, message, fileType, timestamp });
  });

  socket.on('message_read', ({ from }) => {
    io.to(from).emit('read_ack', { to: socket.id });
  });

  socket.on('join_room', (room) => {
    socket.join(room);
    socket.to(room).emit('system_message', `${users.get(socket.id)?.username || 'A user'} joined the room.`);
  });

  socket.on('send_room_message', ({ room, sender, message }) => {
    io.to(room).emit('receive_room_message', {
      sender,
      message,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on('react_to_message', ({ messageId, emoji }) => {
    io.emit('message_reaction', { messageId, emoji });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
