console.log('Chat route loaded');
const express = require('express');
const Message = require('../models/Message');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.post('/send', verifyToken, async (req, res) => {
  try {
    let { receiverId, text } = req.body;

    // Filter email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    text = text.replace(emailRegex, '[CONTACT INFO REMOVED]');

    // Filter phone numbers (basic detection for sequences of 7+ digits with optional separators)
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    text = text.replace(phoneRegex, '[CONTACT INFO REMOVED]');

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

router.get('/view/:studentId/:teacherId', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.params.studentId, receiver: req.params.teacherId },
        { sender: req.params.teacherId, receiver: req.params.studentId }
      ]
    }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
