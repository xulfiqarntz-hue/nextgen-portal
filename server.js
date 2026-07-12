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

// ── Shared Whiteboard via Socket.IO (multi-page) ──
const whiteboardRooms = {};

function getRoom(roomId) {
  if (!whiteboardRooms[roomId]) whiteboardRooms[roomId] = { pages: [[]] };
  return whiteboardRooms[roomId];
}

io.on('connection', (socket) => {
  // Join room — always send full state (empty or not)
  socket.on('wb:join', (roomId) => {
    socket.join(roomId);
    socket.emit('wb:state', getRoom(roomId));
  });

  // Committed stroke — persisted on the correct page
  socket.on('wb:draw', ({ roomId, page, stroke }) => {
    const room = getRoom(roomId);
    while (room.pages.length <= page) room.pages.push([]);
    room.pages[page].push(stroke);
    socket.to(roomId).emit('wb:draw', { page, stroke });
  });

  // Live freehand — forwarded only, NOT persisted
  socket.on('wb:live', ({ roomId, page, seg }) => {
    socket.to(roomId).emit('wb:live', { page, seg });
  });

  // Undo last stroke on a page
  socket.on('wb:undo', ({ roomId, page }) => {
    const room = getRoom(roomId);
    if (room.pages[page] && room.pages[page].length) room.pages[page].pop();
    socket.to(roomId).emit('wb:undo', { page });
  });

  // Clear a single page
  socket.on('wb:clear', ({ roomId, page }) => {
    const room = getRoom(roomId);
    if (room.pages[page]) room.pages[page] = [];
    socket.to(roomId).emit('wb:clear', { page });
  });

  // Add a new blank page
  socket.on('wb:addPage', (roomId) => {
    const room = getRoom(roomId);
    room.pages.push([]);
    socket.to(roomId).emit('wb:addPage', room.pages.length - 1);
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