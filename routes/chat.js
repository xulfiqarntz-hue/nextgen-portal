const express = require('express');
const Message = require('../models/Message');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/send', verifyToken, async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const newMessage = new Message({
      sender: req.user.id,
      receiver: receiverId,
      text
    });
    await newMessage.save();
    res.status(201).json({ message: 'Message sent', data: newMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conversation/:userId', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.id }
      ]
    }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
