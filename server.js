require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const authRoutes = require('./routes/auth');
const assignRoutes = require('./routes/assign');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = 3000;

const dbURI = 'mongodb+srv://xulfiqarntz_db_user:RvfmgzSmMSqSZhCE@cluster0.xsyzeba.mongodb.net/nextgenportal?appName=Cluster0';

mongoose.connect(dbURI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch((err) => console.log('MongoDB connection error:', err));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api', assignRoutes);
app.use('/api/chat', chatRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
