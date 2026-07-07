require('dotenv').config();
require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const assignRoutes = require('./routes/assign');
const chatRoutes = require('./routes/chat');
const invoiceRoutes = require('./routes/invoice');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nextgenportal';
console.log('Connecting to MongoDB at:', dbURI);
mongoose.connect(dbURI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch((err) => console.log('MongoDB connection error:', err));

app.use(express.json());
app.use(express.static('public'));
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api', assignRoutes);

// ── Shared Whiteboard via Socket.IO ──
// Stores the latest canvas state per room so late-joiners get the current board
const whiteboardRooms = {};

io.on('connection', (socket) => {
  // Join a whiteboard room (roomId = sorted teacherId + studentId)
  socket.on('wb:join', (roomId) => {
    socket.join(roomId);
    // Send the current board state to the newly joined user
    if (whiteboardRooms[roomId]) {
      socket.emit('wb:state', whiteboardRooms[roomId]);
    }
  });

  // Complete element (freehand path, shape, text) – persisted for late-joiners
  socket.on('wb:draw', ({ roomId, stroke }) => {
    if (!whiteboardRooms[roomId]) whiteboardRooms[roomId] = { strokes: [] };
    whiteboardRooms[roomId].strokes.push(stroke);
    socket.to(roomId).emit('wb:draw', stroke);
  });

  // Live freehand segment – forwarded only, NOT persisted (peer redraws on mouseup)
  socket.on('wb:live', ({ roomId, seg }) => {
    socket.to(roomId).emit('wb:live', seg);
  });

  // Undo – remove last element from server state
  socket.on('wb:undo', (roomId) => {
    if (whiteboardRooms[roomId] && whiteboardRooms[roomId].strokes.length) {
      whiteboardRooms[roomId].strokes.pop();
    }
    socket.to(roomId).emit('wb:undo');
  });

  // Redo – re-add element to server state
  socket.on('wb:redo', ({ roomId, stroke }) => {
    if (!whiteboardRooms[roomId]) whiteboardRooms[roomId] = { strokes: [] };
    whiteboardRooms[roomId].strokes.push(stroke);
    socket.to(roomId).emit('wb:redo', stroke);
  });

  // Clear board
  socket.on('wb:clear', (roomId) => {
    whiteboardRooms[roomId] = { strokes: [] };
    socket.to(roomId).emit('wb:clear');
  });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;