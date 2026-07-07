require('dotenv').config();
require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const assignRoutes = require('./routes/assign');
const chatRoutes = require('./routes/chat');
const invoiceRoutes = require('./routes/invoice');

const app = express();
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



// Debug registered routes on startup


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;