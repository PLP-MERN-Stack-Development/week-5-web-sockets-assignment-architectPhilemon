import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // You can restrict to your frontend domain
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ Chat Server is Live!');
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_chat', (username) => {
    socket.username = username;
    socket.broadcast.emit('user_online', { id: socket.id, username });
  });

  socket.on('send_message', (data, callback) => {
    io.emit('receive_message', data);
    callback?.({ status: 'delivered' });
  });

  socket.on('typing', (username) => {
    socket.broadcast.emit('user_typing', username);
  });

  socket.on('stop_typing', () => {
    socket.broadcast.emit('stop_typing');
  });

  socket.on('send_private_message', (data) => {
    io.to(data.to).emit('receive_private_message', data);
  });

  socket.on('message_read', ({ from }) => {
    io.to(from).emit('read_ack', { to: socket.id });
  });

  socket.on('react_to_message', ({ messageId, emoji }) => {
    io.emit('message_reaction', { messageId, emoji });
  });

  socket.on('join_room', (room) => {
    socket.join(room);
    socket.to(room).emit('system_message', `${socket.username} has joined the room.`);
  });

  socket.on('send_room_message', (data) => {
    const timestamp = new Date().toLocaleTimeString();
    io.to(data.room).emit('receive_room_message', {
      sender: data.sender,
      message: data.message,
      timestamp
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    io.emit('user_offline', { id: socket.id, username: socket.username });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
