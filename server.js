require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = 3000;

const dbURI = 'mongodb+srv://xulfiqarntz_db_user:RvfmgzSmMSqSZhCE@cluster0.xsyzeba.mongodb.net/nextgenportal?appName=Cluster0';

mongoose.connect(dbURI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch((err) => console.log('MongoDB connection error:', err));

  app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/', (req, res) => {
  res.send('Hello Zulfiqar! Your server is working.');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});